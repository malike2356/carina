import { pool } from '../db.js';
import {
  broadcastApprovalDecision,
  broadcastApprovalRequest,
} from '../api/sse.js';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired';

export interface CreateApprovalInput {
  instanceId: string;
  sessionId: string;
  toolName?: string;
  actionType?: string;
  content?: string;
  params?: Record<string, unknown>;
  riskScore?: number;
  policyPack?: string;
  regulatoryCategory?: string;
  regulation?: string;
  expiresInSecs?: number;
}

export interface PendingApprovalRow {
  id: string;
  instance_id: string;
  session_id: string;
  tool_name: string | null;
  action_type: string;
  content: string | null;
  params: Record<string, unknown> | null;
  risk_score: number;
  policy_pack: string | null;
  regulatory_category: string | null;
  regulation: string | null;
  requested_at: Date;
  expires_at: Date;
  status: ApprovalStatus;
  decided_by: string | null;
  decided_at: Date | null;
  rejection_reason: string | null;
}

const DEFAULT_EXPIRES_SECS = 900;
const MIN_EXPIRES_SECS = 60;
const MAX_EXPIRES_SECS = 3600;

export function clampExpiresInSecs(value: number | undefined): number {
  const secs = value ?? DEFAULT_EXPIRES_SECS;
  return Math.min(MAX_EXPIRES_SECS, Math.max(MIN_EXPIRES_SECS, secs));
}

export async function createPendingApproval(input: CreateApprovalInput): Promise<PendingApprovalRow> {
  const expiresInSecs = clampExpiresInSecs(input.expiresInSecs);
  const result = await pool.query<PendingApprovalRow>(
    `INSERT INTO pending_approvals (
      instance_id, session_id, tool_name, action_type, content, params,
      risk_score, policy_pack, regulatory_category, regulation, expires_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW() + ($11 || ' seconds')::interval)
    RETURNING *`,
    [
      input.instanceId,
      input.sessionId,
      input.toolName ?? null,
      input.actionType ?? 'unknown',
      input.content ?? null,
      input.params ? JSON.stringify(input.params) : null,
      input.riskScore ?? 0,
      input.policyPack ?? null,
      input.regulatoryCategory ?? null,
      input.regulation ?? null,
      String(expiresInSecs),
    ],
  );

  const row = result.rows[0]!;
  broadcastApprovalRequest({
    approval_id: row.id,
    instance_id: row.instance_id,
    session_id: row.session_id,
    tool_name: row.tool_name,
    action_type: row.action_type,
    risk_score: row.risk_score,
    regulatory_category: row.regulatory_category,
    expires_at: row.expires_at.toISOString(),
  });

  return row;
}

export async function getApprovalById(id: string): Promise<PendingApprovalRow | null> {
  const result = await pool.query<PendingApprovalRow>(
    'SELECT * FROM pending_approvals WHERE id = $1',
    [id],
  );
  return result.rows[0] ?? null;
}

export async function expireApprovalIfNeeded(row: PendingApprovalRow): Promise<PendingApprovalRow> {
  if (row.status !== 'pending') return row;
  if (row.expires_at.getTime() > Date.now()) return row;

  const result = await pool.query<PendingApprovalRow>(
    `UPDATE pending_approvals
     SET status = 'expired'
     WHERE id = $1 AND status = 'pending'
     RETURNING *`,
    [row.id],
  );
  return result.rows[0] ?? { ...row, status: 'expired' };
}

export async function approvePendingApproval(
  id: string,
  decidedBy: string,
): Promise<PendingApprovalRow | 'not_found' | 'already_decided'> {
  const existing = await getApprovalById(id);
  if (!existing) return 'not_found';
  if (existing.status !== 'pending') return 'already_decided';

  const expired = await expireApprovalIfNeeded(existing);
  if (expired.status !== 'pending') return 'already_decided';

  const result = await pool.query<PendingApprovalRow>(
    `UPDATE pending_approvals
     SET status = 'approved', decided_by = $2, decided_at = NOW()
     WHERE id = $1 AND status = 'pending'
     RETURNING *`,
    [id, decidedBy],
  );
  const row = result.rows[0];
  if (!row) return 'already_decided';

  broadcastApprovalDecision({
    approval_id: row.id,
    status: 'approved',
    decided_by: row.decided_by ?? decidedBy,
    decided_at: row.decided_at?.toISOString() ?? new Date().toISOString(),
  });

  return row;
}

export async function rejectPendingApproval(
  id: string,
  decidedBy: string,
  reason?: string,
): Promise<PendingApprovalRow | 'not_found' | 'already_decided'> {
  const existing = await getApprovalById(id);
  if (!existing) return 'not_found';
  if (existing.status !== 'pending') return 'already_decided';

  const expired = await expireApprovalIfNeeded(existing);
  if (expired.status !== 'pending') return 'already_decided';

  const result = await pool.query<PendingApprovalRow>(
    `UPDATE pending_approvals
     SET status = 'rejected', decided_by = $2, decided_at = NOW(), rejection_reason = $3
     WHERE id = $1 AND status = 'pending'
     RETURNING *`,
    [id, decidedBy, reason ?? null],
  );
  const row = result.rows[0];
  if (!row) return 'already_decided';

  broadcastApprovalDecision({
    approval_id: row.id,
    status: 'rejected',
    decided_by: row.decided_by ?? decidedBy,
    decided_at: row.decided_at?.toISOString() ?? new Date().toISOString(),
  });

  return row;
}

