import { pool } from '../memory/db.js';
import { humanAssistEnabled, humanAssistFairUsePerMonth } from './human-assist-config.js';
import {
  getHumanAssistBridgeConfig,
  isHumanAssistBridgeEnabled,
  recordHumanAssistPublishResult,
} from './human-assist-bridge-config.js';

export { humanAssistEnabled, humanAssistFairUsePerMonth } from './human-assist-config.js';
export type HumanAssistUrgency = 'normal' | 'urgent';
export type HumanAssistStatus =
  | 'queued'
  | 'assigned'
  | 'in_progress'
  | 'done'
  | 'declined'
  | 'capacity';

export type HumanAssistRequest = {
  id: string;
  workspaceId: string;
  workerId: string | null;
  reason: string;
  urgency: HumanAssistUrgency;
  channel: string;
  threadRef: string;
  status: HumanAssistStatus;
  assigneeEmail: string | null;
  assigneeVaMemberId: string | null;
  notes: string;
  claimedAt: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
};

const ALLOWED_TRANSITIONS: Record<HumanAssistStatus, HumanAssistStatus[]> = {
  queued: ['assigned', 'declined', 'capacity'],
  assigned: ['in_progress', 'queued', 'declined', 'done'],
  in_progress: ['done', 'declined', 'assigned'],
  done: [],
  declined: [],
  capacity: [],
};

export function canHumanAssistTransition(
  from: HumanAssistStatus,
  to: HumanAssistStatus,
): boolean {
  return (ALLOWED_TRANSITIONS[from] ?? []).includes(to);
}

