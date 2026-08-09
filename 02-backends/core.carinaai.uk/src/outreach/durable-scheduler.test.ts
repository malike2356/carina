import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { computeBackoffMs } from './scheduler/due-job-queue.js';
import { DEFER_REASONS, PERMANENT_SKIP_REASONS } from './scheduler/due-job-types.js';
import { isWithinBusinessHours } from './business-hours.js';

async function canUseLocalPg(): Promise<boolean> {
  if (!process.env.DATABASE_URL?.trim()) return false;
  try {
    const { pool } = await import('../memory/db.js');
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

const pgReady = await canUseLocalPg();

describe('outreach durable scheduler helpers', () => {
  it('classifies permanent vs defer skip reasons', () => {
    expect(PERMANENT_SKIP_REASONS.has('already_replied')).toBe(true);
    expect(PERMANENT_SKIP_REASONS.has('duplicate_step')).toBe(true);
    expect(DEFER_REASONS.has('outside_business_hours')).toBe(true);
    expect(DEFER_REASONS.has('daily_cap')).toBe(true);
    expect(DEFER_REASONS.has('already_replied')).toBe(false);
  });

  it('computes bounded exponential backoff with jitter', () => {
    const a1 = computeBackoffMs(1, 1000, 60_000);
    const a5 = computeBackoffMs(5, 1000, 60_000);
    expect(a1).toBeGreaterThanOrEqual(1000);
    expect(a1).toBeLessThanOrEqual(1000 + 15_000);
    expect(a5).toBeGreaterThan(a1);
    expect(a5).toBeLessThanOrEqual(60_000);
  });

  it('handles Europe/London DST spring-forward wall clock', () => {
    const duringGap = new Date('2026-03-29T01:30:00.000Z');
    const middayBst = new Date('2026-03-29T12:00:00.000Z');
    const sundayNight = new Date('2026-03-29T23:00:00.000Z');

    expect(
      isWithinBusinessHours({
        now: middayBst,
        timezone: 'Europe/London',
        start: '09:00',
        end: '17:00',
        businessDays: [0, 1, 2, 3, 4, 5, 6],
      }),
    ).toBe(true);

    expect(
      isWithinBusinessHours({
        now: sundayNight,
        timezone: 'Europe/London',
        start: '09:00',
        end: '17:00',
        businessDays: [1, 2, 3, 4, 5],
      }),
    ).toBe(false);

    expect(
      typeof isWithinBusinessHours({
        now: duringGap,
        timezone: 'Europe/London',
        start: '09:00',
        end: '17:00',
        businessDays: [0, 1, 2, 3, 4, 5, 6],
      }),
    ).toBe('boolean');
  });
});

describe('approval delay revalidation', () => {
  let tmpHome: string;

  beforeEach(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'outreach-reval-'));
    vi.stubEnv('CARINA_HOME', tmpHome);
    vi.stubEnv('CARINA_OUTREACH_PERSISTENCE', 'json');
    vi.resetModules();
  });

  afterEach(() => {
    fs.rmSync(tmpHome, { recursive: true, force: true });
    vi.unstubAllEnvs();
  });

  it('allows non-outreach approvals', async () => {
    const { revalidateOutreachApprovalBeforeSend } = await import('./scheduler/approval-revalidate.js');
    const result = revalidateOutreachApprovalBeforeSend({
      workspaceId: '11111111-1111-1111-1111-111111111111',
      approvalId: '22222222-2222-2222-2222-222222222222',
    });
    expect(result).toEqual({ ok: true });
  });

  it('blocks when linked lead is suppressed after delay', async () => {
    const { createLead, updateLead } = await import('./leads.js');
    const {
      createSequence,
      enrollLead,
      processEnrollmentDueStep,
      markDeliveryStatus,
    } = await import('./sequence-engine.js');
    const { revalidateOutreachApprovalBeforeSend } = await import('./scheduler/approval-revalidate.js');

    const ws = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const { lead } = createLead({
      workspaceId: ws,
      name: 'Delay Lead',
      email: 'delay@example.com',
      source: 'manual',
    });
    const sequence = createSequence({
      workspaceId: ws,
      name: 'Reval seq',
      steps: [{ subject: 'Hi', body: 'Hello', delayHours: 0 }],
    });
    const enrollment = enrollLead({
      workspaceId: ws,
      leadId: lead.id,
      sequenceId: sequence.id,
      startAt: new Date('2020-01-01T12:00:00.000Z'),
    });
    const outcome = processEnrollmentDueStep(ws, enrollment.id, new Date('2020-01-01T12:00:00.000Z'));
    expect(outcome.kind).toBe('processed');
    if (outcome.kind !== 'processed') return;

    markDeliveryStatus(ws, outcome.delivery.id, 'pending_approval', {
      approvalId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    });

    updateLead(ws, lead.id, { status: 'suppressed', consentStatus: 'suppressed' });

    const blocked = revalidateOutreachApprovalBeforeSend({
      workspaceId: ws,
      approvalId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    });
    expect(blocked).toEqual({ ok: false, reason: 'suppressed' });
  });
});

