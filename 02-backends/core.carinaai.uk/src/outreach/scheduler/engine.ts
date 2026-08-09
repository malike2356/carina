/**
 * Durable outreach due engine: thin timers only enqueue/claim.
 * Work units live in Postgres (outreach_due_jobs) with SKIP LOCKED leases.
 */

import { enqueueDueOutreachJobs } from './enqueue-due.js';
import { tickOutreachDueWorkers } from './due-worker.js';
import {
  ensureOutreachDueJobSchema,
  isOutreachDurableSchedulerEnabled,
} from './due-job-queue.js';

let enqueueTimer: ReturnType<typeof setInterval> | null = null;
let drainTimer: ReturnType<typeof setInterval> | null = null;
let started = false;

const ENQUEUE_MS = Number(process.env.CARINA_OUTREACH_ENQUEUE_MS || 60_000);
const DRAIN_MS = Number(process.env.CARINA_OUTREACH_DRAIN_MS || 10_000);

export async function tickOutreachDueEngine(): Promise<{
  enqueued: number;
  drained: number;
}> {
  if (!isOutreachDurableSchedulerEnabled()) {
    return { enqueued: 0, drained: 0 };
  }
  await ensureOutreachDueJobSchema();
  const queued = await enqueueDueOutreachJobs();
  const drained = await tickOutreachDueWorkers(10);
  return { enqueued: queued.enqueued, drained: drained.claimed };
}

export function startOutreachDueEngine(): void {
  if (started || !isOutreachDurableSchedulerEnabled()) return;
  started = true;

  void ensureOutreachDueJobSchema()
    .then(() => tickOutreachDueEngine())
    .then((summary) => {
      if (summary.enqueued > 0 || summary.drained > 0) {
        console.log(
          `[outreach-due] durable boot enqueued=${summary.enqueued} drained=${summary.drained}`,
        );
      }
    })
    .catch((err) => {
      console.warn('[outreach-due] durable boot failed:', err);
    });

  enqueueTimer = setInterval(() => {
    void enqueueDueOutreachJobs()
      .then((summary) => {
        if (summary.enqueued > 0) {
          console.log(
            `[outreach-due] enqueue scanned=${summary.scanned} enqueued=${summary.enqueued} dup=${summary.skippedDuplicate}`,
          );
        }
      })
      .catch((err) => console.warn('[outreach-due] enqueue tick failed:', err));
  }, Math.max(15_000, ENQUEUE_MS));

  drainTimer = setInterval(() => {
    void tickOutreachDueWorkers(10)
      .then((summary) => {
        if (summary.claimed > 0) {
          console.log(
            `[outreach-due] drain claimed=${summary.claimed} done=${summary.done} skipped=${summary.skipped} deferred=${summary.deferred} retried=${summary.retried} dead=${summary.dead}`,
          );
        }
      })
      .catch((err) => console.warn('[outreach-due] drain tick failed:', err));
  }, Math.max(5_000, DRAIN_MS));
}

export function stopOutreachDueEngine(): void {
  if (enqueueTimer) clearInterval(enqueueTimer);
  if (drainTimer) clearInterval(drainTimer);
  enqueueTimer = null;
  drainTimer = null;
  started = false;
}
