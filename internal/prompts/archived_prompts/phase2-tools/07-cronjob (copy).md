# Action: cronjob Tool - Extend the Scheduler from 03-daily-briefing (Standalone Carina)

## Goal
Extend the generic `TaskScheduler` built in `03-daily-briefing.md` (phase1-core) into a full `cronjob` tool the LLM can call directly: cron-syntax scheduling, job CRUD, multi-channel delivery, job chaining, and watchdog scripts.

## Context
- Project: `core.carinaai.uk`. Node.js 22 + TypeScript 5, ESM imports, pnpm, Vitest.
- **Hard sequencing dependency**: `03-daily-briefing.md` (in `action_prompts/phase1-core/`) specifies `src/agents/scheduled-tasks.ts` - a deliberately minimal `TaskScheduler` (`{ hour, minute, timezone }` schedules, single `setInterval` tick, fixed task registration at startup). That prompt explicitly chose simplicity ("do not pull in a cron-expression parser for 'once a day at a configured time'") because its only consumer was a single daily briefing. **This spec needs the fuller version that prompt deliberately deferred**: arbitrary cron expressions, shorthand (`'30m'`, `'every 2h'`), one-shot ISO timestamps, repeat counts, pause/resume, job chaining, and runtime CRUD via a tool call. Read `03-daily-briefing.md` FIRST - do not write a second, parallel scheduler. Extend the one that exists by then, or if its design can't bear the weight of these requirements, refactor it in place (with tests proving the existing daily-briefing behaviour still works) rather than forking it.
- The spec's `prompt`/`script`/`profile`/`skills` fields describe running jobs in **fresh, isolated sessions with no chat history** ("Cron run sessions cannot recursively schedule more cron jobs" - note this is the same "no recursive spawning" constraint `06-delegate-task.md` enforces for subagents; consider whether both can share one depth/recursion-guard mechanism).
- `~/.hermes/scripts/` is the other product's path convention - reinterpret as a Carina-appropriate location, e.g. `data/scripts/` (mirroring `data/logs/`, `data/tts/` conventions already established).
- Conventions: functions under ~20 lines, classes under ~200 lines, Vitest with `vi.useFakeTimers()`, no em dashes/emojis.

## Files to modify
- `src/agents/scheduled-tasks.ts` (built by `03-daily-briefing.md`) - extend `ScheduledTask`/`TaskScheduler` to support cron expressions, one-shot timestamps, repeat counts, pause state, and a persistence-backed CRUD surface
- `src/agents/scheduled-tasks.test.ts` - extend with the new behaviours
- `src/memory/migrations.ts` - extend or formalise the `scheduled_tasks` persistence table (the briefing prompt left this as a "decide before assuming" step; this spec makes persistence non-optional, since `cronjob: list/update/pause/remove` requires durable, queryable job state)

## Files to create
- `src/tools/cronjob.ts` - the `cronjob` `Tool` (actions: `create`, `list`, `update`, `pause`, `resume`, `remove`, `run`)
- `src/tools/cronjob.test.ts`

## Step-by-step

1. **Resolve the schedule-format gap**: `03-daily-briefing.md`'s scheduler understands only `{ hour, minute, timezone }`. This spec needs to also parse `'30m'`, `'every 2h'`, standard 5-field cron (`'0 9 * * *'`), and ISO timestamps. Check `package.json` for an existing cron parser (`grep -n 'cron\|croner' package.json` - none found as of this writing). Adding one (`croner` is a modern, lightweight, dependency-free option commonly used in Node/TS projects) is reasonable here, unlike the daily-briefing case, because the spec's whole premise is "arbitrary user-defined schedules," which a hand-rolled `{hour,minute}` check structurally cannot support. Write a small `parseSchedule(input: string): ScheduleSpec` that normalises all four formats into whatever internal representation the chosen library wants, and keep this function isolated and independently testable (it's the part most likely to have edge-case bugs).

2. **Persist jobs properly** - this is the part the daily-briefing prompt deferred ("decide before assuming"). A `cronjob: list` that loses jobs on restart, or `pause`/`resume` that don't survive a deploy, would be a broken feature, not a minimal one. Add a migration:
   ```sql
   CREATE TABLE IF NOT EXISTS scheduled_tasks (
     id UUID PRIMARY KEY,
     name TEXT,
     schedule TEXT NOT NULL,
     prompt TEXT,
     script_path TEXT,
     no_agent BOOLEAN DEFAULT false,
     deliver TEXT DEFAULT 'origin',
     repeat_count INT,
     runs_remaining INT,
     status TEXT DEFAULT 'active',
     last_run TIMESTAMPTZ,
     next_run TIMESTAMPTZ,
     context_from TEXT[],
     enabled_toolsets TEXT[],
     created_at TIMESTAMPTZ DEFAULT now()
   );
   ```
   Adjust column types to match this project's conventions (check `migrations.ts`'s existing tables for the JSON-vs-array-column choice already made elsewhere - stay consistent rather than introducing a new convention).

