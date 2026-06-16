# Prompt: Fix delegate-task Batch Failure Isolation

## What to fix

`src/tools/delegate-task.ts` has a confirmed bug: when running a batch of tasks via `runWithConcurrency`, one failing subagent crashes the entire batch. Tasks that completed successfully return nothing. The root cause is that the worker loop does not catch per-task errors.

Gap analysis reference: Section D, `tool-16-delegate-task.md` - "Batch failure isolation; add 4 tests".

Note: clarify and session-search (previously in this prompt slot) are ALREADY FIXED. `getPendingClarification` is wired in `carina.ts` (lines 29, 177-188), the turn loop break is in place (lines 370-494), and both test files exist with full coverage.

## What already exists - read before touching anything

- `src/tools/delegate-task.ts` - the file to fix. The batch path is in the `execute` function around line 155 (the `if (input.tasks && input.tasks.length > 0)` branch).
- `src/agents/delegation-context.ts` - read only.
- `src/agents/generic-sub-agent.ts` - read only.
- `src/tools/delegate-task.test.ts` - existing tests (138 lines). Do not remove any.

## The bug

In `runWithConcurrency`, the inner loop is:

```typescript
results[idx] = await fn(items[idx], idx); // if this throws, the whole batch dies
```

`fn` calls `runSingleTask` which can throw for: subagent `agent.run()` rejection, workdir resolution failure, toolset validation error, DB error. When it throws, the worker Promise rejects, `Promise.all(workers)` rejects, and the entire batch call returns an error with zero task results.

## The fix

Wrap the per-task call in a try/catch inside the worker, so one failing task records an error string and the remaining tasks continue:

```typescript
async function runWithConcurrency<T>(
  items: T[],
  fn: (item: T, index: number) => Promise<string>,
): Promise<string[]> {
  const results: string[] = new Array(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const idx = nextIndex++;
      try {
        results[idx] = await fn(items[idx], idx);
      } catch (err) {
        results[idx] = `Error: ${err instanceof Error ? err.message : String(err)}`;
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(MAX_CONCURRENT_SUBAGENTS, items.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
}
```

No other file needs changing.

## Tests to add in delegate-task.test.ts

Add 4 new tests (do not remove existing ones):

1. **Partial batch failure**: 3-task batch where the second task throws - results array has the first task's success string, an `Error: ...` string for the second, and the third task's success string. Batch call does not throw.

2. **All fail**: All tasks throw - results array has 3 `Error: ...` strings. Batch call returns `{ mode: 'batch', taskCount: 3, results: [...] }` without throwing.

3. **All succeed**: Smoke test that the fix did not break the happy path - 2 tasks both return strings, batch call returns both results.

4. **Error string format**: When a task throws `new Error('subagent crashed')`, the result entry is exactly `'Error: subagent crashed'`.

## Run after fixing

```bash
cd core.carinaai.uk
pnpm vitest run src/tools/delegate-task.test.ts
pnpm test
pnpm build
```