export function toPendingListItem(row: PendingApprovalRow) {
  const expiresInSecs = Math.max(0, Math.floor((row.expires_at.getTime() - Date.now()) / 1000));
  return {
    id: row.id,
    instance_id: row.instance_id,
    session_id: row.session_id,
    tool_name: row.tool_name,
    action_type: row.action_type,
    risk_score: row.risk_score,
    regulatory_category: row.regulatory_category,
    regulation: row.regulation,
    requested_at: row.requested_at.toISOString(),
    expires_at: row.expires_at.toISOString(),
    expires_in_secs: expiresInSecs,
  };
}

export function toHistoryListItem(row: PendingApprovalRow) {
  return {
    ...toPendingListItem(row),
    status: row.status,
    decided_by: row.decided_by,
    decided_at: row.decided_at?.toISOString() ?? null,
    rejection_reason: row.rejection_reason,
  };
}

export async function listPendingApprovals(
  instanceId?: string,
  limit = 20,
): Promise<ReturnType<typeof toPendingListItem>[]> {
  const capped = Math.min(100, Math.max(1, limit));
  const result = instanceId
    ? await pool.query<PendingApprovalRow>(
      `SELECT * FROM pending_approvals
       WHERE status = 'pending' AND instance_id = $1
       ORDER BY requested_at DESC
       LIMIT $2`,
      [instanceId, capped],
    )
    : await pool.query<PendingApprovalRow>(
      `SELECT * FROM pending_approvals
       WHERE status = 'pending'
       ORDER BY requested_at DESC
       LIMIT $1`,
      [capped],
    );

  const rows: PendingApprovalRow[] = [];
  for (const row of result.rows) {
    rows.push(await expireApprovalIfNeeded(row));
  }

  return rows
    .filter((row) => row.status === 'pending')
    .map(toPendingListItem);
}

export async function listApprovalHistory(options: {
  status?: ApprovalStatus;
  since?: string;
  limit?: number;
}): Promise<ReturnType<typeof toHistoryListItem>[]> {
  const capped = Math.min(100, Math.max(1, options.limit ?? 20));
  const clauses = [`status != 'pending'`];
  const params: unknown[] = [];
  let idx = 1;

  if (options.status) {
    clauses.push(`status = $${idx++}`);
    params.push(options.status);
  }
  if (options.since) {
    clauses.push(`COALESCE(decided_at, expires_at) >= $${idx++}`);
    params.push(options.since);
  }

  params.push(capped);
  const result = await pool.query<PendingApprovalRow>(
    `SELECT * FROM pending_approvals
     WHERE ${clauses.join(' AND ')}
     ORDER BY COALESCE(decided_at, expires_at) DESC
     LIMIT $${idx}`,
    params,
  );

  return result.rows.map(toHistoryListItem);
}

export async function pendingApprovalsTableExists(): Promise<boolean> {
  const result = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'pending_approvals'
    ) AS exists`,
  );
  return result.rows[0]?.exists === true;
}

export async function fetchApprovalStats(): Promise<{
  workflow_active: boolean;
  pending_count: number;
  approved_30d: number;
  rejected_30d: number;
  expired_30d: number;
  avg_decision_secs: number | null;
}> {
  const workflowActive = await pendingApprovalsTableExists();
  if (!workflowActive) {
    return {
      workflow_active: false,
      pending_count: 0,
      approved_30d: 0,
      rejected_30d: 0,
      expired_30d: 0,
      avg_decision_secs: null,
    };
  }

  const result = await pool.query<{
    pending: string;
    approved_30d: string;
    rejected_30d: string;
    expired_30d: string;
    avg_secs: string | null;
  }>(`
    SELECT
      COUNT(*) FILTER (WHERE status = 'pending') AS pending,
      COUNT(*) FILTER (WHERE status = 'approved' AND decided_at > NOW() - INTERVAL '30 days') AS approved_30d,
      COUNT(*) FILTER (WHERE status = 'rejected' AND decided_at > NOW() - INTERVAL '30 days') AS rejected_30d,
      COUNT(*) FILTER (WHERE status = 'expired' AND expires_at > NOW() - INTERVAL '30 days') AS expired_30d,
      AVG(EXTRACT(EPOCH FROM (decided_at - requested_at))) FILTER (WHERE decided_at IS NOT NULL) AS avg_secs
    FROM pending_approvals
  `);

  const row = result.rows[0];
  return {
    workflow_active: true,
    pending_count: Number(row?.pending ?? 0),
    approved_30d: Number(row?.approved_30d ?? 0),
    rejected_30d: Number(row?.rejected_30d ?? 0),
    expired_30d: Number(row?.expired_30d ?? 0),
    avg_decision_secs: row?.avg_secs != null ? Number(row.avg_secs) : null,
  };
}
