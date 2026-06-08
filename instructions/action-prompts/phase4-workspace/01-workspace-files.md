# Action: Workspace Context Files - Scope to Self-Hosted CLI Mode Only (Standalone Carina)

## Goal
Port the useful core of this spec - auto-loading markdown context files (`AGENTS.md`, `SOUL.md`, `IDENTITY.md`, `USER.md`, `MEMORY.md`, daily journals) at session start - but scope it correctly: this concept fits Carina's **self-hosted CLI mode** (`~/.carina/`, one operator, real filesystem access), and does NOT fit Carina's **hosted multi-tenant gateway mode** (Telegram/WhatsApp/web sessions from external customers, who have no filesystem and whose data must stay isolated per-tenant in Postgres, not commingled in shared markdown files).

## Context
- Project: `core.carinaai.uk`. Node.js 22 + TypeScript 5, ESM imports, pnpm, Vitest.
- **The spec is written for "OpenClaw"** (its own words: "Port OpenClaw's workspace file system") - a different, CLI-native personal-assistant product where one user runs one agent against one filesystem "workspace" (their project directory or home folder). Carina runs in TWO modes that this spec conflates:
  1. **Self-hosted CLI** (`bin/carina.ts` -> `pnpm cli`): one operator, real `~/.carina/` home directory (`CARINA_HOME` in `src/config/paths.ts` - confirmed: `CARINA_DATA_DIR`, `CARINA_PACKS_DIR` already live there). This is the deployment mode where "workspace files" make complete sense - it's structurally identical to what the spec describes, just rooted at `CARINA_HOME` instead of an arbitrary cwd.
  2. **Hosted multi-tenant gateway** (`src/gateway/{telegram,whatsapp,web}.ts` + `router.ts`): many external users, each mapped to a Redis-backed `sessionId`, served by one running Carina process. There is no per-user filesystem here, and there must not be - a `MEMORY.md` or `USER.md` written to a shared directory would either (a) not exist (no fs access for remote users) or (b) catastrophically leak one tenant's data into another's context if implemented naively. **Do not build a version of this that loads workspace files for gateway-routed sessions.**
