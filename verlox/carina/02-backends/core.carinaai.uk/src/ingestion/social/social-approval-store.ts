import { pool } from '../../memory/db.js';
import type { SocialChannelName } from '../../channels/social-channel-utils.js';

export type SocialApprovalStatus = 'pending' | 'approved' | 'sent' | 'rejected' | 'timeout';

export type SocialMessageType = 'dm' | 'post';

export interface WorkerSocialApproval {
  id: string;
  workerId: string;
  workspaceId: string;
  channel: SocialChannelName;
  contactId: string;
  conversationId: string | null;
  inboundText: string;
  draftText: string;
  platformMessageId: string | null;
  messageType: SocialMessageType;
  scheduledFor: Date | null;
  status: SocialApprovalStatus;
  requestedAt: Date;
  timeoutAt: Date;
  decisionBy: string | null;
  workerName?: string;
  workerRoleName?: string;
  workerTemplateId?: string | null;
}

function rowToApproval(row: Record<string, unknown>): WorkerSocialApproval {
  return {
    id: String(row.id),
    workerId: String(row.worker_id),
    workspaceId: String(row.workspace_id),
    channel: String(row.channel) as SocialChannelName,
    contactId: String(row.contact_id),
    conversationId: row.conversation_id ? String(row.conversation_id) : null,
    inboundText: String(row.inbound_text ?? ''),
    draftText: String(row.draft_text ?? ''),
    platformMessageId: row.platform_message_id ? String(row.platform_message_id) : null,
    messageType: (row.message_type === 'post' ? 'post' : 'dm') as SocialMessageType,
    scheduledFor: row.scheduled_for ? new Date(String(row.scheduled_for)) : null,
    status: String(row.status) as SocialApprovalStatus,
    requestedAt: new Date(String(row.requested_at)),
    timeoutAt: new Date(String(row.timeout_at)),
    decisionBy: row.decision_by ? String(row.decision_by) : null,
    workerName: row.worker_name ? String(row.worker_name) : undefined,
    workerRoleName: row.role_description ? String(row.role_description) : undefined,
    workerTemplateId: row.template_id ? String(row.template_id) : null,
  };
}

export async function createSocialApproval(input: {
  workerId: string;
  workspaceId: string;
  channel: SocialChannelName;
  contactId: string;
  conversationId?: string;
  inboundText: string;
  draftText: string;
  platformMessageId?: string;
  messageType?: SocialMessageType;
  scheduledFor?: Date;
}): Promise<WorkerSocialApproval> {
  const result = await pool.query(
    `INSERT INTO worker_social_approvals
       (worker_id, workspace_id, channel, contact_id, conversation_id, inbound_text, draft_text,
        platform_message_id, message_type, scheduled_for)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING *`,
    [
      input.workerId,
      input.workspaceId,
      input.channel,
      input.contactId,
      input.conversationId ?? null,
      input.inboundText,
      input.draftText,
      input.platformMessageId ?? null,
      input.messageType ?? 'dm',
      input.scheduledFor ?? null,
    ],
  );
  return rowToApproval(result.rows[0] as Record<string, unknown>);
}

export async function listPendingSocialApprovals(
  workspaceId: string,
  input?: { workerId?: string; channel?: string; limit?: number },
): Promise<WorkerSocialApproval[]> {
  const clauses = ['a.workspace_id = $1', "a.status = 'pending'"];
  const params: unknown[] = [workspaceId];
  if (input?.workerId) {
    params.push(input.workerId);
    clauses.push(`a.worker_id = $${params.length}`);
  }
  if (input?.channel) {
    params.push(input.channel);
    clauses.push(`a.channel = $${params.length}`);
  }
  params.push(input?.limit ?? 50);
  const result = await pool.query(
    `SELECT a.*, w.name AS worker_name, w.role_description, w.template_id
     FROM worker_social_approvals a
     JOIN ai_workers w ON w.id = a.worker_id
     WHERE ${clauses.join(' AND ')}
     ORDER BY a.requested_at DESC
     LIMIT $${params.length}`,
    params,
  );
  return result.rows.map((row) => rowToApproval(row as Record<string, unknown>));
}

export async function countPendingSocialApprovals(workspaceId: string): Promise<number> {
  const result = await pool.query(
    `SELECT COUNT(*)::int AS count FROM worker_social_approvals
     WHERE workspace_id = $1 AND status = 'pending'`,
    [workspaceId],
  );
  return Number(result.rows[0]?.count ?? 0);
}

export async function getSocialApproval(
  workspaceId: string,
  approvalId: string,
): Promise<WorkerSocialApproval | null> {
  const result = await pool.query(
    `SELECT a.*, w.name AS worker_name, w.role_description, w.template_id
     FROM worker_social_approvals a
     JOIN ai_workers w ON w.id = a.worker_id
     WHERE a.workspace_id = $1 AND a.id = $2`,
    [workspaceId, approvalId],
  );
  const row = result.rows[0];
  return row ? rowToApproval(row as Record<string, unknown>) : null;
}

export async function updateSocialApprovalDraft(input: {
  workspaceId: string;
  approvalId: string;
  draftText: string;
}): Promise<WorkerSocialApproval | null> {
  const result = await pool.query(
    `UPDATE worker_social_approvals SET draft_text = $3
     WHERE workspace_id = $1 AND id = $2 AND status = 'pending'
     RETURNING *`,
    [input.workspaceId, input.approvalId, input.draftText],
  );
  const row = result.rows[0];
  return row ? rowToApproval(row as Record<string, unknown>) : null;
}

export async function resolveSocialApproval(input: {
  workspaceId: string;
  approvalId: string;
  status: 'approved' | 'rejected';
  decisionBy: string;
}): Promise<WorkerSocialApproval | null> {
  const result = await pool.query(
    `UPDATE worker_social_approvals SET
       status = $4,
       decision_by = $3
     WHERE workspace_id = $1 AND id = $2 AND status = 'pending'
     RETURNING *`,
    [input.workspaceId, input.approvalId, input.decisionBy, input.status],
  );
  const row = result.rows[0];
  return row ? rowToApproval(row as Record<string, unknown>) : null;
}

export async function markSocialApprovalSent(approvalId: string): Promise<void> {
  await pool.query(
    `UPDATE worker_social_approvals SET status = 'sent' WHERE id = $1`,
    [approvalId],
  );
}

export async function expireTimedOutSocialApprovals(): Promise<string[]> {
  const result = await pool.query(
    `UPDATE worker_social_approvals SET status = 'timeout', decision_by = 'system_timeout'
     WHERE status = 'pending' AND timeout_at <= NOW()
     RETURNING id, workspace_id, worker_id`,
  );
  return result.rows.map((row) => String(row.id));
}
