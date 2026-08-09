/**
 * Discover due enrolments and enqueue durable Soft Wall jobs.
 * Does not process steps; claim worker executes.
 */

import { isDatabaseConfigured } from '../../config/database-url.js';
import { pool } from '../../memory/db.js';
import { getSequence } from '../sequence-engine.js';
import { isOutreachPostgresEnabled } from '../pg/config.js';
import { listOutreachWorkspaceIdsAsync, loadOutreachStore } from '../store.js';
import {
  enqueueOutreachDueJob,
  getSchedulerControl,
  isOutreachDurableSchedulerEnabled,
  touchSchedulerHeartbeat,
} from './due-job-queue.js';

export async function listDueEnrollmentCandidates(now = new Date()): Promise<Array<{
  workspaceId: string;
  enrollmentId: string;
  sequenceId: string;
  campaignId?: string;
  stepId: string;
  stepOrder: number;
  dueAt: Date;
}>> {
  const out: Array<{
    workspaceId: string;
    enrollmentId: string;
    sequenceId: string;
    campaignId?: string;
    stepId: string;
    stepOrder: number;
    dueAt: Date;
  }> = [];

  if (isOutreachPostgresEnabled() && isDatabaseConfigured()) {
    try {
      const result = await pool.query(
        `SELECT id, workspace_id, sequence_id, campaign_id, next_action_at, payload
         FROM outreach_enrollments
         WHERE status = 'active'
           AND next_action_at IS NOT NULL
           AND next_action_at <= $1::timestamptz
         ORDER BY next_action_at ASC
         LIMIT 500`,
        [now.toISOString()],
      );
      for (const row of result.rows as Array<Record<string, unknown>>) {
        const workspaceId = String(row.workspace_id);
        const enrollmentId = String(row.id);
        const sequenceId = String(row.sequence_id);
        const payload = (row.payload && typeof row.payload === 'object')
          ? row.payload as Record<string, unknown>
          : {};
        const currentStepIndex = Number(payload.currentStepIndex ?? 0);
        const sequence = getSequence(workspaceId, sequenceId);
        const step = sequence?.steps[currentStepIndex];
        if (!step) continue;
        out.push({
          workspaceId,
          enrollmentId,
          sequenceId,
          campaignId: row.campaign_id ? String(row.campaign_id) : undefined,
          stepId: step.id,
          stepOrder: step.order,
          dueAt: new Date(String(row.next_action_at)),
        });
      }
      return out;
    } catch (err) {
      console.warn('[outreach-due] pg due scan failed; falling back to store:', err);
    }
  }

  const store = loadOutreachStore();
  for (const enrollment of store.enrollments) {
    if (enrollment.status !== 'active' || !enrollment.nextActionAt) continue;
    const dueAt = new Date(enrollment.nextActionAt);
    if (dueAt.getTime() > now.getTime()) continue;
    const sequence = getSequence(enrollment.workspaceId, enrollment.sequenceId);
    const step = sequence?.steps[enrollment.currentStepIndex];
    if (!step) continue;
    out.push({
      workspaceId: enrollment.workspaceId,
      enrollmentId: enrollment.id,
      sequenceId: enrollment.sequenceId,
      campaignId: enrollment.campaignId,
      stepId: step.id,
      stepOrder: step.order,
      dueAt,
    });
  }
  return out;
}

export async function enqueueDueOutreachJobs(now = new Date()): Promise<{
  scanned: number;
  enqueued: number;
  skippedDuplicate: number;
  skippedDrain: number;
}> {
  if (!isOutreachDurableSchedulerEnabled()) {
    return { scanned: 0, enqueued: 0, skippedDuplicate: 0, skippedDrain: 0 };
  }

  const control = await getSchedulerControl();
  if (control.drainMode) {
    await touchSchedulerHeartbeat({ enqueueCount: 0 });
    return { scanned: 0, enqueued: 0, skippedDuplicate: 0, skippedDrain: 1 };
  }

  // Ensure workspace store is warm for JSON/PG hybrid reads of sequence steps.
  await listOutreachWorkspaceIdsAsync();

  const candidates = await listDueEnrollmentCandidates(now);
  let enqueued = 0;
  let skippedDuplicate = 0;
  for (const candidate of candidates) {
    const job = await enqueueOutreachDueJob({
      workspaceId: candidate.workspaceId,
      enrollmentId: candidate.enrollmentId,
      stepId: candidate.stepId,
      stepOrder: candidate.stepOrder,
      campaignId: candidate.campaignId,
      sequenceId: candidate.sequenceId,
      dueAt: candidate.dueAt,
      availableAt: now,
    });
    if (job) enqueued += 1;
    else skippedDuplicate += 1;
  }
  await touchSchedulerHeartbeat({ enqueueCount: enqueued });
  return {
    scanned: candidates.length,
    enqueued,
    skippedDuplicate,
    skippedDrain: 0,
  };
}
