import { pool } from '../memory/db.js';

export type EmailUrgency = 'low' | 'normal' | 'high';
export type EmailTriageStatus = 'inbox' | 'archived' | 'spam';

export interface InboundEmailRow {
  id: string;
  from_address: string;
  to_address: string;
  subject: string | null;
  body_text: string | null;
  body_html: string | null;
  message_id: string | null;
  read: boolean;
  urgency: EmailUrgency;
  triage_status: EmailTriageStatus;
  received_at: string;
}

export interface EmailListResult {
  emails: InboundEmailRow[];
  total: number;
}

function rowToEmail(row: Record<string, unknown>): InboundEmailRow {
  return {
    id: String(row.id),
    from_address: String(row.from_address),
    to_address: String(row.to_address),
    subject: row.subject == null ? null : String(row.subject),
    body_text: row.body_text == null ? null : String(row.body_text),
    body_html: row.body_html == null ? null : String(row.body_html),
    message_id: row.message_id == null ? null : String(row.message_id),
    read: Boolean(row.read),
    urgency: (String(row.urgency ?? 'normal') as EmailUrgency),
    triage_status: (String(row.triage_status ?? 'inbox') as EmailTriageStatus),
    received_at: String(row.received_at),
  };
}

export function toEmailResponse(row: InboundEmailRow): InboundEmailRow & { preview: string } {
  const preview = (row.body_text ?? '').replace(/\s+/g, ' ').trim().slice(0, 240);
  return { ...row, preview };
}

export async function listInboundEmails(options?: {
  limit?: number;
  unreadOnly?: boolean;
  triageStatus?: EmailTriageStatus;
  q?: string;
}): Promise<EmailListResult> {
  const limit = Math.min(100, Math.max(1, Number(options?.limit ?? 50)));
  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  if (options?.unreadOnly) {
    conditions.push('read = FALSE');
  }
  if (options?.triageStatus) {
    conditions.push(`triage_status = $${paramIndex++}`);
    params.push(options.triageStatus);
  }
  if (options?.q?.trim()) {
    conditions.push(`(
      subject ILIKE $${paramIndex}
      OR from_address ILIKE $${paramIndex}
      OR body_text ILIKE $${paramIndex}
    )`);
    params.push(`%${options.q.trim()}%`);
    paramIndex += 1;
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const countSql = `SELECT COUNT(*)::int AS count FROM inbound_emails ${where}`;
  const listSql = `SELECT id, from_address, to_address, subject, body_text, body_html, message_id,
    read, COALESCE(urgency, 'normal') AS urgency, COALESCE(triage_status, 'inbox') AS triage_status,
    received_at
    FROM inbound_emails ${where}
    ORDER BY received_at DESC LIMIT $${paramIndex}`;

  const countResult = await pool.query(countSql, params);
  const listParams = [...params, limit];
  const listResult = await pool.query(listSql, listParams);

  return {
    emails: listResult.rows.map((row) => rowToEmail(row as Record<string, unknown>)),
    total: Number(countResult.rows[0]?.count ?? 0),
  };
}

export async function getInboundEmail(id: string): Promise<InboundEmailRow | null> {
  const result = await pool.query(
    `SELECT id, from_address, to_address, subject, body_text, body_html, message_id,
      read, COALESCE(urgency, 'normal') AS urgency, COALESCE(triage_status, 'inbox') AS triage_status,
      received_at
     FROM inbound_emails WHERE id = $1`,
    [id],
  );
  const row = result.rows[0] as Record<string, unknown> | undefined;
  return row ? rowToEmail(row) : null;
}

export async function updateInboundEmail(
  id: string,
  patch: Partial<{ read: boolean; urgency: EmailUrgency; triage_status: EmailTriageStatus }>,
): Promise<InboundEmailRow | null> {
  const sets: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  if (patch.read != null) {
    sets.push(`read = $${paramIndex++}`);
    params.push(patch.read);
  }
  if (patch.urgency != null) {
    sets.push(`urgency = $${paramIndex++}`);
    params.push(patch.urgency);
  }
  if (patch.triage_status != null) {
    sets.push(`triage_status = $${paramIndex++}`);
    params.push(patch.triage_status);
  }
  if (!sets.length) return getInboundEmail(id);

  params.push(id);
  const result = await pool.query(
    `UPDATE inbound_emails SET ${sets.join(', ')} WHERE id = $${paramIndex}
     RETURNING id, from_address, to_address, subject, body_text, body_html, message_id,
       read, COALESCE(urgency, 'normal') AS urgency, COALESCE(triage_status, 'inbox') AS triage_status,
       received_at`,
    params,
  );
  const row = result.rows[0] as Record<string, unknown> | undefined;
  return row ? rowToEmail(row) : null;
}
