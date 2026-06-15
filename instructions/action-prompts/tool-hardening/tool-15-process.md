# Cursor Task: Fix and improve process (#15) tool in Carina

## Context

Carina is a Node.js/TypeScript autonomous AI agent at:
`/opt/lampp/htdocs/verlox/carina/core.carinaai.uk/`

We are hardening the 27 Hermes tools one by one. Tools #10-14 and #18-21 are
confirmed working. This task covers tool #15: the `process` tool for managing
background processes.

Read these files in full before touching anything:
- `src/tools/process.ts` (the tool - this is the main file to change)
- `src/tools/process-registry.ts` (the registry - read only, do not change)
- `src/tools/process-notifications.ts` (read only, do not change)
- `src/tools/process.test.ts` (existing tests - do not remove any)

Do NOT modify `process-registry.ts` or `process-notifications.ts`.

---

## Bug: registry functions throw but process.ts has no try/catch

Every registry function that receives an unknown `session_id` throws directly:
```typescript
if (!state) throw new Error(`Unknown session_id: ${sessionId}`);
```

The following actions in `process.ts` call these functions with no error handling:
`poll`, `log`, `wait`, `kill`, `write`, `submit`, `close`.

If the agent supplies a session_id that no longer exists (swept by cleanup, or a
typo), the tool throws an uncaught error instead of returning `{ error: '...' }`.

The same applies to `writeToProcess` and `closeProcessStdin` which also throw
when the process is not in a running state.

### Fix: wrap every registry call in process.ts with try/catch

For each action case that calls a registry function, wrap the call:

```typescript
case 'poll':
  if (!sessionId) return { error: 'session_id is required for poll' };
  try {
    return pollProcess(sessionId);
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }

case 'log':
  if (!sessionId) return { error: 'session_id is required for log' };
  try {
    return getProcessLog(
      sessionId,
      params.offset !== undefined ? Number(params.offset) : -200,
      params.limit !== undefined ? Number(params.limit) : 200,
    );
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }

case 'wait':
  if (!sessionId) return { error: 'session_id is required for wait' };
  try {
    return await waitForProcess(
      sessionId,
      params.timeout !== undefined ? Number(params.timeout) : 60,
    );
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }

case 'kill':
  if (!sessionId) return { error: 'session_id is required for kill' };
  try {
    return await killProcess(sessionId);
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }

case 'write':
  if (!sessionId) return { error: 'session_id is required for write' };
  try {
    return writeToProcess(sessionId, String(params.data ?? ''), false);
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }

case 'submit':
  if (!sessionId) return { error: 'session_id is required for submit' };
  try {
    return writeToProcess(sessionId, String(params.data ?? ''), true);
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }

case 'close':
  if (!sessionId) return { error: 'session_id is required for close' };
  try {
    return closeProcessStdin(sessionId);
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
```

---

## Improvement: update the tool description

Replace the current `processTool` description with:

```
'Manage background processes spawned by shell-exec (background=true). Use list first to find the session_id. Actions: list - all tracked processes with status and uptime; poll - new output lines since the last poll call (advances an internal cursor - use repeatedly while a process runs); log - read the output buffer non-destructively by offset/limit (does not advance cursor); wait - block until the process exits, up to timeout seconds (max 600); kill - sends SIGTERM then SIGKILL after a grace period; write - write data to stdin without a newline; submit - write data to stdin with a trailing newline (use for interactive prompts and menu choices); close - close stdin so the process sees EOF.'
```

---

## Tests to ADD in `src/tools/process.test.ts`

Do not remove any existing tests. Add the following inside the
`describe('process tool', ...)` block:

**Test: poll returns error for unknown session_id**

```typescript
it('poll returns error object for unknown session_id', async () => {
  vi.doMock('./process-registry.js', () => ({
    startProcessCleanup: vi.fn(),
    listProcesses: vi.fn(),
    pollProcess: vi.fn(() => { throw new Error('Unknown session_id: xyz'); }),
    getProcessLog: vi.fn(),
    waitForProcess: vi.fn(),
    killProcess: vi.fn(),
    writeToProcess: vi.fn(),
    closeProcessStdin: vi.fn(),
    spawnBackgroundProcess: vi.fn(),
  }));
  const { processTool } = await import('./process.js');
  const result = await processTool.execute({ action: 'poll', session_id: 'xyz' }) as { error?: string };
  expect(result.error).toContain('Unknown session_id');
});
```

**Test: kill returns error for unknown session_id**

