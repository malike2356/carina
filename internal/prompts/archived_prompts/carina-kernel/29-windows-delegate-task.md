# Carina Kernel: Cross-platform delegate-task using worker_threads

## Goal

Make the `delegate-task` subagent system work on Windows by replacing Unix `fork()`/process
isolation with Node.js `worker_threads`. The public API (tool name, parameters, response
format) stays identical; only the subprocess model changes underneath.

## Context

`delegate-task` spawns a child Carina agent to handle a sub-task in parallel. The current
implementation likely uses:
- `child_process.fork()` to spawn a new Node.js process
- Unix signal-based communication between parent and child
- Potentially `spawn` with `--subprocess` CLI flag

On Windows, `child_process.fork()` technically works, but the subprocess isolation model
differs. The main breakage is when the implementation uses Unix signals (`process.send()` +
`process.on('message')` works on Windows, but PTY-based communication does not).

`worker_threads` is the more reliable cross-platform choice for Carina's use case:
- Shares the same process (lower overhead)
- Communication via `MessageChannel` (no serialisation limits)
- Works identically on all platforms
- Terminable via `worker.terminate()`

Tradeoff: worker_threads share the same V8 heap by default. Use `Worker` with
`workerData` (copied, not shared) and avoid `SharedArrayBuffer` unless required.

## Dependencies

Prompts 25-26 completed. This prompt is independent of prompts 27-28.

## Files to modify

```
src/tools/delegate-task.ts          (or wherever delegate-task tool is defined)
src/agents/subagent-runner.ts       (the worker entry point for the subagent)
```

## Step-by-step

### 1. Find the current implementation

```bash
grep -rn 'fork\|delegate\|subagent\|subprocess' src/ --include="*.ts" -l
```

Read the files found. Understand:
- How the parent spawns the child
- What data is passed to the child (task, context, tools, session ID)
- How the child's output is returned to the parent
- Whether there is a timeout

### 2. Worker entry point

Create `src/agents/subagent-worker.ts` - this is the code that runs inside the Worker:

```typescript
import { parentPort, workerData, isMainThread } from 'worker_threads';

if (isMainThread) {
  throw new Error('subagent-worker.ts must be run as a Worker, not directly');
}

type SubagentTask = {
  task: string;
  context: string;
  availableTools: string[];
  llmConfig: {
    model: string;
    apiKey: string;
    maxTokens: number;
  };
  timeoutMs: number;
};

async function runSubagent(taskData: SubagentTask): Promise<string> {
  // Import Carina's agent runner (the same one used in the main process)
  // This is safe in worker_threads; each worker has its own module registry
  const { createCarinaAgent } = await import('../agent/create-agent.js');

  const agent = createCarinaAgent({
    llm: taskData.llmConfig,
    enabledTools: taskData.availableTools,
    memory: false, // Subagents do not persist memory
    maxIterations: 10,
  });

  const response = await agent.run(taskData.task, taskData.context);
  return response;
}

const task = workerData as SubagentTask;

runSubagent(task)
  .then((result) => {
    parentPort?.postMessage({ ok: true, result });
  })
  .catch((err: Error) => {
    parentPort?.postMessage({ ok: false, error: err.message, stack: err.stack });
  });
```

### 3. Updated delegate-task tool handler

In `src/tools/delegate-task.ts`, replace the fork/spawn approach:

```typescript
import { Worker } from 'worker_threads';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import type { CarinaSkill } from '@verlox/carina-core';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKER_PATH = join(__dirname, '../agents/subagent-worker.js');

type DelegateResult =
  | { ok: true; result: string }
  | { ok: false; error: string; stack?: string };

async function runDelegatedTask(params: {
  task: string;
  context: string;
  availableTools: string[];
  llmConfig: { model: string; apiKey: string; maxTokens: number };
  timeoutMs: number;
}): Promise<string> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(WORKER_PATH, {
      workerData: params,
      // Each worker gets its own module namespace; no shared state issues
    });

    const timer = setTimeout(() => {
      void worker.terminate();
      reject(new Error(`Delegated task timed out after ${params.timeoutMs}ms`));
    }, params.timeoutMs);

    worker.on('message', (msg: DelegateResult) => {
      clearTimeout(timer);
      void worker.terminate();
      if (msg.ok) {
        resolve(msg.result);
      } else {
        reject(new Error(msg.error));
      }
    });

    worker.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });

    worker.on('exit', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`Subagent worker exited with code ${code}`));
      }
    });
  });
}

export const delegateTaskTool: CarinaSkill = {
  name: 'delegate-task',
  description: 'Spawn a subagent to handle a parallel or specialised task. The subagent runs in an isolated worker thread and returns its result when complete.',
  parameters: {
    type: 'object',
    properties: {
      task: {
        type: 'string',
        description: 'The task for the subagent to perform. Be specific and self-contained.',
      },
      context: {
        type: 'string',
        description: 'Relevant context the subagent needs to complete the task.',
      },
      tools: {
        type: 'array',
        items: { type: 'string' },
        description: 'Subset of tool names to make available to the subagent.',
      },
      timeoutSeconds: {
        type: 'number',
        description: 'Max time in seconds for the subagent; default 60.',
      },
    },
    required: ['task'],
  },
  handler: async ({ task, context = '', tools = [], timeoutSeconds = 60 }, ctx) => {
    const result = await runDelegatedTask({
      task,
      context,
      availableTools: tools.length > 0 ? tools : ctx.enabledTools,
      llmConfig: ctx.llmConfig,
      timeoutMs: timeoutSeconds * 1000,
    });

    return { result, delegatedTo: 'worker_thread' };
  },
};
```

