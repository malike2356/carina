/**
 * Claim and execute one outreach due job: Soft Wall draft only (never sends).
 */

import { bridgeDeliveriesToEmailApprovals } from '../soft-wall-approvals.js';
import { processEnrollmentDueStep } from '../sequence-engine.js';
import {
  claimOutreachDueJob,
  completeOutreachDueJob,
  deadLetterOutreachDueJob,
  deferOutreachDueJob,
  getSchedulerControl,
  isOutreachDurableSchedulerEnabled,
  retryOutreachDueJob,
  touchSchedulerHeartbeat,
} from './due-job-queue.js';
import { DEFER_REASONS, PERMANENT_SKIP_REASONS } from './due-job-types.js';
import type { OutreachDueJob } from './due-job-types.js';

const WORKER_ID = `outreach-due-${process.pid}`;

function nextBusinessWindow(now = new Date()): Date {
  // Soft defer: retry in 15 minutes (business-hours / cap recheck at execution).
  return new Date(now.getTime() + 15 * 60_000);
}

export async function executeOutreachDueJob(
  job: OutreachDueJob,
  now = new Date(),
): Promise<'done' | 'skipped' | 'deferred' | 'retried' | 'dead'> {
  const control = await getSchedulerControl();
  if (control.paused) {
    await deferOutreachDueJob({
      jobId: job.id,
      availableAt: nextBusinessWindow(now),
      reason: 'scheduler_paused',
    });
    return 'deferred';
  }

  try {
    const outcome = processEnrollmentDueStep(
      job.workspaceId,
      job.enrollmentId,
      now,
      { expectedStepId: job.stepId },
    );

    if (outcome.kind === 'processed') {
      const softWall = await bridgeDeliveriesToEmailApprovals(
        job.workspaceId,
        [outcome.delivery],
      );
      await completeOutreachDueJob({
        jobId: job.id,
        status: 'done',
        result: {
          deliveryId: outcome.delivery.id,
          softWallBridged: softWall.bridged,
          softWallErrors: softWall.errors,
        },
      });
      return 'done';
    }

    const reason = outcome.reason;
    if (DEFER_REASONS.has(reason)) {
      await deferOutreachDueJob({
        jobId: job.id,
        availableAt: nextBusinessWindow(now),
        reason,
      });
      return 'deferred';
    }

    if (PERMANENT_SKIP_REASONS.has(reason)) {
      await completeOutreachDueJob({
        jobId: job.id,
        status: 'skipped',
        result: { reason },
        error: reason,
      });
      return 'skipped';
    }

    const retry = await retryOutreachDueJob({ jobId: job.id, error: reason });
    return retry === 'dead' ? 'dead' : 'retried';
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const permanent = /not found|invalid|forbidden|consent/i.test(message);
    if (permanent) {
      await deadLetterOutreachDueJob({ jobId: job.id, reason: message });
      return 'dead';
    }
    const retry = await retryOutreachDueJob({ jobId: job.id, error: message });
    return retry === 'dead' ? 'dead' : 'retried';
  }
}

export async function tickOutreachDueWorkers(maxClaims = 10): Promise<{
  claimed: number;
  done: number;
  skipped: number;
  deferred: number;
  retried: number;
  dead: number;
}> {
  if (!isOutreachDurableSchedulerEnabled()) {
    return { claimed: 0, done: 0, skipped: 0, deferred: 0, retried: 0, dead: 0 };
  }

  let claimed = 0;
  let done = 0;
  let skipped = 0;
  let deferred = 0;
  let retried = 0;
  let dead = 0;

  for (let i = 0; i < maxClaims; i += 1) {
    const job = await claimOutreachDueJob(WORKER_ID);
    if (!job) break;
    claimed += 1;
    const result = await executeOutreachDueJob(job);
    if (result === 'done') done += 1;
    else if (result === 'skipped') skipped += 1;
    else if (result === 'deferred') deferred += 1;
    else if (result === 'retried') retried += 1;
    else dead += 1;
  }

  await touchSchedulerHeartbeat({ drainCount: claimed });
  return { claimed, done, skipped, deferred, retried, dead };
}
