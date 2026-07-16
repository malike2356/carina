import type { InboundMessage } from '../../channels/types.js';
import type { RegistryEntry } from '../../channels/worker-registry.js';
import { isSocialAivaChannel, type SocialChannelName } from '../../channels/social-channel-utils.js';
import { getWorker, logActivity } from '../../workers/worker-store.js';
import { reportAivaScoutEvent } from '../../security/scout-event-queue.js';
import { isWorkerExecutionBlocked, queueSocialTriggerForWorker } from '../../security/scout-worker-killswitch.js';
import { getSocialSettings } from './social-settings-store.js';
import { shouldAutoSendSocialReply } from './social-auto-reply.js';
import { createSocialApproval } from './social-approval-store.js';
import { sendSocialReply } from './social-send-on-approve.js';
import { markChannelVerified } from '../../channels/channel-store.js';

export async function handleSocialInboundReply(input: {
  message: InboundMessage;
  entry: RegistryEntry;
  draftText: string;
}): Promise<{ sent: boolean; approvalId?: string }> {
  if (!isSocialAivaChannel(input.message.channel)) {
    throw new Error('handleSocialInboundReply called for non-social channel');
  }

  const worker = await getWorker(input.entry.workspaceId, input.entry.workerId);
  if (!worker) {
    return { sent: false };
  }

  if (isWorkerExecutionBlocked(worker.status)) {
    await queueSocialTriggerForWorker({
      workerId: input.entry.workerId,
      workspaceId: input.entry.workspaceId,
      channel: input.message.channel,
      contactId: input.message.contactId,
      conversationId: input.message.conversationId,
      inboundText: input.message.content,
      draftText: input.draftText,
      threadId: input.message.threadId,
    });
    return { sent: false };
  }

  if (worker.status !== 'active') {
    return { sent: false };
  }

  void reportAivaScoutEvent({
    workspaceId: input.entry.workspaceId,
    workerId: input.entry.workerId,
    eventType: 'social_inbound_received',
    description: `Inbound social message on ${input.message.channel}`,
    metadata: {
      channel: input.message.channel,
      contactId: input.message.contactId,
      inboundText: input.message.content.slice(0, 200),
    },
  }).catch(() => undefined);

  const settings = await getSocialSettings(input.entry.workspaceId);
  const autoSend = shouldAutoSendSocialReply({
    socialRequireApproval: settings.socialRequireApproval,
    socialAutoReplyEnabled: settings.socialAutoReplyEnabled,
    socialAutoReplyAllowlist: settings.socialAutoReplyAllowlist,
    draftText: input.draftText,
  });

  if (autoSend) {
    await sendSocialReply({
      channel: input.message.channel,
      entry: input.entry,
      contactId: input.message.contactId,
      conversationId: input.message.conversationId,
      threadId: input.message.threadId,
      draftText: input.draftText,
    });
    if (input.entry.channelRowId) {
      void markChannelVerified(input.entry.channelRowId).catch(() => {});
    }
    void logActivity(input.entry.workerId, {
      actionType: 'message_sent',
      summary: `Social auto-reply sent on ${input.message.channel}`,
      inputText: input.message.content,
      outputText: input.draftText,
      escalated: false,
      channel: input.message.channel,
      contactId: input.message.contactId,
    }).catch(() => undefined);
    return { sent: true };
  }

  const approval = await createSocialApproval({
    workerId: input.entry.workerId,
    workspaceId: input.entry.workspaceId,
    channel: input.message.channel,
    contactId: input.message.contactId,
    conversationId: input.message.conversationId,
    inboundText: input.message.content,
    draftText: input.draftText,
  });

  await reportAivaScoutEvent({
    workspaceId: input.entry.workspaceId,
    workerId: input.entry.workerId,
    eventType: 'social_approval_requested',
    description: `Social draft awaiting approval on ${input.message.channel}`,
    metadata: {
      approvalId: approval.id,
      channel: input.message.channel,
      contactId: input.message.contactId,
    },
  });

  void logActivity(input.entry.workerId, {
    actionType: 'escalated',
    summary: `Social draft awaiting approval on ${input.message.channel}`,
    inputText: input.message.content,
    outputText: input.draftText,
    escalated: true,
    channel: input.message.channel,
    contactId: input.message.contactId,
  }).catch(() => undefined);

  return { sent: false, approvalId: approval.id };
}

export async function replayQueuedSocialTrigger(input: {
  workerId: string;
  workspaceId: string;
  triggerDetail: Record<string, unknown>;
}): Promise<void> {
  const channel = String(input.triggerDetail.channel ?? '');
  const draftText = String(input.triggerDetail.draftText ?? '');
  const contactId = String(input.triggerDetail.contactId ?? '');
  const inboundText = String(input.triggerDetail.inboundText ?? '');
  if (!channel || !draftText || !contactId) return;

  const approval = await createSocialApproval({
    workerId: input.workerId,
    workspaceId: input.workspaceId,
    channel: channel as SocialChannelName,
    contactId,
    conversationId: input.triggerDetail.conversationId
      ? String(input.triggerDetail.conversationId)
      : undefined,
    inboundText,
    draftText,
  });

  await reportAivaScoutEvent({
    workspaceId: input.workspaceId,
    workerId: input.workerId,
    eventType: 'social_approval_requested',
    description: `Social draft queued after governance resume on ${channel}`,
    metadata: { approvalId: approval.id, channel, contactId },
  });
}