- Read `bin/carina.ts`, `src/config/paths.ts`, and `src/gateway/router.ts`/`cli.ts` in full to confirm exactly where the CLI-vs-gateway branch happens (`router.getAgent` already takes a `source: CarinaMessage['source']` - `'cli' | 'telegram' | 'whatsapp' | 'web'` per `types/index.ts` - that's your hook for "only do this in CLI mode").
- **Reframe the file set for what Carina actually is** (an autonomous property-AI agent, not a generic personal assistant):
  - `AGENTS.md` -> operator-level rules/conventions for this Carina installation (kept, same idea, same name - this one translates directly)
  - `SOUL.md`/`IDENTITY.md` -> Carina already HAS a persona defined in its system prompt (`src/agents/carina.ts`'s `systemPromptSuffix` mechanism, `src/brain/messages.ts`). Read those before adding a second persona-definition mechanism - if Carina's personality is already baked into its system prompt as a product decision (likely, since "Carina" is a branded product with a consistent voice across all customers), then a per-installation `SOUL.md`/`IDENTITY.md` override is a genuinely new feature ("let operators customise Carina's voice for their own self-hosted instance") - flag this as a product decision to confirm, not an assumed requirement. Don't silently let a markdown file override branded product personality.
  - `USER.md` -> overlaps with the `memory`/user-profile target from `08-memory-session.md` (if built) - a markdown file AND a Postgres `user`-target memory entry would be two competing sources of truth for "who is this person." Pick one. The Postgres-backed approach is more consistent with how Carina already stores per-session user context; recommend `USER.md` be reframed as "an operator can hand-author durable facts here, which get folded into the same `user`-target memory store at load time" rather than a parallel mechanism.
  - `TOOLS.md` -> Carina already configures tools via `.env`/`config/index.ts` with conditional registration (`if (config.X.apiKey) { registry.register(...) }`). A `TOOLS.md` that duplicates this as free-text notes risks drifting out of sync with the actual config. Narrow its scope to "operator notes ABOUT tools" (e.g. "the email tool is configured to send from address X, be careful with Y"), not tool configuration itself.
  - `BOOTSTRAP.md` -> genuinely useful, ports cleanly: first-run self-configuration, delete-on-completion. This is a good fit for `ensureCarinaHome`/`runSetupWizard` (`src/setup/wizard.ts`) - check whether it makes more sense to fold into the existing setup wizard than to run as a session-start agent action.
  - `MEMORY.md` + `memory/YYYY-MM-DD.md` -> this is the one piece of real, new, valuable infrastructure here: a curated long-term file plus raw daily journals, distinct from (and complementary to) the `episodic_memories` Postgres store. Build this for real - it gives the self-hosted operator a human-readable, git-diffable view of what their agent has learned, which a vector database does not.

## Files to create
- `src/workspace/context-files.ts` - `loadWorkspaceContext(homeDir: string): Promise<string[]>` - reads whichever of `AGENTS.md`/`SOUL.md`/`IDENTITY.md`/`USER.md`/`TOOLS.md`/`MEMORY.md` exist under `homeDir`, returns an ordered array of context strings ready to feed into `systemPromptSuffix`-style composition
- `src/workspace/bootstrap.ts` - `runBootstrapIfPresent(homeDir: string): Promise<boolean>` - checks for `BOOTSTRAP.md`, if present runs its instructions as a one-shot agent task, deletes the file on success, returns whether it ran
- `src/workspace/daily-journal.ts` - `appendToDailyJournal(homeDir, entry)`, `getTodaysJournalPath(homeDir)`, `loadTodaysJournal(homeDir)`
- `src/workspace/context-files.test.ts`, `src/workspace/daily-journal.test.ts`

## Files to modify
- `src/gateway/cli.ts` - on session start (when `source === 'cli'`), call `loadWorkspaceContext(CARINA_HOME)` and `runBootstrapIfPresent(CARINA_HOME)`, feed results into the orchestrator's system prompt composition (trace exactly how `systemPromptSuffix` flows from `cli.ts` -> `router.ts` -> `CarinaOrchestrator` -> `CarinaAgent` before wiring this in - do not bypass the existing composition mechanism with a second one)
- `src/agents/orchestrator.ts` or wherever session-end / idle-detection lives - hook `appendToDailyJournal` to write a daily summary (this is naturally related to whatever `02-heartbeat.md` builds for "memory maintenance during idle time" - sequence-check against that prompt; the journal-writing trigger may belong to the heartbeat/maintenance cycle rather than every session end)

## Step-by-step

1. Confirm the CLI-vs-gateway routing hook (`message.source`) and verify that workspace-file loading can be cleanly gated on `source === 'cli'` without leaking into gateway sessions. Write a test that asserts a `telegram`-sourced session never triggers `loadWorkspaceContext`.

2. Implement `loadWorkspaceContext`: read each file from `CARINA_HOME` (default) or a configurable `--workspace <dir>` CLI flag if one is wanted (check `bin/carina.ts`'s arg parsing - the spec's "workspace" concept may be worth exposing as an explicit flag rather than always defaulting to `~/.carina`, since a developer might want to point Carina at a project directory). Missing files are simply skipped - this must be additive and silent-by-default, exactly as the spec states ("auto-load is additive").

3. Implement `runBootstrapIfPresent`: read `BOOTSTRAP.md` if present, run its numbered instructions as a single agent turn (reuse the orchestrator's existing turn mechanism - this is not a new execution path, just a new trigger for the existing one), delete the file only after the turn completes successfully (if it fails partway, leave the file - a half-completed bootstrap that silently deletes its own instructions is worse than one that runs again next time).

4. Implement the daily journal functions as plain `fs` operations against `CARINA_HOME/memory/YYYY-MM-DD.md` (use the local date, not UTC - an operator's "today" should match their wall clock).

5. Resolve the `USER.md`-vs-Postgres-user-memory overlap (flagged above) explicitly: either (a) make `USER.md` purely operator-authored and fold its content into the `user`-target memory store at load time (single source of truth, file is just an editable seed), or (b) keep them separate with a clearly documented distinction (e.g. `USER.md` = "facts the operator wrote about themselves," Postgres `user` memory = "facts Carina learned and wrote about the operator"). Pick one, document why, and make sure `08-memory-session.md`'s `memory` tool (if built) and this mechanism don't silently fight over the same context slot.

6. Resolve the `SOUL.md`/`IDENTITY.md`-vs-branded-persona question (flagged above) by reading `src/agents/carina.ts` and `src/brain/messages.ts` - if Carina's voice is a deliberate brand decision, surface "should self-hosted operators be able to override Carina's personality?" as a product question rather than assuming yes.

7. Write the verification exactly as the spec describes, adapted to the real paths:
   ```bash
   mkdir -p /tmp/test-carina-home
   echo "# AGENTS.md\n\n## Red Lines\n- Don't run destructive commands without asking" > /tmp/test-carina-home/AGENTS.md
   CARINA_HOME=/tmp/test-carina-home pnpm cli
   # Confirm AGENTS.md content appears in the system prompt / influences agent behaviour
   ```

## Expected behavior
- Running `pnpm cli` with an `AGENTS.md` present in `CARINA_HOME` produces an agent that visibly follows its rules ("don't run destructive commands without asking" actually changes behaviour, testably).
- A `telegram`/`whatsapp`/`web`-sourced session never reads or writes any workspace file - confirmed by a passing isolation test, not just by code review.
- `BOOTSTRAP.md` runs once, self-deletes on success, and is idempotent-safe if it fails partway.
- `MEMORY.md` and daily journal files are real, human-readable, git-diffable markdown an operator can open and read - genuinely new value Postgres-only storage doesn't provide.

## Test
```bash
cd core.carinaai.uk
pnpm vitest run src/workspace/
pnpm test
pnpm build
```
Manual check: the `mkdir`/`echo`/`CARINA_HOME=... pnpm cli` sequence above, run twice (once to prove bootstrap runs and deletes itself, once to prove it doesn't run again).

## Dependencies
- `08-memory-session.md`'s `memory` tool, if it exists, for resolving the `USER.md` overlap question in step 5
- `02-heartbeat.md`, for deciding whether daily-journal writing is triggered by session-end or by the maintenance cycle (sequence-check both ways; whichever runs first should leave a clear seam for the other)
- No new external dependencies (plain `fs/promises`, already-imported `path`)