```typescript
it('kill returns error object for unknown session_id', async () => {
  vi.doMock('./process-registry.js', () => ({
    startProcessCleanup: vi.fn(),
    listProcesses: vi.fn(),
    pollProcess: vi.fn(),
    getProcessLog: vi.fn(),
    waitForProcess: vi.fn(),
    killProcess: vi.fn(() => { throw new Error('Unknown session_id: xyz'); }),
    writeToProcess: vi.fn(),
    closeProcessStdin: vi.fn(),
    spawnBackgroundProcess: vi.fn(),
  }));
  const { processTool } = await import('./process.js');
  const result = await processTool.execute({ action: 'kill', session_id: 'xyz' }) as { error?: string };
  expect(result.error).toContain('Unknown session_id');
});
```

**Test: write returns error when process is not running**

```typescript
it('write returns error when process is not accepting stdin', async () => {
  vi.doMock('./process-registry.js', () => ({
    startProcessCleanup: vi.fn(),
    listProcesses: vi.fn(),
    pollProcess: vi.fn(),
    getProcessLog: vi.fn(),
    waitForProcess: vi.fn(),
    killProcess: vi.fn(),
    writeToProcess: vi.fn(() => { throw new Error('Process xyz is not accepting stdin (status: exited).'); }),
    closeProcessStdin: vi.fn(),
    spawnBackgroundProcess: vi.fn(),
  }));
  const { processTool } = await import('./process.js');
  const result = await processTool.execute({ action: 'write', session_id: 'xyz', data: 'hello' }) as { error?: string };
  expect(result.error).toContain('not accepting stdin');
});
```

**Test: unknown action returns error**

```typescript
it('unknown action returns error', async () => {
  vi.doMock('./process-registry.js', () => ({
    startProcessCleanup: vi.fn(),
    listProcesses: vi.fn(),
    pollProcess: vi.fn(),
    getProcessLog: vi.fn(),
    waitForProcess: vi.fn(),
    killProcess: vi.fn(),
    writeToProcess: vi.fn(),
    closeProcessStdin: vi.fn(),
    spawnBackgroundProcess: vi.fn(),
  }));
  const { processTool } = await import('./process.js');
  const result = await processTool.execute({ action: 'launch_missiles' }) as { error?: string };
  expect(result.error).toContain('Unknown action');
});
```

**Test: log action passes offset and limit to registry**

```typescript
it('log action passes offset and limit to getProcessLog', async () => {
  const getProcessLog = vi.fn(() => ({
    session_id: 'abc',
    lines: ['line1', 'line2'],
    total: 2,
    offset: 0,
    limit: 10,
  }));
  vi.doMock('./process-registry.js', () => ({
    startProcessCleanup: vi.fn(),
    listProcesses: vi.fn(),
    pollProcess: vi.fn(),
    getProcessLog,
    waitForProcess: vi.fn(),
    killProcess: vi.fn(),
    writeToProcess: vi.fn(),
    closeProcessStdin: vi.fn(),
    spawnBackgroundProcess: vi.fn(),
  }));
  const { processTool } = await import('./process.js');
  await processTool.execute({ action: 'log', session_id: 'abc', offset: 0, limit: 10 });
  expect(getProcessLog).toHaveBeenCalledWith('abc', 0, 10);
});
```

---

## What NOT to change

- Do not change `process-registry.ts` or `process-notifications.ts`.
- Do not change `dangerous: true` on `processTool`.
- Do not change the `needsConfirmation` logic.
- Do not remove existing tests.
- Do not add new parameters to the tool.
- Do not change `spawnBackgroundProcess` or its export at the bottom of `process.ts`.

---

## General rules

- TypeScript only. No `any` unless unavoidable.
- No em dashes, no emojis anywhere.
- Run `npx tsc --noEmit` after changes and fix all errors before moving on.
- Do not touch files not listed in this prompt.

---

## Verification checklist

- [ ] `npx tsc --noEmit` exits 0
- [ ] `npx vitest run src/tools/process.test.ts` - all pass (6 existing + 5 new = 11)
- [ ] Regression: `npx vitest run src/tools/memory.test.ts src/tools/todo.test.ts src/tools/clarify.test.ts src/tools/session-search.test.ts src/tools/shell.test.ts src/tools/file.test.ts src/tools/patch.test.ts src/tools/search-files.test.ts` - all pass
- [ ] Every action case in `process.ts` that calls a registry function is wrapped in try/catch returning `{ error: string }`
- [ ] Description updated in `processTool`