3. Implement each `cronjob` action as a thin wrapper over registry + persistence operations:
   - `create`: validate `schedule` via `parseSchedule`, validate that exactly one of `prompt`/`script` is meaningfully set (the spec allows both - `script` output injected as context for `prompt` - so validate the *combination* makes sense, not just "at least one present"), insert the row, register with the live scheduler, return the generated `job_id`
   - `list`: query persisted jobs, compute `next_run` for each (the chosen cron library should expose this), return the spec's documented shape
   - `update`/`pause`/`resume`/`remove`: mutate the persisted row AND the live in-memory scheduler entry - the two must never diverge (a paused job that's still ticking, or a removed job whose timer is still registered, are exactly the kind of bug that's invisible until 3am)
   - `run`: trigger immediate execution outside the normal schedule, without disturbing `next_run`/`last_run` bookkeeping for the regular cadence (or document why it does, if that's the chosen behaviour)

4. Implement `script`/`no_agent` execution:
   - Resolve relative script paths under `data/scripts/` (validated through `isSafePath` - same path-safety helpers as every other file-touching feature in this codebase)
   - `.sh`/`.bash` -> run via `bash`, everything else -> `python3`, using `execFile` with array arguments (mirror `04-tts-delivery.md`'s shell-escaping discipline - never string-interpolate a script path or its output into a shell command)
   - `no_agent: true`: skip the LLM turn entirely, deliver `stdout` verbatim; empty `stdout` delivers nothing; non-zero exit triggers an error alert (define what "alert" means concretely - probably the same delivery channel as success, with a clear `[Job failed]` prefix, plus a Scout `reportEvent` for visibility)
   - `no_agent: false` with a `script`: run the script first, inject its `stdout` into the `prompt` as context, then run the agent turn as `03-daily-briefing.md`'s scheduler already does

5. Implement job chaining via `context_from`: before building a job's prompt, look up the most recent completed run's output for each listed `job_id` and inject it as additional context. This requires storing run outputs (add a `scheduled_task_runs` table, or a `last_output` column if you only need the most recent - decide based on whether the spec's chaining ever needs more than the latest run, and document the choice).

6. Implement multi-channel `deliver`:
   - `'origin'`: back to the channel/chat that created the job (requires storing enough session/channel identity at creation time to route back later - check what `router.ts`/`getSession` exposes)
   - `'local'`: persist only, no delivery
   - `'all'`: fan out to every connected gateway (Telegram, web, etc. - whichever are active)
   - `'telegram:chat_id:thread_id'` / `'discord:#channel'`: parse and route to the specific channel (Discord is not currently a gateway in this codebase per the repo map - if `discord:` targets are requested, either implement a minimal send-path or, more honestly, reject unsupported channel prefixes with a clear error rather than silently dropping the delivery)
   Wrap each delivery attempt in its own try/catch - one channel failing must not prevent delivery to others (mirror `Promise.allSettled` patterns established elsewhere).

7. Enforce "cron run sessions cannot recursively schedule more cron jobs": exclude `cronjob` from the tool list available to a job's agent turn, the same way `06-delegate-task.md` excludes `delegate-task` from subagent toolsets. If both mechanisms end up needing "run this turn with tool X excluded," factor that into one shared helper.

8. Write `src/tools/cronjob.test.ts` and extend `scheduled-tasks.test.ts` (Vitest, `vi.useFakeTimers()`):
   - `parseSchedule`: each of the four formats produces a correct internal schedule, malformed input is rejected with a clear error
   - CRUD round-trip: create -> list shows it -> update changes it -> pause stops it firing -> resume restarts it -> remove deletes it, verified against both the persisted row and the live timer state
   - `repeat: 1` fires once and then auto-removes/deactivates; `repeat: unset` fires indefinitely
   - `no_agent: true` delivers stdout verbatim, suppresses empty output, alerts on non-zero exit
   - Chaining: a job with `context_from: ['job-a']` receives job-a's last output in its prompt
   - Recursion guard: a scheduled job's agent turn cannot call `cronjob` itself

## Expected behavior
- A user can say "every weekday at 8am, compile a portfolio summary and send it to Telegram" and `cronjob: create` schedules it correctly, surviving a process restart.
- `cronjob: list` shows accurate `next_run`/`last_run`/`status` for every job.
- Watchdog jobs (`no_agent: true`, short interval, a health-check script) deliver silently when healthy and alert clearly when not.
- Job chaining works: job B's prompt genuinely contains job A's most recent output.

## Test
```bash
cd core.carinaai.uk
pnpm vitest run src/tools/cronjob.test.ts src/agents/scheduled-tasks.test.ts
pnpm test
pnpm build
```
Manual check:
```bash
# Create a job scheduled a few minutes out, confirm it fires and delivers, then list/pause/resume/remove it
```

## Dependencies
- `03-daily-briefing.md` MUST be completed first - this prompt extends its `TaskScheduler`, it does not replace it
- A cron-expression parsing library (e.g. `croner`) - new dependency, justified here unlike in the briefing prompt because arbitrary schedules are this spec's core requirement
- `02-telegram-bot.md` (verified working) for `deliver: 'telegram:...'` and `'all'` paths
- `06-delegate-task.md`'s recursion-guard pattern, if you choose to share it