describe.runIf(pgReady)('outreach due-job claim lease (postgres)', () => {
  it('claims atomically across concurrent workers and recovers stale leases', async () => {
    const {
      ensureOutreachDueJobSchema,
      enqueueOutreachDueJob,
      claimOutreachDueJob,
      completeOutreachDueJob,
    } = await import('./scheduler/due-job-queue.js');
    const { pool } = await import('../memory/db.js');
    await ensureOutreachDueJobSchema();

    const workspaceId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
    const enrollmentId = crypto.randomUUID();
    const stepId = crypto.randomUUID();

    await pool.query(
      `DELETE FROM outreach_due_jobs WHERE workspace_id = $1`,
      [workspaceId],
    );

    const job = await enqueueOutreachDueJob({
      workspaceId,
      enrollmentId,
      stepId,
      stepOrder: 0,
      dueAt: new Date(),
    });
    expect(job).not.toBeNull();

    const dup = await enqueueOutreachDueJob({
      workspaceId,
      enrollmentId,
      stepId,
      stepOrder: 0,
      dueAt: new Date(),
    });
    expect(dup).toBeNull();

    const [a, b] = await Promise.all([
      claimOutreachDueJob('worker-a'),
      claimOutreachDueJob('worker-b'),
    ]);
    const claimed = [a, b].filter(Boolean);
    expect(claimed).toHaveLength(1);
    expect(claimed[0]!.enrollmentId).toBe(enrollmentId);

    await pool.query(
      `UPDATE outreach_due_jobs
       SET status = 'running', locked_at = NOW() - INTERVAL '10 minutes', locked_by = 'crashed'
       WHERE id = $1`,
      [claimed[0]!.id],
    );
    const recovered = await claimOutreachDueJob('worker-c', 5 * 60_000);
    expect(recovered?.id).toBe(claimed[0]!.id);
    expect(recovered?.lockedBy).toBe('worker-c');

    await completeOutreachDueJob({
      jobId: recovered!.id,
      status: 'done',
      result: { test: true },
    });
  });

  it('dead-letters after max attempts and supports replay', async () => {
    const {
      ensureOutreachDueJobSchema,
      enqueueOutreachDueJob,
      claimOutreachDueJob,
      retryOutreachDueJob,
      listDeadLetterJobs,
      replayDeadLetterJob,
    } = await import('./scheduler/due-job-queue.js');
    const { pool } = await import('../memory/db.js');
    await ensureOutreachDueJobSchema();

    const workspaceId = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
    const enrollmentId = crypto.randomUUID();
    const stepId = crypto.randomUUID();
    await pool.query(`DELETE FROM outreach_due_jobs WHERE workspace_id = $1`, [workspaceId]);

    const job = await enqueueOutreachDueJob({
      workspaceId,
      enrollmentId,
      stepId,
      dueAt: new Date(),
    });
    expect(job).not.toBeNull();
    await pool.query(
      `UPDATE outreach_due_jobs SET max_attempts = 2 WHERE id = $1`,
      [job!.id],
    );

    const c1 = await claimOutreachDueJob('retry-worker');
    expect(c1?.id).toBe(job!.id);
    expect(await retryOutreachDueJob({ jobId: c1!.id, error: 'transient', availableAt: new Date() })).toBe('queued');

    const c2 = await claimOutreachDueJob('retry-worker');
    expect(c2?.id).toBe(job!.id);
    expect(await retryOutreachDueJob({ jobId: c2!.id, error: 'still_bad' })).toBe('dead');

    const dead = await listDeadLetterJobs(20);
    expect(dead.some((d) => d.id === job!.id)).toBe(true);

    const replayed = await replayDeadLetterJob(job!.id, 'test-operator');
    expect(replayed?.status).toBe('queued');
  });
});