async function ensureSchema(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS aiva_human_assist_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id UUID NOT NULL,
      worker_id UUID REFERENCES ai_workers(id) ON DELETE SET NULL,
      reason TEXT NOT NULL DEFAULT '',
      urgency TEXT NOT NULL DEFAULT 'normal',
      channel TEXT NOT NULL DEFAULT '',
      thread_ref TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'queued',
      meta JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      resolved_at TIMESTAMPTZ,
      assignee_email TEXT,
      assignee_va_member_id TEXT,
      external_job_id TEXT,
      notes TEXT NOT NULL DEFAULT '',
      claimed_at TIMESTAMPTZ
    );
  `);
  await pool.query(`
    ALTER TABLE aiva_human_assist_requests
      ADD COLUMN IF NOT EXISTS assignee_email TEXT,
      ADD COLUMN IF NOT EXISTS assignee_va_member_id TEXT,
      ADD COLUMN IF NOT EXISTS external_job_id TEXT,
      ADD COLUMN IF NOT EXISTS notes TEXT NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;
  `).catch(() => undefined);
}

function mapRow(row: Record<string, unknown>): HumanAssistRequest {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id ?? ''),
    workerId: row.worker_id ? String(row.worker_id) : null,
    reason: String(row.reason ?? ''),
    urgency: (row.urgency === 'urgent' ? 'urgent' : 'normal'),
    channel: String(row.channel ?? ''),
    threadRef: String(row.thread_ref ?? ''),
    status: String(row.status) as HumanAssistStatus,
    assigneeEmail: row.assignee_email ? String(row.assignee_email) : null,
    assigneeVaMemberId: row.assignee_va_member_id ? String(row.assignee_va_member_id) : null,
    notes: String(row.notes ?? ''),
    claimedAt: row.claimed_at ? new Date(String(row.claimed_at)).toISOString() : null,
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
    resolvedAt: row.resolved_at ? new Date(String(row.resolved_at)).toISOString() : null,
  };
}

export async function countAssistRequestsThisMonth(workspaceId: string): Promise<number> {
  await ensureSchema();
  const result = await pool.query(
    `SELECT COUNT(*)::int AS n FROM aiva_human_assist_requests
     WHERE workspace_id = $1
       AND created_at >= date_trunc('month', NOW() AT TIME ZONE 'UTC')`,
    [workspaceId],
  );
  return Number(result.rows[0]?.n ?? 0);
}

export async function createHumanAssistRequest(input: {
  workspaceId: string;
  reason: string;
  urgency?: string;
  workerId?: string | null;
  channel?: string;
  threadRef?: string;
}): Promise<{ ok: boolean; request?: HumanAssistRequest; error?: string; code?: string }> {
  await ensureSchema();
  if (!humanAssistEnabled()) {
    return {
      ok: false,
      code: 'feature_disabled',
      error: 'Human assist requests are disabled for this environment.',
    };
  }
  const reason = input.reason.trim();
  if (!reason) {
    return { ok: false, code: 'invalid', error: 'reason is required' };
  }
  const used = await countAssistRequestsThisMonth(input.workspaceId);
  const fairUse = humanAssistFairUsePerMonth();
  if (fairUse > 0 && used >= fairUse) {
    const insert = await pool.query(
      `INSERT INTO aiva_human_assist_requests
        (workspace_id, worker_id, reason, urgency, channel, thread_ref, status, meta, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'capacity', $7::jsonb, NOW())
       RETURNING *`,
      [
        input.workspaceId,
        input.workerId ?? null,
        reason,
        input.urgency === 'urgent' ? 'urgent' : 'normal',
        input.channel?.trim() ?? '',
        input.threadRef?.trim() ?? '',
        JSON.stringify({ fairUse, used, fee: 0 }),
      ],
    );
    return {
      ok: false,
      code: 'capacity',
      error: `Fair use reached (${fairUse}/month). Request recorded as capacity; try next month or lower urgency cases first.`,
      request: mapRow(insert.rows[0]),
    };
  }

  const insert = await pool.query(
    `INSERT INTO aiva_human_assist_requests
      (workspace_id, worker_id, reason, urgency, channel, thread_ref, status, meta, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, 'queued', $7::jsonb, NOW())
     RETURNING *`,
    [
      input.workspaceId,
      input.workerId ?? null,
      reason,
      input.urgency === 'urgent' ? 'urgent' : 'normal',
      input.channel?.trim() ?? '',
      input.threadRef?.trim() ?? '',
      JSON.stringify({ fee: 0, fairUse, used: used + 1 }),
    ],
  );
  const request = mapRow(insert.rows[0]);
  void publishHumanAssistRequestToMis(request).catch(() => undefined);
  return { ok: true, request };
}

export async function listHumanAssistRequests(workspaceId: string) {
  await ensureSchema();
  const result = await pool.query(
    `SELECT * FROM aiva_human_assist_requests
     WHERE workspace_id = $1
     ORDER BY created_at DESC
     LIMIT 100`,
    [workspaceId],
  );
  return result.rows.map(mapRow);
}

export async function listOpsHumanAssistRequests(input?: {
  status?: string;
  limit?: number;
}): Promise<HumanAssistRequest[]> {
  await ensureSchema();
  const statuses = (input?.status ?? 'queued,assigned,in_progress')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const limit = Math.min(Math.max(input?.limit ?? 100, 1), 500);
  const result = await pool.query(
    `SELECT * FROM aiva_human_assist_requests
     WHERE status = ANY($1::text[])
     ORDER BY
       CASE WHEN urgency = 'urgent' THEN 0 ELSE 1 END,
       created_at ASC
     LIMIT $2`,
    [statuses, limit],
  );
  return result.rows.map(mapRow);
}

export async function getHumanAssistRequestById(id: string): Promise<HumanAssistRequest | null> {
  await ensureSchema();
  const result = await pool.query(`SELECT * FROM aiva_human_assist_requests WHERE id = $1`, [id]);
  if (!result.rows[0]) return null;
  return mapRow(result.rows[0]);
}

export async function claimHumanAssistRequest(input: {
  id: string;
  assigneeEmail: string;
  vaMemberId?: string | null;
}): Promise<{ ok: boolean; request?: HumanAssistRequest; error?: string; code?: string }> {
  await ensureSchema();
  const email = input.assigneeEmail.trim().toLowerCase();
  if (!email) return { ok: false, code: 'invalid', error: 'assigneeEmail required' };

  const current = await getHumanAssistRequestById(input.id);
  if (!current) return { ok: false, code: 'not_found', error: 'Request not found' };

  if (current.status === 'assigned' && current.assigneeEmail === email) {
    return { ok: true, request: current };
  }
  if (current.status !== 'queued') {
    if (current.status === 'assigned' && current.assigneeEmail && current.assigneeEmail !== email) {
      return { ok: false, code: 'conflict', error: 'Already claimed by another VA' };
    }
    return { ok: false, code: 'conflict', error: `Cannot claim from status ${current.status}` };
  }

  const result = await pool.query(
    `UPDATE aiva_human_assist_requests
     SET status = 'assigned',
         assignee_email = $2,
         assignee_va_member_id = $3,
         claimed_at = NOW(),
         updated_at = NOW()
     WHERE id = $1 AND status = 'queued'
     RETURNING *`,
    [input.id, email, input.vaMemberId?.trim() || null],
  );
  if (!result.rows[0]) {
    return { ok: false, code: 'conflict', error: 'Could not claim (race or status changed)' };
  }
  return { ok: true, request: mapRow(result.rows[0]) };
}

export async function updateHumanAssistRequestStatus(input: {
  id: string;
  status: string;
  notes?: string;
  assigneeEmail?: string;
}): Promise<{ ok: boolean; request?: HumanAssistRequest; error?: string; code?: string }> {
  await ensureSchema();
  const next = input.status as HumanAssistStatus;
  if (!ALLOWED_TRANSITIONS[next] && !['queued', 'assigned', 'in_progress', 'done', 'declined', 'capacity'].includes(next)) {
    return { ok: false, code: 'invalid', error: 'Invalid status' };
  }
  const current = await getHumanAssistRequestById(input.id);
  if (!current) return { ok: false, code: 'not_found', error: 'Request not found' };

  const allowed = ALLOWED_TRANSITIONS[current.status] ?? [];
  if (current.status === next) {
    if (input.notes !== undefined) {
      const updated = await pool.query(
        `UPDATE aiva_human_assist_requests SET notes = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
        [input.id, input.notes.slice(0, 4000)],
      );
      return { ok: true, request: mapRow(updated.rows[0]) };
    }
    return { ok: true, request: current };
  }
  if (!allowed.includes(next)) {
    return {
      ok: false,
      code: 'conflict',
      error: `Cannot transition from ${current.status} to ${next}`,
    };
  }
  if (input.assigneeEmail && current.assigneeEmail && current.assigneeEmail !== input.assigneeEmail.trim().toLowerCase()) {
    if (current.status === 'assigned' || current.status === 'in_progress') {
      return { ok: false, code: 'forbidden', error: 'Only the assignee may update this request' };
    }
  }

  const resolved = next === 'done' || next === 'declined' || next === 'capacity';
  const result = await pool.query(
    `UPDATE aiva_human_assist_requests
     SET status = $2,
         notes = COALESCE($3, notes),
         updated_at = NOW(),
         resolved_at = CASE WHEN $4 THEN NOW() ELSE resolved_at END
     WHERE id = $1
     RETURNING *`,
    [
      input.id,
      next,
      input.notes !== undefined ? input.notes.slice(0, 4000) : null,
      resolved,
    ],
  );
  return { ok: true, request: mapRow(result.rows[0]) };
}

