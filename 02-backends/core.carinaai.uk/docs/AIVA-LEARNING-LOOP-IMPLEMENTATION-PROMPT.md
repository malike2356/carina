# Aiva Learning Loop Implementation Prompt

## Goal

Build Aiva so every Aiva worker behaves like a capable workspace employee from any connected channel. Aiva must know its current workspace capabilities, use tools before claiming it cannot act, remember useful facts across channels, learn from repeated failures, and expose what it learned to the workspace owner for approval or removal.

## Product Requirements

1. Workspace control from any channel
   - Aiva sessions from Telegram, web chat, email, Slack, WhatsApp, and other worker channels must receive the full workspace tool catalog.
   - Keep the existing security boundary: do not expose shell, terminal process execution, or offensive security tools to end-user Aivas.
   - Aiva must have live capability introspection tools, especially `tool_status` and `list_live_capabilities`.
   - Prompting must tell Aiva to use available tools before saying it cannot do a task.

2. Persistent cross-channel conversation
   - The same Aiva worker must continue one conversation across channels.
   - Switching from Telegram to workspace chat or email must not make Aiva re-introduce itself or lose recent context.
   - Existing per-channel memory should be recoverable as fallback history.

3. Aiva Learning Loop
   - After every Aiva turn, detect durable facts, preferences, decisions, and lessons.
   - Store high-confidence lessons automatically into worker memory with strict limits.
   - Detect repeated tool failures and save an operating note such as "When X fails, do Y next time".
   - Add a daily review job that compresses recent conversations into clean long-term memory.
   - Add owner-facing review controls so the owner can approve, remove, or inspect what Aiva learned.

## Suggested Architecture

Backend core app: `carina/verlox/carina/02-backends/core.carinaai.uk`

Key files already involved:

- `src/tools/session-tool-resolution.ts`
  - Aiva workspace sessions should resolve all workspace toolsets except blocked security toolsets.

- `src/tools/toolset.ts`
  - `ALWAYS_ON_TOOLS` should include `tool_status` and `list_live_capabilities`.

- `src/workers/aiva-process-message.ts`
  - Use the shared Aiva session ID helper.
  - Register product, memory, automation, capability, and workspace tools before capability manifest generation.
  - Add workspace action prompt guidance.
  - Trigger learning extraction after each completed response.

- `src/memory/aiva/memory-commands.ts`
  - `aivaSessionId(workerId, channel, contactId)` should return a worker-wide session such as `aiva-{workerId}-workspace-owner`.

- `src/memory/aiva/conversation-bridge.ts`
  - Recover current-session history, current employee thread history, and older per-channel Aiva history.

New or expanded backend files:

- `src/memory/aiva/learning-loop.ts`
  - Owns schema, learning extraction heuristics, pending learning queue, daily review, and owner actions.

- `src/api/aiva-learning-api.ts`
  - Exposes list/approve/remove endpoints for owner review.

- `src/cli/commands/aiva-learning-cli.ts`
  - Adds daily review/backfill/manual commands.

Frontend app: `carina/verlox/carina/03-frontends/client-apps/app.carinaai.uk`

Suggested UI:

- Add an "Aiva learned" or "Learning" panel in the Aiva worker detail screen, preferably near Training/Oversight.
- Show pending learned items with type, confidence, source channel, and text.
- Add Approve and Remove buttons.
- Show recent approved memory items and budget status.

## Data Model

Create table `aiva_learning_items`:

- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `workspace_id UUID NOT NULL`
- `worker_id UUID NOT NULL REFERENCES ai_workers(id) ON DELETE CASCADE`
- `contact_id TEXT`
- `channel TEXT`
- `kind TEXT NOT NULL CHECK (kind IN ('fact','preference','decision','lesson','tool_failure'))`
- `content TEXT NOT NULL`
- `confidence NUMERIC(4,3) NOT NULL DEFAULT 0.75`
- `status TEXT NOT NULL CHECK (status IN ('pending','approved','removed','auto_saved')) DEFAULT 'pending'`
- `source_session_id TEXT`
- `source_message TEXT`
- `metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `reviewed_at TIMESTAMPTZ`
- `reviewed_by TEXT`
- Unique guard to reduce duplicates, for example `(workspace_id, worker_id, kind, md5(content))` if supported.

When an item is approved or auto-saved:

- Save `kind=fact/preference/decision` to `worker-memory` target `user` when it is about the contact or owner.
- Save `kind=lesson/tool_failure` to `worker-memory` target `memory`.
- Enforce existing `worker-memory` budgets.
- Do not save private secrets, raw credentials, API keys, passwords, full email bodies, or transient task logs.

## Learning Extraction Rules

Use a conservative deterministic extractor first:

- Preference:
  - User says "I prefer...", "always...", "do not...", "call me...", "my preferred..."
- Decision:
  - User says "we agreed...", "decided...", "approved...", "go with...", "use X from now on..."
- Durable fact:
  - User says "remember...", "keep in mind...", "note that...", or shares stable company/process info.
- Lesson:
  - Assistant says it had to adjust approach, or user corrects behavior.
- Tool failure:
  - Repeated failures recorded by `recordToolFailure`.

Use strict limits:

- Max 3 learned items per turn.
- Max content length around 280 characters.
- Minimum confidence for auto-save: 0.86.
- Pending review for confidence below auto-save threshold.
- Drop items that look like one-off tasks, temporary schedule details, secrets, tokens, or credentials.

## Daily Review Job

Add a command such as:

```bash
pnpm carina aiva-learning review --workspace <workspaceId> --worker <workerId>
pnpm carina aiva-learning review-all
```

Behavior:

- Read recent Aiva conversation history per worker.
- Extract durable lessons and memory candidates.
- Deduplicate against existing learning items and persistent memory.
- Auto-save high-confidence items.
- Leave lower-confidence items pending for owner review.
- Return counts: scanned, candidates, autoSaved, pending, skipped.

If a scheduler system exists, register a daily job hook. If not, add the CLI and document the cron command.

## Owner Review API

Suggested endpoints:

- `GET /api/aiva/workers/:id/learning`
  - Returns pending, auto-saved, approved, removed, and memory budget status.

- `POST /api/aiva/workers/:id/learning/:learningId/approve`
  - Approves item and saves to worker memory.

- `POST /api/aiva/workers/:id/learning/:learningId/remove`
  - Marks item removed.

- `POST /api/aiva/workers/:id/learning/review`
  - Runs a manual review for that worker.

All endpoints must enforce workspace ownership and worker ownership.

## Validation

Run from `02-backends/core.carinaai.uk`:

```bash
pnpm exec vitest run src/memory/aiva/conversation-bridge.test.ts src/memory/aiva/learning-loop.test.ts src/tools/session-tool-resolution.test.ts
pnpm exec tsc --noEmit
```

Run frontend typecheck/build if UI files changed.

From repo root, respect writing style:

```bash
python3 scripts/fix-writing-style.py
python3 - <<'PY'
from pathlib import Path
bad = [chr(0x2014), chr(0x2013)]
for path in [Path(p) for p in "<changed-files>".split()]:
    text = path.read_text(errors="ignore")
    if any(ch in text for ch in bad):
        print(path)
PY
```

The full style fixer may be slow in this repo. If it times out, report that and run the targeted scan on changed files.

## Deployment

Sync only changed source files to `/home/malike/apps/core.carinaai.uk/`, rebuild and restart `carina-web`, then verify:

```bash
curl -fsS https://core.carinaai.uk/health
```

If frontend files change, build and deploy `app.carinaai.uk` using the existing deployment flow.

## Acceptance Test

1. In Telegram, tell an Aiva: "Remember that I prefer client onboarding summaries in bullet points and always include next actions."
2. In workspace chat, ask: "What did I ask you to remember?"
3. Aiva should answer from memory or recent cross-channel context.
4. Ask Aiva to perform a workspace action. It should use tools or explain the exact missing connection.
5. Open the worker learning panel. The new preference should be visible as auto-saved or pending review.
6. Approve/remove a learned item and confirm the durable memory status updates.
