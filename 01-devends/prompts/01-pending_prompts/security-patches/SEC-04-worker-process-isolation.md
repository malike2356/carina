# SEC-04: Aiva Worker Process Isolation

**Severity:** High
**Status:** Patched (2026-06-30)
**Affects:** `aiva/02-backends/core.carinaai.uk/src/agents/`, `src/workers/aiva-process-message.ts`

## Problem

Before this patch, every Aiva worker shared one Node.js process with the main Carina gateway. That meant:

- A bug in one worker (infinite loop, memory leak, uncaught exception) could degrade or crash all workers.
- Workers shared the same global namespace, V8 heap, and module cache. A compromised skill in one worker was reachable from all.
- There was no per-worker memory ceiling. A worker consuming 4GB could take down the host process.
- Prompt injection with arbitrary tool calls had no process boundary between workers.

## Architecture before (shared heap)

```
Node.js process (PID 1234)
  └── GatewayRouter (singleton via getRouter())
        ├── session aiva-workerA-web-contact1 -> CarinaOrchestrator  (shared heap)
        ├── session aiva-workerB-email-contact2 -> CarinaOrchestrator (shared heap)
        └── session aiva-workerC-slack-contact3 -> CarinaOrchestrator (shared heap)
```

Entry points that created orchestrators in-process:

- `src/workers/aiva-process-message.ts` (`processAivaMessageStreamDirect`)
- `src/workers/aiva-automation-scheduler.ts` (cron automations)
- `src/gateway/router.ts` (`runAgentTurn` when `resolveWorkerForMessage` matches)

There is no `CarinaWorker` class. Aiva workers are DB records (`ai_workers`) executed through `GatewayRouter` + `CarinaOrchestrator`.

## Architecture after (worker_threads)

```
Node.js coordinator process (main thread)
  └── AivaWorkerPool
        ├── workerId=A (worker_threads, 512MB heap limit, own threadId)
        │     └── worker-runner.ts -> initRouter() + processAivaMessageStreamDirect()
        ├── workerId=B (worker_threads)
        └── workerId=C (worker_threads)

Inter-worker communication: only via pool.postMessage / parentPort.
No object references cross the thread boundary.
```

**Feature flag:** `AIVA_WORKER_ISOLATION=true` (default). Set `false` to fall back to the in-process path.

## Implementation (shipped)

Modeled on `subagent-runner.ts` / `subagent-worker.ts`.

| File | Role |
|------|------|
| `src/agents/aiva-worker-pool-types.ts` | Message and status types (`ping`, `process_message`, stream events) |
| `src/agents/worker-pool.ts` | Coordinator: `spawn`, `send`, `sendStream`, `terminate`, `respawn`, `listWorkers` |
| `src/agents/worker-runner.ts` | Thread entry: lazy bootstrap (env, memory, router, skills), streams tokens back |
| `src/agents/aiva-worker-runtime.ts` | Handles `ping` -> `pong` inside the thread |
| `src/agents/worker-pool-health.ts` | Every 30s: PING each worker, 5s timeout, `respawn` on failure |
| `src/workers/aiva-process-message.ts` | `processAivaMessageStream` routes through pool when flag is on; `processAivaMessageStreamDirect` runs in-thread |
| `src/workers/aiva-automation-scheduler.ts` | Uses `processAivaMessage` (inherits isolation) |
| `src/workers/worker-store.ts` | `pauseWorker` / `dismissWorker` terminate the isolated thread |
| `src/index.ts` | Starts health check when `AI_WORKERS_ENABLED` and isolation are on |

Memory limits per thread (`worker-pool.ts`):

```typescript
const WORKER_LIMITS: ResourceLimits = {
  maxOldGenerationSizeMb: 512,
  maxYoungGenerationSizeMb: 64,
};
```

## Migration checklist (completed)

1. Identified instantiation sites: `aiva-process-message.ts`, `aiva-automation-scheduler.ts`, `gateway/router.ts` (channel inbound with worker context).
2. Pool spawn on first message per `workerId` via `sendStream` / `ensureWorker`.
3. Direct orchestrator calls replaced at the Aiva message boundary; channel inbound still uses `GatewayRouter` on the main thread unless the message is routed through `processAivaMessage`.
4. Thread boundary carries only serializable `ProcessAivaMessageParams` (no functions, Proxies, or SharedArrayBuffer).
5. Read-only spawn config (`workerId`, `workspaceId`) passed via `workerData`; mutable state stays in DB/Redis accessed from within each thread.
6. Health-check loop started from `src/index.ts`.

## Deferred: child_process.fork

`child_process.fork` remains reserved for a future audit if OS-level limits are needed (seccomp, ulimit per PID). `worker_threads` is sufficient for V8 heap isolation and matches existing Carina patterns (`subagent-runner`, code-exec sandbox).

## Verification

```bash
cd aiva/02-backends/core.carinaai.uk

# Unit tests
pnpm test src/agents/worker-pool.test.ts \
  src/agents/aiva-worker-runtime.test.ts \
  src/agents/worker-pool-health.test.ts \
  src/workers/aiva-process-message.test.ts

# Runtime: each active Aiva worker should have a distinct threadId
# (inspect via pool.listWorkers() in a REPL or add an ops endpoint)
```

Expected `listWorkers()` shape:

```
worker_id | thread_id | status  | memory_limit_mb | last_pong_at
```

All `thread_id` values must differ from the main thread (`worker_threads` `threadId` 0).

To confirm the memory limit: trigger heavy work in one worker; its thread should OOM near 512MB without killing sibling workers.

## Environment

```bash
# .env.example
AI_WORKERS_ENABLED=true
AIVA_WORKER_ISOLATION=true   # set false to disable isolation
```
