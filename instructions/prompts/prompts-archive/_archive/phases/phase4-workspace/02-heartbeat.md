# Action: Proactive Check-In Cycle - Extend the Existing Scheduler, Don't Build a Second One (Standalone Carina)

## Goal
Build a "should I reach out right now, and about what" decision layer on top of the generic `TaskScheduler` that `03-daily-briefing.md` already builds, restricted to the checks Carina can actually perform (email, weather, git/project status for self-hosted operators) and explicitly declining the ones that need integrations that don't exist (calendar, Twitter/social mentions) until those are real product decisions.

## Context
- Project: `core.carinaai.uk`. Node.js 22 + TypeScript 5, ESM imports, pnpm, Vitest.
- **Naming collision to resolve first, loudly**: Carina ALREADY has something called a "heartbeat" - `src/index.ts`'s `heartbeatInterval = setInterval(() => void reportHeartbeat(), 60_000)`, which calls `reportHeartbeat()` in `src/security/scout-client.ts` to report **process liveness to the Labyrinth Scout security dashboard** (`POST /api/heartbeat`). That is a completely different concept from this spec's "periodically check the user's inbox and decide whether to say something." Using the word "heartbeat" for both in the same codebase WILL cause confusion - in code, logs, and conversation. **Name this feature something else** - `CheckInScheduler`/`checkInCycle`/`proactiveCheckIn` are all clearer and collision-free. Do not name any new file, class, function, or log line "heartbeat."
- **This is a generalisation of `03-daily-briefing.md`'s scheduler, not a new scheduling system**: that prompt already builds `TaskScheduler` (single `setInterval`, per-task `{hour, minute, timezone}`, `lastRunDate` double-fire guard, `router.handle({source: 'scheduled'})` to get agent output, `deliverTo` callback). Read `src/agents/scheduled-tasks.ts` (it should exist by the time this runs - if it doesn't, this prompt's prerequisite is missing; flag that rather than building a parallel mechanism) in full. **This spec's "heartbeat cycle" is structurally: a `TaskScheduler` task that runs every ~30 minutes (not once a day), whose `buildPrompt` rotates through different checks, and whose output is conditionally delivered based on a speak-or-stay-quiet decision** - not a different system, an extension.
- **Bucket the "what to check" list - most of it needs integrations Carina doesn't have**:
  - **Real, buildable now**: Email (Carina has `inbound_emails` - confirmed table in `migrations.ts` - and `src/api/email-webhook.ts`; a check against recent inbound emails for urgency is a real, scoped feature), Weather (a free, no-key API like Open-Meteo - simple `http-tool` call), recent daily-memory-file review + `MEMORY.md` maintenance (this is `01-workspace-files.md`'s territory - if that prompt builds the journal/`MEMORY.md` mechanism, this is where it gets exercised periodically)
  - **Not buildable without new integration decisions - decline and document**: Calendar ("upcoming events in next 24-48h" - no calendar integration exists anywhere in the codebase, `grep -rln 'calendar\|google.*calendar\|ical' src/` confirms this), Twitter/social mentions (no social-media integration exists; also recall `05-productivity-media-etc.md` explicitly excluded `twitter-bot` as wrong-persona - building a Twitter-mentions checker here would silently reintroduce what that prompt declined). Document both as "needs a real integration-and-credentials decision with the user before this can be built - not a skill-writing exercise."
  - **Operator-only, self-hosted-CLI-scoped** ("git status, commit and push agent's own changes, update documentation"): these only make sense when Carina has a real project directory to operate on - i.e. the self-hosted CLI mode this whole phase keeps circling back to (see `01-workspace-files.md`'s CLI-vs-gateway split). Gate these checks on `source === 'cli'` / a configured project path, exactly as that prompt gates workspace-file loading. A hosted SaaS tenant's check-in cycle should never run `git commit` against anything - there is no "the agent's own project" in their context.
- **Quiet hours and "when to reach out" is the genuinely valuable, portable part of this spec** - it's a decision policy, not an integration. Build that for real, as prompt-engineered judgment (the agent reasons about whether to speak), backed by simple, testable state (last-contact timestamp, quiet-hours window, urgency signal from whatever checks actually ran).
- Read `src/memory/migrations.ts` for the `inbound_emails` schema and `src/api/email-webhook.ts` for how inbound mail already flows in, before designing the email check.

## Files to create
- `src/agents/check-in.ts` - the rotation-and-decision layer: `buildCheckInPrompt(rotationState)`, `shouldStayQuiet(context)`, `recordCheckInState`/`loadCheckInState`
- `src/agents/check-in.test.ts`
- `src/agents/checks/email-check.ts` - queries `inbound_emails` for recent/urgent items
- `src/agents/checks/weather-check.ts` - thin `http-tool`/Open-Meteo wrapper (only if the user has configured a location - never guess one)
- `src/agents/checks/project-status-check.ts` - `git status`/`git log` via `shell-exec`, **gated to CLI mode + configured project path only**

## Files to modify
- `src/index.ts` - register the check-in task with the scheduler from `03-daily-briefing.md` (mirror exactly how `portfolioBriefingTask` gets registered - same scheduler, same lifecycle hooks, just a different `{hour, minute}` cadence... except this one needs to run every ~30 minutes, not once daily. Check whether `TaskScheduler`'s `{hour, minute, timezone}` shape can express "every 30 minutes" cleanly, or whether it needs a small, additive `intervalMinutes?: number` option alongside the existing daily-fire mode - **extend the existing interface minimally, do not fork a second scheduler class** to support a different cadence)
- `src/memory/migrations.ts` - add a `check_in_state` table (or reuse a small JSON-in-Postgres / Redis-hash approach if that's more consistent with how session state is already persisted - check `redis.ts` first) persisting `lastChecks`, `lastContactedAt`, and per-check rotation position

## Step-by-step

1. Confirm `03-daily-briefing.md`'s `TaskScheduler` exists. If it doesn't yet, this prompt cannot proceed meaningfully - note the dependency and stop rather than building a parallel scheduler (the cross-prompt sequencing note in that file's own "Dependencies" section already anticipates this).

2. Decide and document the cadence extension to `TaskScheduler` (the `intervalMinutes?` question above) - this is the one piece of shared-infrastructure design work this prompt adds back to the scheduler; keep it small and additive, and update `scheduled-tasks.test.ts` to cover the new mode without breaking the existing daily-fire tests.

3. Implement quiet hours and the speak-or-stay-quiet decision (`shouldStayQuiet`):
   - Hard quiet-hours window (23:00-08:00 local, per the spec - make it configurable, not hardcoded, since "local" depends on the user's `timezone` exactly as `portfolioBriefingTask` already handles)
   - "Less than 30 minutes since last check" and "less than 8 hours since last contact, and nothing urgent" are simple timestamp comparisons against `check_in_state`
   - "Something urgent" is a signal the individual checks must produce - define a simple shared shape each check returns, e.g. `{ urgent: boolean, summary: string | null }`, so the decision layer doesn't need to understand email/weather/git specifics, just "did any check report urgency"
   - Write this as a pure, easily-testable function: `shouldStayQuiet({ now, lastContactedAt, lastCheckAt, quietHours, urgentSignals }): boolean` - no I/O, no clock access beyond what's passed in (this is the function `vi.useFakeTimers()` tests will exercise heavily)

4. Implement the three real checks:
   - `email-check.ts`: query `inbound_emails` for messages since `lastChecks.email`, apply a simple urgency heuristic (the agent itself can judge urgency from subject/sender/snippet via an LLM call - don't hand-write a keyword list that will be wrong half the time; let the check produce candidate emails and have the agent's own reasoning, inside `buildCheckInPrompt`, decide what's urgent)
   - `weather-check.ts`: only runs if the user has set a location preference (check wherever user prefs are stored - if nowhere yet, that's a small new preference to add, or this check stays dormant until one exists; never guess a location)
   - `project-status-check.ts`: `git status --porcelain` + `git log -1` via `shell-exec` against a configured project path, **only when `source === 'cli'`** - assert this gate with a test that proves a gateway-sourced session never invokes it

5. Implement `buildCheckInPrompt(rotationState)`: rotates through 2-4 checks per cycle (per the spec's "rotate through checks, 2-4 times per day" - note this means not every check runs every cycle; track rotation position in `check_in_state`), gathers their structured results, and produces a prompt instructing the agent to: review what came back, decide what (if anything) is worth surfacing, and produce either a short message to the user or an explicit "nothing worth mentioning" signal. Push the urgency JUDGMENT into the agent's reasoning (it has the context to weigh "is this email actually urgent" far better than a hand-written heuristic), and use `shouldStayQuiet` only for the mechanical "is it appropriate to speak AT ALL right now" gate.

6. Wire memory maintenance: if `01-workspace-files.md` built `MEMORY.md`/daily-journal infrastructure, every few cycles (per the spec, "every few days") include a maintenance pass in the rotation - read recent daily files, ask the agent to propose `MEMORY.md` updates, write them via `file-write`. If that prompt's infrastructure doesn't exist yet, this step is a no-op for now - document it as deferred, don't build a second memory-file mechanism to unblock yourself.

7. Persist state (`recordCheckInState`/`loadCheckInState`) - decide Postgres-table vs. Redis-hash vs. JSON-file (the spec's own `memory/heartbeat-state.json` suggestion is plausible for self-hosted CLI mode where a real filesystem exists; for hosted gateway mode, Redis/Postgres is more consistent with how session state already lives). It is fine, and probably correct, for these to differ by mode - document the split rather than forcing one mechanism to serve both badly.

8. Write `check-in.test.ts` (Vitest, `vi.useFakeTimers()` where relevant):
   - `shouldStayQuiet` returns `true` during quiet hours unless `urgentSignals` contains an urgent item
   - `shouldStayQuiet` returns `true` when last-contact was under 8h and nothing urgent, `false` when over 8h regardless
   - Rotation advances correctly across cycles and wraps
   - `project-status-check` is never invoked for non-CLI sources (assert via a spy/mock)

## Expected behavior
- Roughly every 30 minutes (configurable), Carina runs a lightweight check-in cycle, rotating through whichever checks are actually configured and possible.
- During 23:00-08:00, it stays silent unless something is genuinely urgent.
- A self-hosted operator running the CLI against their own project occasionally hears "you have uncommitted changes from yesterday" or "I noticed an email from your letting agent that looked time-sensitive" - grounded in real data, never fabricated.
- A hosted SaaS tenant's check-in cycle never touches git, never claims to check a calendar or Twitter that isn't connected, and is upfront about what it can and can't currently monitor.

## Test
```bash
cd core.carinaai.uk
pnpm vitest run src/agents/check-in.test.ts src/agents/checks/
pnpm test
pnpm build
```
Manual check:
```bash
# Temporarily shorten the interval and quiet-hours window, run pnpm cli with a configured project path,
# make an uncommitted change, and confirm the next cycle surfaces it appropriately (and stays quiet when nothing's new).
```

## Dependencies
- `03-daily-briefing.md`'s `TaskScheduler` (hard prerequisite - this prompt extends it)
- `01-workspace-files.md`'s `MEMORY.md`/daily-journal infrastructure, for the memory-maintenance rotation step (degrades gracefully to "deferred" if absent)
- A documented product decision before calendar/social-mentions checks can be built (new integrations, new credentials, new scope - not in reach of a skill-porting prompt)
- `inbound_emails` table and `email-webhook.ts` (already exist) for the email check
