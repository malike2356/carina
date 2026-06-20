# Cursor Task: Fix and improve delegate-task (#16) tool in Carina

## Context

Carina is a Node.js/TypeScript autonomous AI agent at:
`/opt/lampp/htdocs/verlox/carina/core.carinaai.uk/`

We are hardening the 27 Hermes tools one by one. Tools #10-15 and #18-21 are
confirmed working. This task covers tool #16: `delegate-task`.

Read these files in full before touching anything:
- `src/tools/delegate-task.ts` (main file to change)
- `src/agents/delegation-context.ts` (read only, do not change)
- `src/agents/generic-sub-agent.ts` (read only, do not change)
- `src/agents/sub-agent.ts` (read only, do not change)
- `src/tools/toolset.ts` (read only, do not change)
- `src/tools/delegate-task.test.ts` (existing tests - do not remove any)

Do NOT modify any file except `src/tools/delegate-task.ts` and
`src/tools/delegate-task.test.ts`.

---

## Bug: one failing subagent crashes the entire batch

In `runWithConcurrency`, if the `fn` callback throws (e.g. the subagent's
`agent.run()` rejects), the worker promise rejects. `Promise.all(workers)`
then rejects and the entire batch fails - even tasks that completed
successfully return nothing.

The root cause is in this pattern inside the worker loop:
```typescript
results[idx] = await fn(items[idx], idx); // throws -> kills whole batch
```

### Fix: catch per-task errors inside the concurrency worker

Change `runWithConcurrency` so each task is wrapped in its own `.catch`:

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

---

## Improvement: update the tool description

Replace the current `delegate-task` description with:

```
'Spawn isolated subagents to run tasks in parallel. Use when a task has genuinely independent sub-parts that can run concurrently. Single mode: provide goal + optional context and toolsets. Batch mode: provide a tasks array (up to 3 run concurrently, queue beyond that). The parent receives only the final summary from each subagent - intermediate tool calls are invisible. Subagents cannot use delegate-task, memory, clarify, todo, email, or cron. Pick toolsets from: terminal, file, web, browser, search, media. Default toolsets when omitted: terminal, file, web. Do not delegate when a single-turn answer suffices.'
```

---

## Tests to ADD in `src/tools/delegate-task.test.ts`

Do not remove any of the 5 existing tests. Add these inside
`describe('delegate-task tool', ...)`:

**Test: empty goal without tasks returns error**

```typescript
it('returns error when goal and tasks are both absent', async () => {
  const tool = createDelegateTaskTool(sessionId);
  const result = await tool.execute({ _sessionId: sessionId }) as { error?: string };
  expect(result.error).toContain('goal or tasks is required');
});
```

**Test: one failing batch task returns error string; others succeed**

```typescript
it('isolates failures - one bad batch task does not kill others', async () => {
  let callCount = 0;
  runMock.mockImplementation(async () => {
    callCount++;
    if (callCount === 2) throw new Error('subagent exploded');
    return 'ok';
  });

  const tool = createDelegateTaskTool(sessionId);
  const result = await tool.execute({
    tasks: [
      { goal: 'task A', toolsets: ['terminal'] },
      { goal: 'task B', toolsets: ['terminal'] },
      { goal: 'task C', toolsets: ['terminal'] },
    ],
    _sessionId: sessionId,
  }) as { results: string[] };

  expect(result.results).toHaveLength(3);
  const errorTask = result.results.find((r) => r.startsWith('Error:'));
  expect(errorTask).toBeDefined();
  const successTasks = result.results.filter((r) => r === 'ok');
  expect(successTasks).toHaveLength(2);
});
```

**Test: batch mode rejects leaf tool in individual task**

```typescript
it('rejects leaf tool in a batch task and returns error in results', async () => {
  const tool = createDelegateTaskTool(sessionId);
  const result = await tool.execute({
    tasks: [
      { goal: 'task A', toolsets: ['terminal'] },
      { goal: 'task B', toolsets: ['clarify'] },
    ],
    _sessionId: sessionId,
  }) as { results: string[] };

  expect(result.results[0]).toBe('subagent summary');
  expect(result.results[1]).toContain('Error');
});
```

**Test: concurrency capped at MAX_CONCURRENT_SUBAGENTS**

```typescript
it('runs at most MAX_CONCURRENT_SUBAGENTS tasks simultaneously', async () => {
  const tool = createDelegateTaskTool(sessionId);
  const result = await tool.execute({
    tasks: [
      { goal: 'task 1', toolsets: ['terminal'] },
      { goal: 'task 2', toolsets: ['terminal'] },
      { goal: 'task 3', toolsets: ['terminal'] },
      { goal: 'task 4', toolsets: ['terminal'] },
      { goal: 'task 5', toolsets: ['terminal'] },
    ],
    _sessionId: sessionId,
  }) as { taskCount: number; concurrency: number; results: string[] };

  expect(result.taskCount).toBe(5);
  expect(result.concurrency).toBe(3);
  expect(result.results).toHaveLength(5);
});
```

---

## What NOT to change

- Do not change `delegation-context.ts`, `generic-sub-agent.ts`, `sub-agent.ts`,
  or `toolset.ts`.
- Do not change `dangerous: true` or `requiresConfirmation: true`.
- Do not change the `validateToolsets` function.
- Do not change `MAX_DELEGATION_DEPTH` or `MAX_CONCURRENT_SUBAGENTS`.
- Do not remove existing tests.
- Do not add new parameters to the tool.

---

## General rules

- TypeScript only. No `any` unless unavoidable.
- No em dashes, no emojis anywhere.
- Run `npx tsc --noEmit` after changes and fix all errors before moving on.
- Do not touch files not listed in this prompt.

---

## Verification checklist

- [ ] `npx tsc --noEmit` exits 0
- [ ] `npx vitest run src/tools/delegate-task.test.ts` - all pass (5 existing + 4 new = 9)
- [ ] Regression: `npx vitest run src/tools/memory.test.ts src/tools/todo.test.ts src/tools/clarify.test.ts src/tools/session-search.test.ts src/tools/shell.test.ts src/tools/file.test.ts src/tools/patch.test.ts src/tools/search-files.test.ts src/tools/process.test.ts` - all pass
- [ ] In `runWithConcurrency`, each task result is wrapped in try/catch so one failure does not reject the whole batch
- [ ] Description updated in `createDelegateTaskTool`