### 4. Parallel delegation (multiple subagents)

For running multiple delegated tasks in parallel (a common pattern):

```typescript
// In the tool handler or a helper:
async function runParallelDelegations(
  tasks: Array<{ task: string; context: string }>,
  commonConfig: { tools: string[]; llmConfig: typeof ctx.llmConfig; timeoutMs: number },
): Promise<string[]> {
  return Promise.all(
    tasks.map((t) =>
      runDelegatedTask({ ...t, ...commonConfig }),
    ),
  );
}
```

Worker threads in Node.js use a thread pool. The default maximum is `os.cpus().length`.
Do not spawn more parallel subagents than CPU cores without adjusting `UV_THREADPOOL_SIZE`.

### 5. Migration note

If the existing implementation uses `process.send()` / `process.on('message')` (the IPC
channel from `child_process.fork()`), the data serialisation is identical to `worker_threads`
`MessageChannel`. The migration is mostly mechanical:

| Fork pattern | Worker threads equivalent |
|---|---|
| `child_process.fork(scriptPath, { workerData: data })` | `new Worker(scriptPath, { workerData: data })` |
| `process.send(message)` (in child) | `parentPort.postMessage(message)` |
| `child.on('message', handler)` (in parent) | `worker.on('message', handler)` |
| `child.kill('SIGTERM')` | `worker.terminate()` |
| `child.on('exit', ...)` | `worker.on('exit', ...)` |

## Test

`src/tools/delegate-task.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { runDelegatedTask } from './delegate-task.js';

describe('delegate-task (worker_threads)', () => {
  it('runs a simple task and returns result', async () => {
    const result = await runDelegatedTask({
      task: 'What is 2+2?',
      context: 'Answer with just the number.',
      availableTools: [],
      llmConfig: { model: 'mock', apiKey: 'test', maxTokens: 100 },
      timeoutMs: 10000,
    });
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  }, 15000);

  it('respects the timeout', async () => {
    await expect(
      runDelegatedTask({
        task: 'sleep forever',
        context: '',
        availableTools: [],
        llmConfig: { model: 'mock', apiKey: 'test', maxTokens: 100 },
        timeoutMs: 200, // Very short timeout for test
      }),
    ).rejects.toThrow(/timed out/);
  }, 2000);
});
```

## Expected behavior

```
User: Summarise these 3 documents in parallel

Carina: [delegates 3 worker tasks simultaneously]
        [collects results from all 3 workers]
        Here are the summaries:
        1. Document A: ...
        2. Document B: ...
        3. Document C: ...
```

All 3 workers run concurrently in separate V8 threads. No Unix fork required.

## Pitfalls

- The `WORKER_PATH` points to the compiled `.js` file (not `.ts`). Make sure the build
  step outputs `subagent-worker.js` to the `dist/` directory; update the path to
  `dist/agents/subagent-worker.js` if using a `dist/` output directory
- Worker threads share native addon (`.node`) state with the parent. If any Carina tool
  uses a native addon with global state (unlikely but possible), parallel workers may
  conflict. Check `pnpm ls --depth 1` for `.node` binaries
- The LLM API key is passed to the worker via `workerData`. `workerData` is structured-cloned
  (deep copied) - it does not expose the parent's memory to the worker. However, the key
  is in the worker's memory for the duration of the task. This is acceptable
- `worker.terminate()` is abrupt. If the subagent is mid-LLM-call, the HTTP request is
  abandoned. This may leave dangling LLM API calls. Add a cooperative cancellation signal
  (via `SharedArrayBuffer` flag) if graceful shutdown is needed
