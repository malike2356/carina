import {
  listTaskFlowRuns,
  listDeliveryQueue,
  markDelivery,
  taskFlowsEnabled,
  updateTaskFlowRun,
} from './store.js';
import { executeTaskFlowRun } from './engine.js';
import type { TaskFlowRun, TaskRunStatus } from './types.js';

const DEFAULT_STALE_MS = 30 * 60_000;
const DEFAULT_RUN_TIMEOUT_MS = 15 * 60_000;

export function taskFlowWorkerEnabled(): boolean {
  return taskFlowsEnabled() && process.env.CARINA_TASKFLOWS_WORKER !== 'false';
}

export function cancelTaskFlowRun(runId: string): TaskFlowRun | null {
  const run = listTaskFlowRuns(500).find((r) => r.id === runId);
  if (!run) return null;
  if (run.status !== 'queued' && run.status !== 'running') return run;
  return updateTaskFlowRun(runId, {
    status: 'cancelled',
    finishedAt: new Date().toISOString(),
    error: 'cancelled by operator',
  });
}

export function markStaleTaskFlowRuns(staleMs = DEFAULT_STALE_MS): number {
  const now = Date.now();
  let marked = 0;
  for (const run of listTaskFlowRuns(500)) {
    if (run.status !== 'queued' && run.status !== 'running') continue;
    const ref = run.startedAt ?? run.queuedAt;
    if (now - new Date(ref).getTime() < staleMs) continue;
    const status: TaskRunStatus = run.status === 'running' ? 'timed_out' : 'lost';
    updateTaskFlowRun(run.id, {
      status,
      finishedAt: new Date().toISOString(),
      error: status === 'timed_out' ? 'run exceeded stale threshold' : 'queued run expired',
    });
    marked++;
  }
  return marked;
}

export async function processQueuedTaskFlowRuns(maxConcurrent = 2): Promise<number> {
  if (!taskFlowWorkerEnabled()) return 0;

  markStaleTaskFlowRuns();

  const queued = listTaskFlowRuns(500).filter((r) => r.status === 'queued');
  const running = listTaskFlowRuns(500).filter((r) => r.status === 'running').length;
  const slots = Math.max(0, maxConcurrent - running);
  if (slots === 0 || queued.length === 0) return 0;

  let started = 0;
  for (const run of queued.slice(0, slots)) {
    void executeTaskFlowRun(run.id);
    started++;
  }
  return started;
}

export async function processDeliveryQueue(maxItems = 10): Promise<{ delivered: number; failed: number }> {
  if (!taskFlowsEnabled()) return { delivered: 0, failed: 0 };

  const pending = listDeliveryQueue().slice(0, maxItems);
  let delivered = 0;
  let failed = 0;

  for (const item of pending) {
    try {
      const { channelRegistry } = await import('../../gateway/channels/channel-registry.js');
      const adapter = channelRegistry.getByName(item.channel as import('../../gateway/channels/channel-adapter.interface.js').ChannelName);
      if (!adapter?.sendMessage) {
        markDelivery(item.id, 'failed', `channel ${item.channel} does not support outbound delivery`);
        failed++;
        continue;
      }
      await adapter.sendMessage(item.conversationId, item.message);
      markDelivery(item.id, 'delivered');
      delivered++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      markDelivery(item.id, 'failed', msg);
      failed++;
    }
  }

  return { delivered, failed };
}

export function summarizeTaskFlowRuns(): Record<TaskRunStatus, number> {
  const counts: Record<TaskRunStatus, number> = {
    queued: 0,
    running: 0,
    succeeded: 0,
    failed: 0,
    timed_out: 0,
    cancelled: 0,
    lost: 0,
  };
  for (const run of listTaskFlowRuns(200)) {
    counts[run.status]++;
  }
  return counts;
}

let workerTimer: ReturnType<typeof setInterval> | null = null;

export function startTaskFlowWorkerLoop(): void {
  if (!taskFlowWorkerEnabled()) return;
  const ms = Number(process.env.CARINA_TASKFLOWS_WORKER_INTERVAL_MS ?? 0);
  if (!Number.isFinite(ms) || ms <= 0) return;
  if (workerTimer) return;

  workerTimer = setInterval(() => {
    void processQueuedTaskFlowRuns();
    if (process.env.CARINA_TASKFLOWS_DELIVERY_WORKER !== 'false') {
      void processDeliveryQueue();
    }
  }, ms);
  workerTimer.unref?.();
}

export function stopTaskFlowWorkerLoop(): void {
  if (workerTimer) {
    clearInterval(workerTimer);
    workerTimer = null;
  }
}