/** Best-effort push to Laravel MIS webhook. Never fails the owner create path. */
export async function publishHumanAssistRequestToMis(
  request: HumanAssistRequest,
): Promise<{ ok: boolean; error?: string }> {
  if (!isHumanAssistBridgeEnabled()) {
    return { ok: false, error: 'bridge disabled' };
  }
  const cfg = await getHumanAssistBridgeConfig();
  if (!cfg.enabled) return { ok: false, error: 'bridge disabled' };
  if (cfg.publishMode === 'poll_only') return { ok: true };
  if (!cfg.bridgeToken) {
    await recordHumanAssistPublishResult({ ok: false, error: 'bridge token missing' });
    return { ok: false, error: 'bridge token missing' };
  }

  const url = `${cfg.misBaseUrl}/mis/va/aiva-assist/webhook`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${cfg.bridgeToken}`,
        'X-Carina-Bridge-Token': cfg.bridgeToken,
      },
      body: JSON.stringify({
        aivaRequestId: request.id,
        workspaceId: request.workspaceId,
        reason: request.reason,
        urgency: request.urgency,
        channel: request.channel,
        threadRef: request.threadRef,
        status: request.status,
        workerId: request.workerId,
        createdAt: request.createdAt,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      const error = `HTTP ${res.status}: ${text.slice(0, 200)}`;
      await recordHumanAssistPublishResult({ ok: false, error });
      return { ok: false, error };
    }
    await recordHumanAssistPublishResult({ ok: true });
    return { ok: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    await recordHumanAssistPublishResult({ ok: false, error });
    return { ok: false, error };
  }
}
