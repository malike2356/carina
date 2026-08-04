/**
 * Automation run queue with worker leases (FOR UPDATE SKIP LOCKED).
 */

import { pool } from '../memory/db.js';
import type {
  AutomationAction,
  AutomationActionType,
  AutomationApprovalMode,
  AutomationCondition,
  AutomationEventTrigger,
  AutomationRunStatus,
  AutomationSchedule,
  AutomationTriggerKind,
} from './automation-trigger-schema.js';

let schemaReady: Promise<void> | null = null;

export interface AutomationRunRecord {
  id: string;
  automationId: string;
  workerId: string;
  workspaceId: string;
  status: AutomationRunStatus;
  triggerKind: AutomationTriggerKind;
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  approvalStatus: string | null;
  attempts: number;
  lockedAt: string | null;
  lockedBy: string | null;
  durationMs: number | null;
  error: string | null;
  usage: Record<string, unknown> | null;
  actor: string;
  createdAt: string;
  finishedAt: string | null;
}

export async function ensureAutomationTriggerSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await pool.query(`
        ALTER TABLE ai_worker_automations
          ADD COLUMN IF NOT EXISTS schedule_json JSONB,
          ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'UTC',
          ADD COLUMN IF NOT EXISTS action_type TEXT DEFAULT 'aiva_prompt',
          ADD COLUMN IF NOT EXISTS action_json JSONB,
          ADD COLUMN IF NOT EXISTS conditions_json JSONB DEFAULT '[]'::jsonb,
          ADD COLUMN IF NOT EXISTS approval_mode TEXT DEFAULT 'require_write'
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS ai_worker_automation_runs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          automation_id UUID NOT NULL REFERENCES ai_worker_automations(id) ON DELETE CASCADE,
          worker_id UUID NOT NULL,
          workspace_id TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'queued',
          trigger_kind TEXT NOT NULL,
          payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
          result_json JSONB,
          approval_status TEXT,
          attempts INTEGER NOT NULL DEFAULT 0,
          locked_at TIMESTAMPTZ,
          locked_by TEXT,
          duration_ms INTEGER,
          error TEXT,
          usage_json JSONB,
          actor TEXT NOT NULL DEFAULT 'system',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          finished_at TIMESTAMPTZ
        )
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS ai_worker_automation_runs_claim_idx
          ON ai_worker_automation_runs (status, locked_at, created_at)
      `);
      await pool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS ai_worker_automation_runs_one_queued_idx
          ON ai_worker_automation_runs (automation_id)
          WHERE status = 'queued'
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS ai_worker_automations_due_idx
          ON ai_worker_automations (enabled, next_run_at)
          WHERE enabled = TRUE
      `);
    })().catch((err) => {
      schemaReady = null;
      throw err;
    });
  }
  await schemaReady;
}

function mapRun(row: Record<string, unknown>): AutomationRunRecord {
  return {
    id: String(row.id),
    automationId: String(row.automation_id),
    workerId: String(row.worker_id),
    workspaceId: String(row.workspace_id),
    status: String(row.status) as AutomationRunStatus,
    triggerKind: String(row.trigger_kind) as AutomationTriggerKind,
    payload: (row.payload_json && typeof row.payload_json === 'object')
      ? row.payload_json as Record<string, unknown>
      : {},
    result: (row.result_json && typeof row.result_json === 'object')
      ? row.result_json as Record<string, unknown>
      : null,
    approvalStatus: row.approval_status ? String(row.approval_status) : null,
    attempts: Number(row.attempts ?? 0),
    lockedAt: row.locked_at ? new Date(String(row.locked_at)).toISOString() : null,
    lockedBy: row.locked_by ? String(row.locked_by) : null,
    durationMs: row.duration_ms != null ? Number(row.duration_ms) : null,
    error: row.error ? String(row.error) : null,
    usage: (row.usage_json && typeof row.usage_json === 'object')
      ? row.usage_json as Record<string, unknown>
      : null,
    actor: String(row.actor ?? 'system'),
    createdAt: new Date(String(row.created_at)).toISOString(),
    finishedAt: row.finished_at ? new Date(String(row.finished_at)).toISOString() : null,
  };
}

export async function enqueueAutomationRun(input: {
  automationId: string;
  workerId: string;
  workspaceId: string;
  triggerKind: AutomationTriggerKind;
  payload?: Record<string, unknown>;
  actor?: string;
}): Promise<AutomationRunRecord | null> {
  await ensureAutomationTriggerSchema();
  try {
    const result = await pool.query(
      `INSERT INTO ai_worker_automation_runs
         (automation_id, worker_id, workspace_id, status, trigger_kind, payload_json, actor)
       VALUES ($1,$2,$3,'queued',$4,$5::jsonb,$6)
       RETURNING *`,
      [
        input.automationId,
        input.workerId,
        input.workspaceId,
        input.triggerKind,
        JSON.stringify(input.payload ?? {}),
        input.actor ?? 'system',
      ],
    );
    return mapRun(result.rows[0] as Record<string, unknown>);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/unique|duplicate/i.test(msg)) return null;
    throw err;
  }
}

export async function claimAutomationRun(
  workerId: string,
  leaseStaleMs = 5 * 60_000,
): Promise<AutomationRunRecord | null> {
  await ensureAutomationTriggerSchema();
  const staleBefore = new Date(Date.now() - leaseStaleMs).toISOString();
  const result = await pool.query(
    `UPDATE ai_worker_automation_runs AS r
     SET status = 'running',
         locked_at = NOW(),
         locked_by = $1,
         attempts = r.attempts + 1
     FROM (
       SELECT id FROM ai_worker_automation_runs
       WHERE status = 'queued'
          OR (status = 'running' AND locked_at IS NOT NULL AND locked_at < $2::timestamptz)
       ORDER BY created_at ASC
       FOR UPDATE SKIP LOCKED
       LIMIT 1
     ) AS pick
     WHERE r.id = pick.id
     RETURNING r.*`,
    [workerId, staleBefore],
  );
  if (!result.rows[0]) return null;
  return mapRun(result.rows[0] as Record<string, unknown>);
}

export async function completeAutomationRun(input: {
  runId: string;
  status: Extract<AutomationRunStatus, 'done' | 'failed' | 'skipped' | 'awaiting_approval'>;
  result?: Record<string, unknown>;
  error?: string;
  usage?: Record<string, unknown>;
  durationMs?: number;
  approvalStatus?: string;
}): Promise<void> {
  await ensureAutomationTriggerSchema();
  await pool.query(
    `UPDATE ai_worker_automation_runs
     SET status = $2,
         result_json = $3::jsonb,
         error = $4,
         usage_json = $5::jsonb,
         duration_ms = $6,
         approval_status = $7,
         finished_at = CASE WHEN $2 IN ('done','failed','skipped') THEN NOW() ELSE finished_at END,
         locked_at = CASE WHEN $2 IN ('done','failed','skipped','awaiting_approval') THEN NULL ELSE locked_at END
     WHERE id = $1`,
    [
      input.runId,
      input.status,
      JSON.stringify(input.result ?? {}),
      input.error ?? null,
      input.usage ? JSON.stringify(input.usage) : null,
      input.durationMs ?? null,
      input.approvalStatus ?? null,
    ],
  );
}

export async function approveAutomationRun(runId: string, actor: string): Promise<AutomationRunRecord | null> {
  await ensureAutomationTriggerSchema();
  const result = await pool.query(
    `UPDATE ai_worker_automation_runs
     SET status = 'queued',
         approval_status = 'approved',
         actor = $2,
         locked_at = NULL,
         locked_by = NULL
     WHERE id = $1 AND status = 'awaiting_approval'
     RETURNING *`,
    [runId, actor],
  );
  if (!result.rows[0]) return null;
  return mapRun(result.rows[0] as Record<string, unknown>);
}

export async function listAutomationRuns(
  automationId: string,
  limit = 50,
): Promise<AutomationRunRecord[]> {
  await ensureAutomationTriggerSchema();
  const result = await pool.query(
    `SELECT * FROM ai_worker_automation_runs
     WHERE automation_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [automationId, Math.min(limit, 200)],
  );
  return result.rows.map((row) => mapRun(row as Record<string, unknown>));
}

