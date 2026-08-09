/**
 * Outreach due-job queue: Postgres enqueue + FOR UPDATE SKIP LOCKED leases.
 * Mirrors src/workers/automation-run-queue.ts.
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { isDatabaseConfigured } from '../../config/database-url.js';
import { pool } from '../../memory/db.js';
import type {
  OutreachDueJob,
  OutreachDueJobStatus,
  OutreachSchedulerControl,
  OutreachSchedulerHealth,
} from './due-job-types.js';

let schemaReady: Promise<void> | null = null;

export function isOutreachDurableSchedulerEnabled(): boolean {
  const raw = (process.env.CARINA_OUTREACH_DURABLE_SCHEDULER || '').trim().toLowerCase();
  if (raw === 'false' || raw === '0' || raw === 'off') return false;
  if (raw === 'true' || raw === '1' || raw === 'on') return true;
  return isDatabaseConfigured();
}

export async function ensureOutreachDueJobSchema(): Promise<void> {
  if (!isDatabaseConfigured()) {
    throw new Error('DATABASE_URL is required for durable outreach scheduler');
  }
  if (!schemaReady) {
    schemaReady = (async () => {
      const here = path.dirname(fileURLToPath(import.meta.url));
      const migrationPath = path.resolve(
        here,
        '../../infrastructure/migrations/037-outreach-due-jobs.sql',
      );
      const sql = fs.readFileSync(migrationPath, 'utf8');
      await pool.query(sql);
    })().catch((err) => {
      schemaReady = null;
      throw err;
    });
  }
  await schemaReady;
}

function mapJob(row: Record<string, unknown>): OutreachDueJob {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    enrollmentId: String(row.enrollment_id),
    stepId: String(row.step_id),
    stepOrder: Number(row.step_order ?? 0),
    campaignId: row.campaign_id ? String(row.campaign_id) : null,
    sequenceId: row.sequence_id ? String(row.sequence_id) : null,
    status: String(row.status) as OutreachDueJobStatus,
    attempts: Number(row.attempts ?? 0),
    maxAttempts: Number(row.max_attempts ?? 8),
    lockedAt: row.locked_at ? new Date(String(row.locked_at)).toISOString() : null,
    lockedBy: row.locked_by ? String(row.locked_by) : null,
    availableAt: new Date(String(row.available_at)).toISOString(),
    dueAt: new Date(String(row.due_at)).toISOString(),
    lastError: row.last_error ? String(row.last_error) : null,
    deadLetterReason: row.dead_letter_reason ? String(row.dead_letter_reason) : null,
    result: row.result_json && typeof row.result_json === 'object'
      ? (row.result_json as Record<string, unknown>)
      : null,
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
    finishedAt: row.finished_at ? new Date(String(row.finished_at)).toISOString() : null,
  };
}

export async function enqueueOutreachDueJob(input: {
  workspaceId: string;
  enrollmentId: string;
  stepId: string;
  stepOrder?: number;
  campaignId?: string | null;
  sequenceId?: string | null;
  dueAt?: Date;
  availableAt?: Date;
}): Promise<OutreachDueJob | null> {
  await ensureOutreachDueJobSchema();
  const id = crypto.randomUUID();
  const dueAt = (input.dueAt ?? new Date()).toISOString();
  const availableAt = (input.availableAt ?? input.dueAt ?? new Date()).toISOString();
  try {
    const result = await pool.query(
      `INSERT INTO outreach_due_jobs
         (id, workspace_id, enrollment_id, step_id, step_order, campaign_id, sequence_id,
          status, available_at, due_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'queued',$8::timestamptz,$9::timestamptz)
       RETURNING *`,
      [
        id,
        input.workspaceId,
        input.enrollmentId,
        input.stepId,
        input.stepOrder ?? 0,
        input.campaignId ?? null,
        input.sequenceId ?? null,
        availableAt,
        dueAt,
      ],
    );
    return mapJob(result.rows[0] as Record<string, unknown>);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/unique|duplicate/i.test(msg)) return null;
    throw err;
  }
}

export async function claimOutreachDueJob(
  workerId: string,
  leaseStaleMs = 5 * 60_000,
): Promise<OutreachDueJob | null> {
  await ensureOutreachDueJobSchema();
  const staleBefore = new Date(Date.now() - leaseStaleMs).toISOString();
  const result = await pool.query(
    `UPDATE outreach_due_jobs AS j
     SET status = 'running',
         locked_at = NOW(),
         locked_by = $1,
         attempts = j.attempts + 1,
         updated_at = NOW()
     FROM (
       SELECT id FROM outreach_due_jobs
       WHERE (
           status IN ('queued', 'deferred')
           AND available_at <= NOW()
         )
         OR (
           status = 'running'
           AND locked_at IS NOT NULL
           AND locked_at < $2::timestamptz
         )
       ORDER BY available_at ASC, created_at ASC
       FOR UPDATE SKIP LOCKED
       LIMIT 1
     ) AS pick
     WHERE j.id = pick.id
     RETURNING j.*`,
    [workerId, staleBefore],
  );
  if (!result.rows[0]) return null;
  return mapJob(result.rows[0] as Record<string, unknown>);
}

export async function completeOutreachDueJob(input: {
  jobId: string;
  status: Extract<OutreachDueJobStatus, 'done' | 'skipped' | 'cancelled'>;
  result?: Record<string, unknown>;
  error?: string;
}): Promise<void> {
  await ensureOutreachDueJobSchema();
  await pool.query(
    `UPDATE outreach_due_jobs
     SET status = $2,
         result_json = $3::jsonb,
         last_error = $4,
         locked_at = NULL,
         locked_by = NULL,
         finished_at = NOW(),
         updated_at = NOW()
     WHERE id = $1`,
    [input.jobId, input.status, JSON.stringify(input.result ?? {}), input.error ?? null],
  );
  if (input.status === 'done' || input.status === 'skipped') {
    await bumpHeartbeatCounters({ processed: 1 });
  }
}

export async function deferOutreachDueJob(input: {
  jobId: string;
  availableAt: Date;
  reason: string;
}): Promise<void> {
  await ensureOutreachDueJobSchema();
  await pool.query(
    `UPDATE outreach_due_jobs
     SET status = 'deferred',
         available_at = $2::timestamptz,
         last_error = $3,
         locked_at = NULL,
         locked_by = NULL,
         updated_at = NOW()
     WHERE id = $1`,
    [input.jobId, input.availableAt.toISOString(), input.reason],
  );
}

export function computeBackoffMs(attempts: number, baseMs = 30_000, maxMs = 60 * 60_000): number {
  const exp = Math.min(maxMs, baseMs * 2 ** Math.max(0, attempts - 1));
  const jitter = Math.floor(Math.random() * Math.min(exp * 0.25, 15_000));
  return Math.min(maxMs, exp + jitter);
}

export async function retryOutreachDueJob(input: {
  jobId: string;
  error: string;
  availableAt?: Date;
}): Promise<'queued' | 'dead'> {
  await ensureOutreachDueJobSchema();
  const current = await pool.query(`SELECT * FROM outreach_due_jobs WHERE id = $1`, [input.jobId]);
  const row = current.rows[0] as Record<string, unknown> | undefined;
  if (!row) return 'dead';
  const attempts = Number(row.attempts ?? 0);
  const maxAttempts = Number(row.max_attempts ?? 8);
  if (attempts >= maxAttempts) {
    await deadLetterOutreachDueJob({
      jobId: input.jobId,
      reason: `max_attempts:${input.error}`,
    });
    return 'dead';
  }
  const availableAt = input.availableAt
    ?? new Date(Date.now() + computeBackoffMs(attempts));
  await pool.query(
    `UPDATE outreach_due_jobs
     SET status = 'queued',
         available_at = $2::timestamptz,
         last_error = $3,
         locked_at = NULL,
         locked_by = NULL,
         updated_at = NOW()
     WHERE id = $1`,
    [input.jobId, availableAt.toISOString(), input.error],
  );
  await bumpHeartbeatCounters({ retry: 1 });
  return 'queued';
}

export async function deadLetterOutreachDueJob(input: {
  jobId: string;
  reason: string;
}): Promise<void> {
  await ensureOutreachDueJobSchema();
  await pool.query(
    `UPDATE outreach_due_jobs
     SET status = 'dead',
         dead_letter_reason = $2,
         last_error = $2,
         locked_at = NULL,
         locked_by = NULL,
         finished_at = NOW(),
         updated_at = NOW()
     WHERE id = $1`,
    [input.jobId, input.reason],
  );
  await bumpHeartbeatCounters({ dead: 1 });
}

export async function cancelOpenJobsForEnrollment(
  workspaceId: string,
  enrollmentId: string,
  reason = 'enrollment_cancelled',
): Promise<number> {
  await ensureOutreachDueJobSchema();
  const result = await pool.query(
    `UPDATE outreach_due_jobs
     SET status = 'cancelled',
         last_error = $3,
         locked_at = NULL,
         locked_by = NULL,
         finished_at = NOW(),
         updated_at = NOW()
     WHERE workspace_id = $1
       AND enrollment_id = $2
       AND status IN ('queued', 'deferred', 'running')`,
    [workspaceId, enrollmentId, reason],
  );
  return result.rowCount ?? 0;
}

export async function replayDeadLetterJob(
  jobId: string,
  actor: string,
): Promise<OutreachDueJob | null> {
  await ensureOutreachDueJobSchema();
  const result = await pool.query(
    `UPDATE outreach_due_jobs
     SET status = 'queued',
         available_at = NOW(),
         dead_letter_reason = NULL,
         last_error = NULL,
         finished_at = NULL,
         locked_at = NULL,
         locked_by = NULL,
         updated_at = NOW()
     WHERE id = $1 AND status = 'dead'
     RETURNING *`,
    [jobId],
  );
  if (!result.rows[0]) return null;
  await appendSchedulerAudit(actor, 'replay_dead_letter', { jobId });
  return mapJob(result.rows[0] as Record<string, unknown>);
}

export async function listDeadLetterJobs(limit = 50): Promise<OutreachDueJob[]> {
  await ensureOutreachDueJobSchema();
  const result = await pool.query(
    `SELECT * FROM outreach_due_jobs
     WHERE status = 'dead'
     ORDER BY finished_at DESC NULLS LAST, updated_at DESC
     LIMIT $1`,
    [Math.min(200, Math.max(1, limit))],
  );
  return result.rows.map((row) => mapJob(row as Record<string, unknown>));
}

async function bumpHeartbeatCounters(input: {
  processed?: number;
  retry?: number;
  dead?: number;
}): Promise<void> {
  await pool.query(
    `INSERT INTO outreach_scheduler_heartbeat (key, processed_total, retry_total, dead_letter_total, updated_at)
     VALUES ('global', $1, $2, $3, NOW())
     ON CONFLICT (key) DO UPDATE SET
       processed_total = outreach_scheduler_heartbeat.processed_total + EXCLUDED.processed_total,
       retry_total = outreach_scheduler_heartbeat.retry_total + EXCLUDED.retry_total,
       dead_letter_total = outreach_scheduler_heartbeat.dead_letter_total + EXCLUDED.dead_letter_total,
       updated_at = NOW()`,
    [input.processed ?? 0, input.retry ?? 0, input.dead ?? 0],
  );
}

export async function touchSchedulerHeartbeat(input: {
  enqueueCount?: number;
  drainCount?: number;
}): Promise<void> {
  await ensureOutreachDueJobSchema();
  const enqueue = input.enqueueCount != null;
  const drain = input.drainCount != null;
  await pool.query(
    `INSERT INTO outreach_scheduler_heartbeat
       (key, enqueue_at, drain_at, last_enqueue_count, last_drain_count, updated_at)
     VALUES (
       'global',
       CASE WHEN $1 THEN NOW() ELSE NULL END,
       CASE WHEN $2 THEN NOW() ELSE NULL END,
       COALESCE($3, 0),
       COALESCE($4, 0),
       NOW()
     )
     ON CONFLICT (key) DO UPDATE SET
       enqueue_at = CASE WHEN $1 THEN NOW() ELSE outreach_scheduler_heartbeat.enqueue_at END,
       drain_at = CASE WHEN $2 THEN NOW() ELSE outreach_scheduler_heartbeat.drain_at END,
       last_enqueue_count = CASE WHEN $1 THEN COALESCE($3, 0) ELSE outreach_scheduler_heartbeat.last_enqueue_count END,
       last_drain_count = CASE WHEN $2 THEN COALESCE($4, 0) ELSE outreach_scheduler_heartbeat.last_drain_count END,
       updated_at = NOW()`,
    [enqueue, drain, input.enqueueCount ?? null, input.drainCount ?? null],
  );
}

export async function getSchedulerControl(): Promise<OutreachSchedulerControl> {
  await ensureOutreachDueJobSchema();
  const result = await pool.query(
    `SELECT * FROM outreach_scheduler_control WHERE key = 'global'`,
  );
  const row = (result.rows[0] ?? {
    key: 'global',
    paused: false,
    drain_mode: false,
    updated_at: new Date().toISOString(),
    updated_by: null,
    reason: null,
  }) as Record<string, unknown>;
  return {
    key: String(row.key ?? 'global'),
    paused: Boolean(row.paused),
    drainMode: Boolean(row.drain_mode),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
    updatedBy: row.updated_by ? String(row.updated_by) : null,
    reason: row.reason ? String(row.reason) : null,
  };
}

export async function setSchedulerControl(input: {
  paused?: boolean;
  drainMode?: boolean;
  updatedBy: string;
  reason?: string;
}): Promise<OutreachSchedulerControl> {
  await ensureOutreachDueJobSchema();
  const current = await getSchedulerControl();
  const paused = input.paused ?? current.paused;
  const drainMode = input.drainMode ?? current.drainMode;
  await pool.query(
    `INSERT INTO outreach_scheduler_control (key, paused, drain_mode, updated_at, updated_by, reason)
     VALUES ('global', $1, $2, NOW(), $3, $4)
     ON CONFLICT (key) DO UPDATE SET
       paused = EXCLUDED.paused,
       drain_mode = EXCLUDED.drain_mode,
       updated_at = NOW(),
       updated_by = EXCLUDED.updated_by,
       reason = EXCLUDED.reason`,
    [paused, drainMode, input.updatedBy, input.reason ?? null],
  );
  await appendSchedulerAudit(input.updatedBy, 'set_control', {
    paused,
    drainMode,
    reason: input.reason ?? null,
  });
  return getSchedulerControl();
}

export async function appendSchedulerAudit(
  actor: string,
  action: string,
  detail: Record<string, unknown> = {},
): Promise<void> {
  await ensureOutreachDueJobSchema();
  await pool.query(
    `INSERT INTO outreach_scheduler_audit (actor, action, detail)
     VALUES ($1, $2, $3::jsonb)`,
    [actor, action, JSON.stringify(detail)],
  );
}

export async function getSchedulerHealth(): Promise<OutreachSchedulerHealth> {
  await ensureOutreachDueJobSchema();
  const control = await getSchedulerControl();
  const counts = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'queued' AND available_at <= NOW())::int AS queue_depth,
       COUNT(*) FILTER (WHERE status = 'deferred')::int AS deferred_depth,
       COUNT(*) FILTER (WHERE status = 'running')::int AS running_depth,
       COUNT(*) FILTER (WHERE status = 'dead')::int AS dead_letter_count,
       MIN(due_at) FILTER (
         WHERE status IN ('queued', 'deferred', 'running')
       ) AS oldest_due
     FROM outreach_due_jobs`,
  );
  const hb = await pool.query(`SELECT * FROM outreach_scheduler_heartbeat WHERE key = 'global'`);
  const c = counts.rows[0] as Record<string, unknown>;
  const h = (hb.rows[0] ?? {}) as Record<string, unknown>;
  const oldestDue = c.oldest_due ? new Date(String(c.oldest_due)) : null;
  const drainAt = h.drain_at ? new Date(String(h.drain_at)) : null;
  const enqueueAt = h.enqueue_at ? new Date(String(h.enqueue_at)) : null;
  const heartbeatRef = drainAt ?? enqueueAt;
  return {
    paused: control.paused,
    drainMode: control.drainMode,
    queueDepth: Number(c.queue_depth ?? 0),
    deferredDepth: Number(c.deferred_depth ?? 0),
    runningDepth: Number(c.running_depth ?? 0),
    deadLetterCount: Number(c.dead_letter_count ?? 0),
    oldestDueAgeSeconds: oldestDue
      ? Math.max(0, Math.floor((Date.now() - oldestDue.getTime()) / 1000))
      : null,
    processedTotal: Number(h.processed_total ?? 0),
    retryTotal: Number(h.retry_total ?? 0),
    deadLetterTotal: Number(h.dead_letter_total ?? 0),
    enqueueAt: enqueueAt?.toISOString() ?? null,
    drainAt: drainAt?.toISOString() ?? null,
    heartbeatAgeSeconds: heartbeatRef
      ? Math.max(0, Math.floor((Date.now() - heartbeatRef.getTime()) / 1000))
      : null,
    durableEnabled: isOutreachDurableSchedulerEnabled(),
  };
}
