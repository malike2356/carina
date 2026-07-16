import { pool } from '../memory/db.js';
import { updateAivaAgentStatus } from '../workers/scout-fleet.js';
import { queueWorkerTrigger, consumePendingTriggers } from '../ingestion/email/worker-approval-store.js';
import { pollWorkerInbox } from '../ingestion/email/email-poller.js';
import { replayQueuedSocialTrigger } from '../ingestion/social/social-draft-handler.js';
import { sendEmail } from '../email/email-service.js';
import { Text } from '@react-email/components';
import React from 'react';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function suspendWorkerByScout(workerId: string, reason: string): Promise<void> {
  if (!UUID_RE.test(workerId)) return;

  const result = await pool.query(
    `UPDATE ai_workers SET status = 'suspended_by_scout', updated_at = NOW()
     WHERE id = $1 AND status != 'dismissed'
     RETURNING workspace_id`,
    [workerId],
  );
  const workspaceId = result.rows[0]?.workspace_id as string | undefined;
  if (!workspaceId) return;

  await updateAivaAgentStatus(workerId, 'suspended_by_scout');

  const contact = await pool.query(
    'SELECT owner_email FROM aiva_workspace_contacts WHERE workspace_id = $1',
    [workspaceId],
  );
  const ownerEmail = contact.rows[0]?.owner_email as string | undefined;
  if (ownerEmail) {
    void sendEmail({
      to: ownerEmail,
      subject: 'Aiva AI Employee suspended by Scout governance',
      transactional: true,
      workspaceId,
      template: React.createElement(
        Text,
        null,
        `An AI Employee was suspended by Scout governance policy. Reason: ${reason}. Review your Scout dashboard to resume.`,
      ),
    }).catch(() => undefined);
  }
}

export async function resumeWorkerByScout(workerId: string): Promise<void> {
  if (!UUID_RE.test(workerId)) return;

  const result = await pool.query(
    `UPDATE ai_workers SET status = 'active', updated_at = NOW()
     WHERE id = $1 AND status = 'suspended_by_scout'
     RETURNING workspace_id`,
    [workerId],
  );
  if (!result.rows[0]) return;

  await updateAivaAgentStatus(workerId, 'active');
  const workspaceId = String(result.rows[0].workspace_id);
  const triggers = await consumePendingTriggers(workerId);
  let replayEmail = false;
  for (const trigger of triggers) {
    if (trigger.triggerType === 'email') {
      replayEmail = true;
    }
    if (trigger.triggerType === 'social') {
      void replayQueuedSocialTrigger({
        workerId,
        workspaceId,
        triggerDetail: trigger.triggerDetail,
      }).catch(() => undefined);
    }
  }
  if (replayEmail) {
    void pollWorkerInbox(workerId).catch(() => undefined);
  }
}

export async function handleScoutWorkerControl(payload: Record<string, unknown>): Promise<boolean> {
  const action = payload.action;
  const instanceId = typeof payload.instance_id === 'string' ? payload.instance_id : '';
  if (!UUID_RE.test(instanceId)) return false;

  const worker = await pool.query('SELECT id FROM ai_workers WHERE id = $1 LIMIT 1', [instanceId]);
  const isWorker = Boolean(worker.rows[0]);

  if (
    isWorker &&
    (action === 'suspend_worker' || action === 'suspend' || action === 'kill_switch_activated')
  ) {
    await suspendWorkerByScout(instanceId, String(payload.reason ?? 'Scout kill switch'));
    return true;
  }
  if (isWorker && (action === 'resume_worker' || action === 'resume')) {
    await resumeWorkerByScout(instanceId);
    return true;
  }
  return false;
}

export async function queueEmailTriggerForWorker(input: {
  workerId: string;
  workspaceId: string;
  messageId: string;
  from: string;
}): Promise<void> {
  const worker = await pool.query('SELECT status FROM ai_workers WHERE id = $1', [input.workerId]);
  const status = String(worker.rows[0]?.status ?? '');
  if (status === 'suspended_by_scout') {
    await queueWorkerTrigger({
      workerId: input.workerId,
      workspaceId: input.workspaceId,
      triggerType: 'email',
      triggerDetail: { messageId: input.messageId, from: input.from },
    });
  }
}

export async function queueSocialTriggerForWorker(input: {
  workerId: string;
  workspaceId: string;
  channel: string;
  contactId: string;
  conversationId?: string;
  inboundText: string;
  draftText: string;
  threadId?: string;
}): Promise<void> {
  await queueWorkerTrigger({
    workerId: input.workerId,
    workspaceId: input.workspaceId,
    triggerType: 'social',
    triggerDetail: {
      channel: input.channel,
      contactId: input.contactId,
      conversationId: input.conversationId ?? null,
      inboundText: input.inboundText,
      draftText: input.draftText,
      threadId: input.threadId ?? input.contactId,
    },
  });
}

export function isWorkerExecutionBlocked(status: string): boolean {
  return status === 'suspended_by_scout' || status === 'paused' || status === 'dismissed';
}
