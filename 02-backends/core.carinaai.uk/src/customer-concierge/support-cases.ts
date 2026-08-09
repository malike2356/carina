/**
 * Tenant customer-support cases (Prompt 702).
 * Separate from Carina product VA escalations.
 */
import { pool } from '../memory/db.js';
import { appendSecurityAudit } from '../security/security-audit.js';

export type SupportCaseStatus =
  | 'open'
  | 'pending_customer'
  | 'pending_operator'
  | 'resolved'
  | 'closed';

export type SupportCasePriority = 'low' | 'normal' | 'high' | 'urgent';

export interface SupportCaseRecord {
  id: string;
  workspaceId: string;
  workerId: string;
  conciergeProfileId: string | null;
  audienceSessionId: string | null;
  identityId: string | null;
  contactId: string | null;
  channel: string;
  subject: string;
  status: SupportCaseStatus;
  priority: SupportCasePriority;
  assigneeUserId: string | null;
  slaFirstResponseAt: string | null;
  slaResolutionAt: string | null;
  firstRespondedAt: string | null;
  resolvedAt: string | null;
  conversationSummary: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface SupportCaseEvent {
  id: string;
  caseId: string;
  workspaceId: string;
  eventType: string;
  actorType: 'system' | 'visitor' | 'ai' | 'operator' | 'owner';
  actorId: string | null;
  detail: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface InternalNote {
  id: string;
  workspaceId: string;
  workerId: string;
  caseId: string | null;
  audienceSessionId: string | null;
  authorUserId: string | null;
  body: string;
  createdAt: string;
}

function mapCase(row: Record<string, unknown>): SupportCaseRecord {
  const metadata =
    row.metadata && typeof row.metadata === 'object'
      ? (row.metadata as Record<string, unknown>)
      : {};
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    workerId: String(row.worker_id),
    conciergeProfileId: row.concierge_profile_id != null ? String(row.concierge_profile_id) : null,
    audienceSessionId: row.audience_session_id != null ? String(row.audience_session_id) : null,
    identityId: row.identity_id != null ? String(row.identity_id) : null,
    contactId: row.contact_id != null ? String(row.contact_id) : null,
    channel: String(row.channel ?? 'web'),
    subject: String(row.subject),
    status: String(row.status) as SupportCaseStatus,
    priority: String(row.priority) as SupportCasePriority,
    assigneeUserId: row.assignee_user_id != null ? String(row.assignee_user_id) : null,
    slaFirstResponseAt: row.sla_first_response_at
      ? new Date(String(row.sla_first_response_at)).toISOString()
      : null,
    slaResolutionAt: row.sla_resolution_at
      ? new Date(String(row.sla_resolution_at)).toISOString()
      : null,
    firstRespondedAt: row.first_responded_at
      ? new Date(String(row.first_responded_at)).toISOString()
      : null,
    resolvedAt: row.resolved_at ? new Date(String(row.resolved_at)).toISOString() : null,
    conversationSummary:
      row.conversation_summary != null ? String(row.conversation_summary) : null,
    metadata,
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
}

function mapEvent(row: Record<string, unknown>): SupportCaseEvent {
  const payload =
    row.payload && typeof row.payload === 'object'
      ? (row.payload as Record<string, unknown>)
      : {};
  return {
    id: String(row.id),
    caseId: String(row.case_id),
    workspaceId: String(row.workspace_id),
    eventType: String(row.event_type),
    actorType: String(row.actor_type) as SupportCaseEvent['actorType'],
    actorId: row.actor_id != null ? String(row.actor_id) : null,
    detail: row.detail != null ? String(row.detail) : null,
    payload,
    createdAt: new Date(String(row.created_at)).toISOString(),
  };
}

function mapNote(row: Record<string, unknown>): InternalNote {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    workerId: String(row.worker_id),
    caseId: row.case_id != null ? String(row.case_id) : null,
    audienceSessionId: row.audience_session_id != null ? String(row.audience_session_id) : null,
    authorUserId: row.author_user_id != null ? String(row.author_user_id) : null,
    body: String(row.body),
    createdAt: new Date(String(row.created_at)).toISOString(),
  };
}

async function appendCaseEvent(input: {
  caseId: string;
  workspaceId: string;
  eventType: string;
  actorType?: SupportCaseEvent['actorType'];
  actorId?: string | null;
  detail?: string | null;
  payload?: Record<string, unknown>;
}): Promise<void> {
  await pool.query(
    `INSERT INTO concierge_support_case_events (
       case_id, workspace_id, event_type, actor_type, actor_id, detail, payload
     ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
    [
      input.caseId,
      input.workspaceId,
      input.eventType,
      input.actorType ?? 'system',
      input.actorId ?? null,
      input.detail ?? null,
      JSON.stringify(input.payload ?? {}),
    ],
  );
}

export async function createSupportCase(input: {
  workspaceId: string;
  workerId: string;
  conciergeProfileId?: string | null;
  audienceSessionId?: string | null;
  identityId?: string | null;
  contactId?: string | null;
  channel?: string;
  subject: string;
  priority?: SupportCasePriority;
  conversationSummary?: string | null;
  metadata?: Record<string, unknown>;
  actorType?: SupportCaseEvent['actorType'];
  actorId?: string | null;
  slaFirstResponseHours?: number | null;
  slaResolutionHours?: number | null;
}): Promise<SupportCaseRecord> {
  const subject = input.subject.trim();
  if (!subject) {
    throw Object.assign(new Error('subject is required'), { status: 400 });
  }

  const slaFirst =
    input.slaFirstResponseHours != null && input.slaFirstResponseHours > 0
      ? new Date(Date.now() + input.slaFirstResponseHours * 3600_000)
      : null;
  const slaResolution =
    input.slaResolutionHours != null && input.slaResolutionHours > 0
      ? new Date(Date.now() + input.slaResolutionHours * 3600_000)
      : null;

  const result = await pool.query(
    `INSERT INTO concierge_support_cases (
       workspace_id, worker_id, concierge_profile_id, audience_session_id, identity_id,
       contact_id, channel, subject, status, priority, sla_first_response_at,
       sla_resolution_at, conversation_summary, metadata
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'open',$9,$10,$11,$12,$13::jsonb)
     RETURNING *`,
    [
      input.workspaceId,
      input.workerId,
      input.conciergeProfileId ?? null,
      input.audienceSessionId ?? null,
      input.identityId ?? null,
      input.contactId ?? null,
      input.channel ?? 'web',
      subject,
      input.priority ?? 'normal',
      slaFirst?.toISOString() ?? null,
      slaResolution?.toISOString() ?? null,
      input.conversationSummary ?? null,
      JSON.stringify(input.metadata ?? {}),
    ],
  );

  const record = mapCase(result.rows[0] as Record<string, unknown>);

  await appendCaseEvent({
    caseId: record.id,
    workspaceId: input.workspaceId,
    eventType: 'case_opened',
    actorType: input.actorType ?? 'ai',
    actorId: input.actorId ?? null,
    detail: subject,
  });

  if (input.audienceSessionId) {
    await pool.query(
      `UPDATE audience_sessions SET
         active_support_case_id = $2,
         conversation_summary = COALESCE($3, conversation_summary),
         updated_at = NOW()
       WHERE id = $1 AND workspace_id = $4`,
      [
        input.audienceSessionId,
        record.id,
        input.conversationSummary ?? null,
        input.workspaceId,
      ],
    );
  }

  appendSecurityAudit({
    category: 'auth',
    action: 'concierge_support_case_opened',
    detail: 'Customer concierge support case opened',
    metadata: {
      workspaceId: input.workspaceId,
      workerId: input.workerId,
      caseId: record.id,
      audienceSessionId: input.audienceSessionId ?? null,
      subject,
    },
  });

  return record;
}

export async function getSupportCase(input: {
  workspaceId: string;
  caseId: string;
}): Promise<SupportCaseRecord | null> {
  const result = await pool.query(
    `SELECT * FROM concierge_support_cases
     WHERE id = $1 AND workspace_id = $2
     LIMIT 1`,
    [input.caseId, input.workspaceId],
  );
  if (!result.rows[0]) return null;
  return mapCase(result.rows[0] as Record<string, unknown>);
}

export async function listSupportCases(input: {
  workspaceId: string;
  workerId?: string;
  status?: SupportCaseStatus | SupportCaseStatus[];
  limit?: number;
}): Promise<SupportCaseRecord[]> {
  const limit = Math.min(100, Math.max(1, input.limit ?? 50));
  const params: unknown[] = [input.workspaceId];
  const clauses = ['workspace_id = $1'];

  if (input.workerId) {
    params.push(input.workerId);
    clauses.push(`worker_id = $${params.length}`);
  }
  if (input.status) {
    const statuses = Array.isArray(input.status) ? input.status : [input.status];
    params.push(statuses);
    clauses.push(`status = ANY($${params.length}::text[])`);
  }
  params.push(limit);

  const result = await pool.query(
    `SELECT * FROM concierge_support_cases
     WHERE ${clauses.join(' AND ')}
     ORDER BY created_at DESC
     LIMIT $${params.length}`,
    params,
  );
  return result.rows.map((row) => mapCase(row as Record<string, unknown>));
}

export async function updateSupportCaseStatus(input: {
  workspaceId: string;
  caseId: string;
  status: SupportCaseStatus;
  actorType?: SupportCaseEvent['actorType'];
  actorId?: string | null;
  detail?: string | null;
}): Promise<SupportCaseRecord | null> {
  const resolvedAt =
    input.status === 'resolved' || input.status === 'closed' ? new Date().toISOString() : null;
  const result = await pool.query(
    `UPDATE concierge_support_cases SET
       status = $3,
       resolved_at = CASE
         WHEN $3 IN ('resolved', 'closed') THEN COALESCE(resolved_at, NOW())
         ELSE resolved_at
       END,
       first_responded_at = CASE
         WHEN $3 = 'pending_customer' THEN COALESCE(first_responded_at, NOW())
         ELSE first_responded_at
       END,
       updated_at = NOW()
     WHERE id = $1 AND workspace_id = $2
     RETURNING *`,
    [input.caseId, input.workspaceId, input.status],
  );
  if (!result.rows[0]) return null;
  const record = mapCase(result.rows[0] as Record<string, unknown>);
  await appendCaseEvent({
    caseId: record.id,
    workspaceId: input.workspaceId,
    eventType: 'status_changed',
    actorType: input.actorType ?? 'operator',
    actorId: input.actorId ?? null,
    detail: input.detail ?? `status=${input.status}`,
    payload: { status: input.status, resolvedAt },
  });
  return record;
}

export async function addInternalNote(input: {
  workspaceId: string;
  workerId: string;
  caseId?: string | null;
  audienceSessionId?: string | null;
  authorUserId?: string | null;
  body: string;
}): Promise<InternalNote> {
  const body = input.body.trim();
  if (!body) {
    throw Object.assign(new Error('body is required'), { status: 400 });
  }
  const result = await pool.query(
    `INSERT INTO concierge_internal_notes (
       workspace_id, worker_id, case_id, audience_session_id, author_user_id, body
     ) VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING *`,
    [
      input.workspaceId,
      input.workerId,
      input.caseId ?? null,
      input.audienceSessionId ?? null,
      input.authorUserId ?? null,
      body,
    ],
  );
  const note = mapNote(result.rows[0] as Record<string, unknown>);
  if (input.caseId) {
    await appendCaseEvent({
      caseId: input.caseId,
      workspaceId: input.workspaceId,
      eventType: 'internal_note',
      actorType: 'operator',
      actorId: input.authorUserId ?? null,
      detail: 'Internal note added',
      payload: { noteId: note.id },
    });
  }
  return note;
}

export async function listInternalNotes(input: {
  workspaceId: string;
  caseId: string;
}): Promise<InternalNote[]> {
  const result = await pool.query(
    `SELECT * FROM concierge_internal_notes
     WHERE workspace_id = $1 AND case_id = $2
     ORDER BY created_at ASC`,
    [input.workspaceId, input.caseId],
  );
  return result.rows.map((row) => mapNote(row as Record<string, unknown>));
}

export async function listCaseEvents(input: {
  workspaceId: string;
  caseId: string;
}): Promise<SupportCaseEvent[]> {
  const result = await pool.query(
    `SELECT * FROM concierge_support_case_events
     WHERE workspace_id = $1 AND case_id = $2
     ORDER BY created_at ASC`,
    [input.workspaceId, input.caseId],
  );
  return result.rows.map((row) => mapEvent(row as Record<string, unknown>));
}
