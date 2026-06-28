import { pool } from '../memory/db.js';

export type ThreadMessageRole = 'user' | 'aiva' | 'va' | 'system';

export interface ThreadMessage {
  id: string;
  role: ThreadMessageRole;
  content: string;
  timestamp: string;
  actionType?: string;
  summary?: string;
  attestationTx?: string | null;
}

function mapActivityRowToMessages(row: Record<string, unknown>): ThreadMessage[] {
  const actionType = String(row.action_type);
  const id = String(row.id);
  const timestamp = new Date(String(row.created_at)).toISOString();
  const summary = String(row.summary);

  switch (actionType) {
    case 'message_received':
      if (!row.input_text) return [];
      return [{ id, role: 'user', content: String(row.input_text), timestamp }];
    case 'message_sent':
      if (!row.output_text) return [];
      return [{
        id,
        role: 'aiva',
        content: String(row.output_text),
        timestamp,
        attestationTx: row.attestation_tx ? String(row.attestation_tx) : null,
      }];
    case 'va_reply':
      if (!row.output_text) return [];
      return [{ id, role: 'va', content: String(row.output_text), timestamp }];
    case 'escalated':
      return [{
        id,
        role: 'system',
        content: summary,
        timestamp,
        actionType: 'escalated',
        summary: summary || 'Escalated to human review',
      }];
    case 'automation_run':
      return [{
        id,
        role: 'system',
        content: summary,
        timestamp,
        actionType: 'automation_ran',
        summary,
      }];
    default:
      return [];
  }
}

function mapEscalationResolved(row: Record<string, unknown>): ThreadMessage | null {
  if (!row.resolved_at) return null;
  const resolution = row.resolution_text ? String(row.resolution_text) : 'Escalation resolved';
  return {
    id: `esc-resolved-${String(row.id)}`,
    role: 'system',
    content: resolution,
    timestamp: new Date(String(row.resolved_at)).toISOString(),
    actionType: 'resolved',
    summary: resolution,
  };
}

export async function buildConversationThread(params: {
  workerId: string;
  channel: string;
  contactId: string;
}): Promise<ThreadMessage[]> {
  const { workerId, channel, contactId } = params;

  const [scopedActivity, escalations] = await Promise.all([
    pool.query(
      `SELECT id, action_type, summary, input_text, output_text, attestation_tx, created_at
       FROM ai_worker_activity
       WHERE worker_id = $1
         AND channel = $2
         AND contact_id = $3
         AND pii_erased_at IS NULL
       ORDER BY created_at ASC
       LIMIT 500`,
      [workerId, channel, contactId],
    ),
    pool.query(
      `SELECT id, resolution_text, resolved_at
       FROM ai_worker_escalations
       WHERE worker_id = $1 AND channel = $2 AND channel_id = $3
       ORDER BY created_at ASC`,
      [workerId, channel, contactId],
    ),
  ]);

  let activityRows = scopedActivity.rows;
  if (activityRows.length === 0) {
    const legacy = await pool.query(
      `SELECT id, action_type, summary, input_text, output_text, attestation_tx, created_at
       FROM ai_worker_activity
       WHERE worker_id = $1
         AND contact_id IS NULL
         AND pii_erased_at IS NULL
       ORDER BY created_at ASC
       LIMIT 200`,
      [workerId],
    );
    activityRows = legacy.rows;
  }

  const messages: ThreadMessage[] = [];
  for (const row of activityRows) {
    messages.push(...mapActivityRowToMessages(row));
  }
  for (const row of escalations.rows) {
    const resolved = mapEscalationResolved(row);
    if (resolved) messages.push(resolved);
  }

  messages.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  return messages;
}