export async function listNoisyAutomations(limit = 50): Promise<Array<{
  automationId: string;
  workerId: string;
  workspaceId: string;
  failedRuns: number;
  lastError: string | null;
}>> {
  await ensureAutomationTriggerSchema();
  const result = await pool.query(
    `SELECT automation_id, worker_id, workspace_id,
            COUNT(*) FILTER (WHERE status = 'failed')::int AS failed_runs,
            MAX(error) FILTER (WHERE status = 'failed') AS last_error
     FROM ai_worker_automation_runs
     WHERE created_at > NOW() - INTERVAL '7 days'
     GROUP BY automation_id, worker_id, workspace_id
     HAVING COUNT(*) FILTER (WHERE status = 'failed') >= 3
     ORDER BY failed_runs DESC
     LIMIT $1`,
    [limit],
  );
  return result.rows.map((row) => ({
    automationId: String(row.automation_id),
    workerId: String(row.worker_id),
    workspaceId: String(row.workspace_id),
    failedRuns: Number(row.failed_runs),
    lastError: row.last_error ? String(row.last_error) : null,
  }));
}

export type StoredAutomationTrigger = {
  schedule?: AutomationSchedule | null;
  timezone?: string;
  event?: AutomationEventTrigger | null;
  actionType: AutomationActionType;
  action: AutomationAction;
  conditions: AutomationCondition[];
  approvalMode: AutomationApprovalMode;
};

export function readTriggerFields(row: Record<string, unknown>, fallbackPrompt: string): StoredAutomationTrigger {
  const actionType = (String(row.action_type ?? 'aiva_prompt') || 'aiva_prompt') as AutomationActionType;
  const actionRaw = row.action_json ?? { type: 'aiva_prompt', prompt: fallbackPrompt };
  const conditions = Array.isArray(row.conditions_json) ? row.conditions_json as AutomationCondition[] : [];
  return {
    schedule: (row.schedule_json && typeof row.schedule_json === 'object')
      ? row.schedule_json as AutomationSchedule
      : null,
    timezone: row.timezone ? String(row.timezone) : 'UTC',
    event: row.trigger_event
      ? {
          source: String(row.trigger_event) as AutomationEventTrigger['source'],
          eventType: undefined,
        }
      : null,
    actionType,
    action: (typeof actionRaw === 'object' && actionRaw)
      ? actionRaw as AutomationAction
      : { type: 'aiva_prompt', prompt: fallbackPrompt },
    conditions,
    approvalMode: (String(row.approval_mode ?? 'require_write') as AutomationApprovalMode),
  };
}
