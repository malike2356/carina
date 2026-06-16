# Action: Scheduled Briefing Delivery (New Generic Feature, Standalone Carina)

## Goal
Build a generic scheduled-task mechanism that lets Carina proactively send a message (e.g. a daily briefing) to a user on a recurring schedule, then use it to deliver a portfolio-style briefing for users running the property-uk skill pack.

## Context
- Project: `core.carinaai.uk`. Node.js 22 + TypeScript 5, ESM imports, pnpm, Vitest.
- This is a genuine gap reframed from a Propreneur-specific spec. The original spec described a Laravel `CarinaScheduledAgentService` hardcoded to property data (portfolio summary, compliance, rent arrears - none of which exist in standalone Carina's domain). Two real things need building:
  1. A **generic scheduler** in core - nothing like it exists today (`grep -rn 'node-cron\|setInterval' src/` shows only heartbeat/session-GC intervals, no recurring user-facing task system)
  2. A **property-uk skill** that defines what a portfolio briefing should contain - this belongs in `src/skills/packs/property-uk/`, NOT in core, because a generic Carina instance with no property pack installed has nothing to brief about
- Read these first:
  - `src/index.ts` - startup sequencing, `heartbeatInterval = setInterval(() => void reportHeartbeat(), 60_000)` is the existing precedent for a recurring background task
  - `src/gateway/router.ts` - `GatewayRouter.handle(message: CarinaMessage): AsyncGenerator<string>` is how you get the agent to actually produce a reply; `getSession`/`gcTimer` show the session lifecycle and timer-cleanup pattern (`clearInterval` on shutdown)
  - `src/skills/packs/property-uk/skills.ts` - the `Skill` shape (`name`, `description`, `trigger`, `steps`, `toolsUsed`) and how skills are plain data, not code
  - `src/skills/packs/property-uk/prompts/system.ts` - how pack-specific prompt content is exported as a template string constant
  - `src/types/index.ts` - `CarinaMessage`, `Skill` interfaces
  - `04-tts-delivery.md` (this same directory) - the `generateSpeech`/`sendSpokenReply` helpers this feature should optionally use for audio delivery
- Conventions: functions under ~20 lines, no comments unless explaining non-obvious WHY, Vitest, no em dashes/emojis, `.js` import specifiers.

## Files to create
- `src/agents/scheduled-tasks.ts` - the generic scheduler (registry + runner + persistence)
- `src/agents/scheduled-tasks.test.ts`
- `src/skills/packs/property-uk/briefing.ts` - the portfolio-briefing task definition (prompt template + schedule defaults), exported for the scheduler to pick up when the pack is installed

## Files to modify
- `src/index.ts` - start the scheduler alongside the other gateways
- `src/memory/migrations.ts` - add a `scheduled_tasks` table if persistence is needed (see step 2 - decide before assuming)
- `src/skills/packs/property-uk/pack.json` - bump `skillCount` if you add the briefing as a registered skill

## Step-by-step

1. Design the generic scheduler's shape FIRST, before writing code. A scheduled task needs: an identifying `slug`, a `cron`-like schedule (or simpler: `{ hour: number, minute: number, timezone: string }` for a single daily run - simpler is better here, do not pull in a cron-expression parser for "once a day at a configured time"), a `buildPrompt(context): string` function that produces the message to send to the agent, and a `deliver(output, context)` function that decides where the result goes (Telegram text, Telegram audio via `sendSpokenReply`, web, etc).

2. Decide on persistence: does a scheduled task need to survive a process restart with per-user enable/disable state? If `getRouter()`/sessions are already backed by Redis/Postgres (`src/memory/db.ts`, `src/memory/redis.ts`), prefer storing user opt-in/schedule-time preferences there (a small `scheduled_task_prefs` table or a Redis hash) rather than inventing a new persistence layer. If there is currently no concept of a "user" distinct from a Telegram chat ID / session, that is itself a real architectural gap worth documenting rather than working around with a hack - note it plainly in your completion summary rather than building a parallel user system.

3. Implement `src/agents/scheduled-tasks.ts`:
   - `interface ScheduledTask { slug: string; hour: number; minute: number; timezone: string; buildPrompt: () => string | Promise<string>; }`
   - `class TaskScheduler` with `register(task: ScheduledTask, deliverTo: (output: string) => Promise<void>): void`, `start(): void`, `stop(): void`
   - Internally, use a single `setInterval` that ticks every minute (mirror `heartbeatInterval`'s 60_000ms pattern - do not spawn one timer per task) and checks each registered task's `{hour, minute}` against the current time in its `timezone` (use `Intl.DateTimeFormat` with the `timeZone` option - do not add a timezone library dependency for this)
   - Guard against double-firing within the same minute (track `lastRunDate` per task as a `YYYY-MM-DD` string keyed by slug)
   - When a task fires: build the prompt, route it through `getRouter().handle({ ...syntheticMessage, source: 'scheduled' })` to get the agent's response (collect the async generator into a single string), then call the registered `deliverTo` callback
   - Wrap the entire fire-and-deliver sequence in `try/catch` - a failing scheduled task must log and continue, never crash the process or block the next tick (mirror the "Scout never blocks Carina" fire-and-forget philosophy already documented in `ARCHITECTURE.md`)

4. Implement `src/skills/packs/property-uk/briefing.ts`:
   - Export `portfolioBriefingTask: Omit<ScheduledTask, 'buildPrompt'> & { buildPrompt: () => string }` with a sensible default time (e.g. `{ hour: 7, minute: 30, timezone: 'Europe/London' }`)
   - `buildPrompt()` returns a prompt instructing Carina to compile a portfolio briefing covering: rent/arrears status, maintenance items, compliance deadlines, recent relevant emails, and anything needing attention - phrased as an instruction for Carina to use ITS OWN tools (web-search, email-list, file-read, whatever the user's setup provides) to gather real data, NOT as a call to property-management APIs that don't exist in standalone Carina. The prompt should explicitly tell Carina to say "I don't have access to X" rather than fabricate numbers it cannot verify - this is critical: a briefing with invented figures is worse than no briefing.
   - Format guidance in the prompt: short sections (Rent / Maintenance / Compliance / Activity / Needs attention), plain language suitable for both reading and being read aloud by TTS

5. Wire delivery: in `src/index.ts` (or a small glue module), register `portfolioBriefingTask` with the scheduler ONLY when the property-uk pack is active (check however packs are currently detected as installed - search `src/skills/index.ts` / `src/setup/install-pack.ts` for the activation mechanism). The `deliverTo` callback should send the text via the user's configured channel (Telegram if `config.telegram.botToken` is set) and, if a `tts` preference is enabled, also call `sendSpokenReply` from `04-tts-delivery.md`'s deliverable - wrap the audio call so its failure never blocks the text delivery (`Promise.allSettled` or sequential try/catch, text first).

6. Add `scheduler.start()` / `scheduler.stop()` to `src/index.ts`'s `main()`/`shutdown()` lifecycle, mirroring exactly how `heartbeatInterval` is created in `main()` and cleared in `shutdown()`.

7. Write `src/agents/scheduled-tasks.test.ts` (Vitest, use `vi.useFakeTimers()`):
   - Test a task registered for `{hour: 7, minute: 30}` fires when the mocked clock crosses that time and not before/after
   - Test a task does not double-fire within the same minute or on a re-check within the same day
   - Test a thrown error inside `buildPrompt`, `router.handle`, or `deliverTo` is caught, logged, and does not stop the scheduler from ticking again
   - Test `stop()` clears the interval (no further fires after stopping)

## Expected behavior
- At the configured local time each day, a user with the property-uk pack active and Telegram connected receives a briefing message built from Carina's own live tool calls (not fabricated data).
- If TTS is enabled for that user, an audio version follows (best-effort, never blocks text delivery).
- A user without the property-uk pack installed sees no briefing-related behavior at all - the feature is fully opt-in via pack activation.
- The scheduler survives a single failed run without crashing or skipping subsequent days.

## Test
```bash
cd core.carinaai.uk
pnpm vitest run src/agents/scheduled-tasks.test.ts
pnpm test
pnpm build
```
Manual check:
```bash
# Temporarily set the task's {hour, minute} to a few minutes from now, start Carina, and watch logs / Telegram for the briefing to fire.
```

## Dependencies
- `02-telegram-bot.md` must be verified working (briefing delivery depends on `bot.sendMessage`)
- `04-tts-delivery.md` must be built (optional audio delivery depends on `generateSpeech`/`sendSpokenReply`)
- `getRouter()` initialized and able to produce agent responses outside of a live user message (confirm `router.handle` works with a synthetic `source: 'scheduled'` message - if it assumes a real external user/session, you may need a small adjustment there; keep it minimal)
- property-uk pack installed and active for the user (or whatever pack-activation check you find in step 5)
