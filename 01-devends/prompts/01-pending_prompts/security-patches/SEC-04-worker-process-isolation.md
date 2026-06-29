# SEC-04: Aiva Worker Process Isolation

**Severity:** High
**Status:** Unpatched - workers run as shared state in single Node.js process
**Affects:** core.carinaai.uk src/agents/ (Aiva worker management)

## Problem

Aiva workers currently run inside the same Node.js process. This means:
- A bug in one worker (e.g., infinite loop, memory leak, uncaught exception) can
  degrade or crash all workers.
- Workers share the same global namespace, V8 heap, and module cache. A
  compromised or malicious skill installed by one worker is accessible to all.
- There is no memory ceiling per worker. A misbehaving worker consuming 4GB
  will not be killed before it crashes the host process.
- If a prompt injection succeeds and causes a worker to execute arbitrary tool
  calls, there is no process boundary stopping it from reading another worker's
  memory, session data, or tool results.

## Current Architecture (inferred)

```
Node.js process (PID 1234)
  └── CarinaOrchestrator
        ├── WorkerA (client: Acme Ltd)   <- shared heap
        ├── WorkerB (client: Beta Corp)  <- shared heap
        └── WorkerC (client: Gamma Org)  <- shared heap
```

## Target Architecture

```
Node.js coordinator process (PID 1234)
  ├── WorkerA (child_process / worker_threads, isolated heap)
  │     Memory limit: 512MB. Crash does not affect B or C.
  ├── WorkerB (child_process / worker_threads, isolated heap)
  └── WorkerC (child_process / worker_threads, isolated heap)

Inter-worker communication: only via the coordinator's message bus.
No direct references shared between workers.
```

## Implementation

### Option A: Node.js worker_threads (recommended for low latency)

worker_threads give each Aiva worker its own V8 isolate with a separate heap.
They are lighter than child processes and communicate via MessageChannel.

```typescript
// src/agents/worker-runner.ts  (NEW FILE - runs inside the worker thread)
import { workerData, parentPort } from 'worker_threads';
import { CarinaWorker } from './carina-worker.js';

if (!parentPort) throw new Error('Must be run as a worker thread');

const worker = new CarinaWorker(workerData.config);

parentPort.on('message', async (msg: WorkerMessage) => {
  try {
    const result = await worker.handle(msg);
    parentPort!.postMessage({ id: msg.id, ok: true, result });
  } catch (err) {
    parentPort!.postMessage({ id: msg.id, ok: false, error: String(err) });
  }
});

worker.start().catch((err) => {
  parentPort!.postMessage({ type: 'fatal', error: String(err) });
  process.exit(1);
});
```

```typescript
// src/agents/worker-pool.ts  (NEW FILE - coordinator side)
import { Worker, ResourceLimits } from 'worker_threads';
import { resolve } from 'path';

const WORKER_MEMORY_LIMIT_MB = 512;

const WORKER_LIMITS: ResourceLimits = {
  maxOldGenerationSizeMb: WORKER_MEMORY_LIMIT_MB,
  maxYoungGenerationSizeMb: 64,
};

export class AivaWorkerPool {
  private workers = new Map<string, Worker>();

  spawn(workerId: string, config: WorkerConfig): Worker {
    const w = new Worker(resolve(import.meta.dirname, 'worker-runner.js'), {
      workerData: { config },
      resourceLimits: WORKER_LIMITS,
    });

    w.on('error', (err) => {
      console.error(`[worker-pool] worker ${workerId} error:`, err.message);
      this.workers.delete(workerId);
    });

    w.on('exit', (code) => {
      if (code !== 0) {
        console.error(`[worker-pool] worker ${workerId} exited with code ${code}`);
      }
      this.workers.delete(workerId);
    });

    this.workers.set(workerId, w);
    return w;
  }

  async send(workerId: string, msg: WorkerMessage): Promise<unknown> {
    const w = this.workers.get(workerId);
    if (!w) throw new Error(`No worker with id ${workerId}`);

    return new Promise((resolve, reject) => {
      const id = crypto.randomUUID();
      const handler = (response: WorkerResponse) => {
        if (response.id !== id) return;
        w.off('message', handler);
        if (response.ok) resolve(response.result);
        else reject(new Error(response.error));
      };
      w.on('message', handler);
      w.postMessage({ ...msg, id });
    });
  }

  async terminate(workerId: string): Promise<void> {
    const w = this.workers.get(workerId);
    if (!w) return;
    await w.terminate();
    this.workers.delete(workerId);
  }

  terminateAll(): Promise<void[]> {
    return Promise.all([...this.workers.keys()].map((id) => this.terminate(id)));
  }
}
```

### Option B: child_process.fork (recommended for full OS-level isolation)

`child_process.fork` gives a fully separate OS process with its own PID. It is
heavier than worker_threads but gives stronger isolation: a segfault in the
child does not affect the parent; ulimit applies per-process.

```typescript
// src/agents/fork-pool.ts  (NEW FILE - coordinator side)
import { fork, ChildProcess } from 'child_process';
import { resolve } from 'path';

export class AivaForkPool {
  private procs = new Map<string, ChildProcess>();

  spawn(workerId: string, config: WorkerConfig): void {
    const child = fork(resolve(import.meta.dirname, 'worker-fork.js'), [], {
      env: {
        ...process.env,
        WORKER_CONFIG: JSON.stringify(config),
        WORKER_ID: workerId,
      },
      // Memory ceiling via Node.js max-old-space
      execArgv: ['--max-old-space-size=512'],
    });

    child.on('error', (err) => {
      console.error(`[fork-pool] worker ${workerId} error:`, err.message);
    });

    child.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        console.error(`[fork-pool] worker ${workerId} exited ${code} - respawning`);
        this.procs.delete(workerId);
        this.spawn(workerId, config);
      }
    });

    this.procs.set(workerId, child);
  }
}
```

### Recommendation

Use **worker_threads** now. It is simpler to wire into the existing codebase
because workers still run in the same Node binary and share file descriptors.
Switch to child_process.fork if a future audit determines per-process OS limits
are needed (e.g., syscall filtering with seccomp).

## Migration Checklist

1. Identify where `CarinaWorker` or Aiva workers are instantiated in
   `src/agents/`. Run:
   ```bash
   grep -rn "new CarinaWorker\|AivaWorker\|spawnWorker\|createWorker" \
     02-backends/core.carinaai.uk/src/ --include="*.ts"
   ```

2. Replace direct instantiation with `AivaWorkerPool.spawn(workerId, config)`.

3. Replace direct method calls on the worker with `AivaWorkerPool.send(workerId, msg)`.

4. Ensure no object references that straddle the thread boundary (no passing
   functions, no SharedArrayBuffer unless intentional, no Proxy objects).

5. Move shared read-only data (config, injection patterns) into `workerData` at
   spawn time. Mutable shared state must go through the coordinator.

6. Add a health-check loop in the coordinator: every 30s, send a PING message
   to each worker and expect PONG within 5s. Missing PONG = restart the worker.

## Verification

```bash
# After implementing: confirm each worker has its own thread ID
pnpm cli -- "list workers"
# Output should show: worker_id | thread_id | status | memory_mb
# All thread_ids should be different from the main thread

# Confirm memory limit enforced: start a worker, trigger heavy work
# Worker memory should not exceed 512MB before OOM kill
```
