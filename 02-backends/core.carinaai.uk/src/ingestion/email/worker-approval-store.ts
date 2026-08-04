import { pool } from '../../memory/db.js';
import type { EmailCategory } from './email-categorizer.js';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'timeout' | 'sent';

export interface WorkerEmailApproval {
  id: string;
  workerId: string;
  workspaceId: string;
  digestId: string | null;
  messageId: string | null;
  actionType: string;
  category: EmailCategory;
  recipient: string;
  subject: string;
  draftBody: string;
  originalFrom: string | null;
  status: ApprovalStatus;
  requestedAt: Date;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  decision: string | null;
  modifiedBody: string | null;
  timeoutAt: Date;
}

function rowToApproval(row: Record<string, unknown>): WorkerEmailApproval {
  return {
    id: String(row.id),
    workerId: String(row.worker_id),
    workspaceId: String(row.workspace_id),
    digestId: row.digest_id ? String(row.digest_id) : null,
    messageId: row.message_id ? String(row.message_id) : null,
    actionType: String(row.action_type),
    category: String(row.category) as EmailCategory,
    recipient: String(row.recipient),
    subject: String(row.subject),
    draftBody: String(row.draft_body),
    originalFrom: row.original_from ? String(row.original_from) : null,
    status: String(row.status) as ApprovalStatus,
    requestedAt: new Date(String(row.requested_at)),
    reviewedBy: row.reviewed_by ? String(row.reviewed_by) : null,
    reviewedAt: row.reviewed_at ? new Date(String(row.reviewed_at)) : null,
    decision: row.decision ? String(row.decision) : null,
    modifiedBody: row.modified_body ? String(row.modified_body) : null,
    timeoutAt: new Date(String(row.timeout_at)),
  };
}

export async function createEmailApproval(input: {
  workerId: string;
  workspaceId: string;
  digestId?: string;
  messageId?: string;
  category: EmailCategory;
  recipient: string;
  subject: string;
  draftBody: string;
  originalFrom?: string;
}): Promise<WorkerEmailApproval> {
  const result = await pool.query(
    `INSERT INTO worker_email_approvals
       (worker_id, workspace_id, digest_id, message_id, category, recipient, subject, draft_body, original_from)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [
      input.workerId,
      input.workspaceId,
      input.digestId ?? null,
      input.messageId ?? null,
      input.category,
      input.recipient,
      input.subject,
      input.draftBody,
      input.originalFrom ?? null,
    ],
  );
  return rowToApproval(result.rows[0] as Record<string, unknown>);
}

export async function listPendingApprovals(workspaceId: string, limit = 50): Promise<WorkerEmailApproval[]> {
  const result = await pool.query(
    `SELECT * FROM worker_email_approvals
     WHERE workspace_id = $1 AND status = 'pending'
     ORDER BY requested_at DESC
     LIMIT $2`,
    [workspaceId, limit],
  );
  return result.rows.map((row) => rowToApproval(row as Record<string, unknown>));
}

export async function countPendingEmailApprovals(workspaceId: string): Promise<number> {
  const result = await pool.query(
    `SELECT COUNT(*)::int AS count FROM worker_email_approvals
     WHERE workspace_id = $1 AND status = 'pending'`,
    [workspaceId],
  );
  return Number(result.rows[0]?.count ?? 0) || 0;
}

export async function getApproval(
  workspaceId: string,
  approvalId: string,
): Promise<WorkerEmailApproval | null> {
  const result = await pool.query(
    'SELECT * FROM worker_email_approvals WHERE workspace_id = $1 AND id = $2',
    [workspaceId, approvalId],
  );
  const row = result.rows[0];
  return row ? rowToApproval(row as Record<string, unknown>) : null;
}

export async function resolveApproval(input: {
  workspaceId: string;
  approvalId: string;
  decision: 'approved' | 'rejected' | 'modified';
  reviewedBy: string;
  modifiedBody?: string;
}): Promise<WorkerEmailApproval | null> {
  const result = await pool.query(
    `UPDATE worker_email_approvals SET
       status = CASE WHEN $4 = 'rejected' THEN 'rejected' ELSE 'approved' END,
       decision = $4,
       reviewed_by = $3,
       reviewed_at = NOW(),
       modified_body = $5
     WHERE workspace_id = $1 AND id = $2 AND status = 'pending'
     RETURNING *`,
    [input.workspaceId, input.approvalId, input.reviewedBy, input.decision, input.modifiedBody ?? null],
  );
  const row = result.rows[0];
  return row ? rowToApproval(row as Record<string, unknown>) : null;
}

export async function markApprovalSent(approvalId: string): Promise<void> {
  await pool.query(
    `UPDATE worker_email_approvals SET status = 'sent' WHERE id = $1`,
    [approvalId],
  );
}

export async function expireTimedOutApprovals(): Promise<number> {
  const result = await pool.query(
    `UPDATE worker_email_approvals SET status = 'timeout', decision = 'timeout'
     WHERE status = 'pending' AND timeout_at <= NOW()
     RETURNING id`,
  );
  return result.rowCount ?? 0;
}

export async function queueWorkerTrigger(input: {
  workerId: string;
  workspaceId: string;
  triggerType: string;
  triggerDetail: Record<string, unknown>;
}): Promise<void> {
  await pool.query(
    `INSERT INTO worker_pending_triggers (worker_id, workspace_id, trigger_type, trigger_detail)
     VALUES ($1, $2, $3, $4)`,
    [input.workerId, input.workspaceId, input.triggerType, JSON.stringify(input.triggerDetail)],
  );
}

export async function drainPendingTriggers(workerId: string): Promise<number> {
  const result = await pool.query(
    'SELECT id FROM worker_pending_triggers WHERE worker_id = $1 ORDER BY queued_at ASC',
    [workerId],
  );
  if (result.rows.length === 0) return 0;
  await pool.query('DELETE FROM worker_pending_triggers WHERE worker_id = $1', [workerId]);
  return result.rowCount ?? result.rows.length;
}

export async function consumePendingTriggers(workerId: string): Promise<Array<{
  triggerType: string;
  triggerDetail: Record<string, unknown>;
}>> {
  const result = await pool.query(
    'SELECT trigger_type, trigger_detail FROM worker_pending_triggers WHERE worker_id = $1 ORDER BY queued_at ASC',
    [workerId],
  );
  if (result.rows.length === 0) return [];
  await pool.query('DELETE FROM worker_pending_triggers WHERE worker_id = $1', [workerId]);
  return result.rows.map((row) => ({
    triggerType: String(row.trigger_type),
    triggerDetail: (row.trigger_detail ?? {}) as Record<string, unknown>,
  }));
}
