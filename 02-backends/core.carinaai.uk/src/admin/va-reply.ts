import { pool } from '../memory/db.js';
import { listWorkerChannelDetails } from '../channels/channel-store.js';
import { getAdapter } from '../channels/adapter-registry.js';
import { unpackCredentials } from '../channels/credential-store.js';
import { logActivity } from '../workers/worker-store.js';
import { sendEscalationResolvedEmail } from '../email/email-triggers.js';
import type { AivaChannelName } from '../channels/types.js';

async function notifyEscalationResolved(
  escalationId: string,
  resolutionNote: string,
): Promise<void> {
  const escResult = await pool.query(
    `SELECT e.worker_id, e.workspace_id, e.original_input, w.name AS worker_name
     FROM ai_worker_escalations e
     JOIN ai_workers w ON w.id = e.worker_id
     WHERE e.id = $1`,
    [escalationId],
  );
  const row = escResult.rows[0] as Record<string, unknown> | undefined;
  if (!row) return;
  await sendEscalationResolvedEmail({
    workspaceId: String(row.workspace_id),
    workerId: String(row.worker_id),
    workerName: String(row.worker_name),
    escalationReason: String(row.original_input ?? 'Escalated conversation'),
    resolutionNote,
  });
}

export async function clearVaOverride(
  workerId: string,
  contactId: string,
  channel: string,
): Promise<void> {
  await pool.query(
    `UPDATE channel_threads SET va_override = false, updated_at = NOW()
     WHERE worker_id = $1 AND contact_id = $2 AND channel = $3`,
    [workerId, contactId, channel],
  );
}

export async function sendVaReply(input: {
  escalationId: string;
  message: string;
  handBackToAiva: boolean;
}): Promise<{ sent: boolean; channel: string; handedBack: boolean }> {
  const escResult = await pool.query('SELECT * FROM ai_worker_escalations WHERE id = $1', [
    input.escalationId,
  ]);
  const esc = escResult.rows[0] as Record<string, unknown> | undefined;
  if (!esc) throw new Error('Escalation not found');

  const workerId = String(esc.worker_id);
  const channel = String(esc.channel) as AivaChannelName;
  const contactId = String(esc.channel_id);

  const channels = await listWorkerChannelDetails(workerId);
  const channelRow = channels.find((c) => c.channel === channel && c.enabled) ?? channels[0];
  if (!channelRow) throw new Error('No enabled channel for this Aiva');

  const adapter = getAdapter(channelRow.channel);
  if (!adapter) throw new Error(`No adapter for channel ${channelRow.channel}`);

  const credentials = unpackCredentials(channelRow.credentials);
  await adapter.send(
    {
      channel: channelRow.channel,
      contactId,
      content: input.message,
    },
    credentials,
  );

  await logActivity(workerId, {
    actionType: 'va_reply',
    summary: `VA replied on ${channelRow.channel}: ${input.message.slice(0, 100)}`,
    outputText: input.message,
    escalated: false,
    channel: channelRow.channel,
    contactId,
  });

  await pool.query(
    `UPDATE ai_worker_escalations SET
       first_response_at = COALESCE(first_response_at, NOW()),
       status = CASE WHEN $2 THEN 'resolved' ELSE 'in_progress' END,
       resolved_at = CASE WHEN $2 THEN NOW() ELSE resolved_at END,
       resolution_text = CASE WHEN $2 THEN 'VA replied and handed back to Aiva' ELSE resolution_text END
     WHERE id = $1`,
    [input.escalationId, input.handBackToAiva],
  );

  if (input.handBackToAiva) {
    await clearVaOverride(workerId, contactId, channel);
    const assignedTo = esc.assigned_to ? String(esc.assigned_to) : null;
    if (assignedTo) {
      await pool.query(
        `UPDATE va_team_members SET current_load = GREATEST(0, current_load - 1) WHERE id = $1`,
        [assignedTo],
      );
    }
    void notifyEscalationResolved(
      input.escalationId,
      'VA replied and handed back to Aiva',
    ).catch((err) => console.error('[va-reply] escalation resolved email failed:', err));
  }

  return {
    sent: true,
    channel: channelRow.channel,
    handedBack: input.handBackToAiva,
  };
}

export async function setVaOverrideForEscalation(
  workerId: string,
  contactId: string,
  channel: string,
): Promise<void> {
  await pool.query(
    `UPDATE channel_threads SET va_override = true, updated_at = NOW()
     WHERE worker_id = $1 AND contact_id = $2 AND channel = $3`,
    [workerId, contactId, channel],
  );
}
