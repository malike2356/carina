# Prompt: Fix cronjob Tool Error Handling

## What to fix

`src/tools/cronjob.ts` has unhandled promise rejections on several action branches. The `run` action's `executeJob` call can throw for many reasons (script path blocked, non-zero exit, workdir failure, agent crash, DB error) but has no try/catch, so the error propagates as an unhandled rejection from `execute` instead of returning `{ error: string }`. The same problem exists in `listJobs`, `updateJob`, and `removeJob`.

Gap analysis reference: Section D, `tool-22-cronjob.md` - "Wrap async calls in try/catch; add 9 tests".

Note: the terminal tool (`shell.ts`) and file tools (`file.ts`, `patch.ts`, `search-files.ts`) mentioned in the previous version of this prompt are ALREADY COMPLETE:
- `shell.ts` already has `workdir`, `background`, `pty`, `CARINA_DIRECT_SHELL`, and a 50KB output cap (`MAX_OUTPUT_BYTES = 50 * 1024`).
- `file.ts` already has line-numbered pagination with `offset`/`limit` and syntax checking via `file-syntax.ts`.
- `patch.ts` already has fuzzy matching (CRLF normalisation, whitespace trim, tab-to-spaces).
- `search-files.ts` already has ripgrep probe with grep fallback.
- `file.ts` already has `levenshteinDistance` and `suggestSimilarFiles` for "not found" errors.

Do NOT rebuild any of those.

## What already exists - read before touching anything

- `src/tools/cronjob.ts` - the only file to change.
- `src/agents/cron-scheduler.ts` - read only; understand what `listJobs`, `executeJob`, `updateJob`, `removeJob` can throw.
- `src/agents/cron-delivery-registry.ts` - read only.
- `src/tools/cronjob.test.ts` - existing tests (172 lines). Do not remove any.

## The specific unhandled paths

Read the action prompt at `instructions/action-prompts/tool-22-cronjob.md` for the full list. The primary cases:

1. **`run` action**: `executeJob(jobId)` throws on script error, agent failure, workdir issue, DB error. Wrap in try/catch returning `{ error: message }`.

2. **`list` action**: `listJobs()` can throw on DB error. Wrap in try/catch.

3. **`update` action**: `updateJob(jobId, changes)` can throw on invalid cron expression, DB error, or unknown jobId. Wrap and return `{ error }`.

4. **`remove` action**: `removeJob(jobId)` can throw on DB error. Wrap and return `{ error }`.

5. **`status` action** (if present): Any DB query can throw. Wrap.

The pattern to follow is identical to the existing try/catch blocks already in `cronjob.ts` (lines 69, 89, 116, 143, 169, 178, 187, 198 - these are correctly wrapped). Apply the same pattern to the branches that are missing it.

## Tests to add in cronjob.test.ts (action prompt specifies 9)

Add tests covering error cases that currently have no coverage (do not remove existing tests):

1. `run` action: `executeJob` throws - execute returns `{ error: '...' }`, does not throw.
2. `run` action: jobId not found - returns `{ error: 'Job not found.' }`.
3. `list` action: DB throws - returns `{ error: '...' }`, does not throw.
4. `update` action: invalid cron expression - returns `{ error: '...' }`.
5. `update` action: `updateJob` throws - returns `{ error: '...' }`.
6. `remove` action: `removeJob` throws - returns `{ error: '...' }`.
7. `remove` action: jobId not found - returns `{ error: '...' }`.
8. Error return shape: all error returns are `{ error: string }`, not thrown exceptions.
9. Regression: an existing happy-path test still passes after the changes (pick any from the existing 172-line test file).

## Run after fixing

```bash
cd core.carinaai.uk
pnpm vitest run src/tools/cronjob.test.ts
pnpm test
pnpm build
```
