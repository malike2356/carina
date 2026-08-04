import type { InboundMessage, AivaChannelName } from '../../channels/types.js';
import type { RegistryEntry } from '../../channels/worker-registry.js';
import { sendOutboundReply } from '../../channels/outbound-reply.js';
import { getWorkerChannelByWorkerAndChannel, markChannelVerified } from '../../channels/channel-store.js';
import { logActivity } from '../../workers/worker-store.js';
import { reportAivaScoutEvent } from '../../security/scout-event-queue.js';
import {
  getSocialApproval,
  markSocialApprovalSent,
  resolveSocialApproval,
  updateSocialApprovalDraft,
  type WorkerSocialApproval,
} from './social-approval-store.js';

export async function sendSocialReply(input: {
  channel: AivaChannelName;
  entry: RegistryEntry;
  contactId: string;
  conversationId?: string | null;
  threadId?: string;
  draftText: string;
  inboundText?: string;
  preferAudio?: boolean;
}): Promise<void> {
  const inbound: InboundMessage = {
    channel: input.channel,
    workerId: input.entry.workerId,
    workspaceId: input.entry.workspaceId,
    contactId: input.contactId,
    conversationId: input.conversationId ?? undefined,
    content: input.inboundText ?? '',
    rawPayload: {},
    timestamp: new Date(),
    threadId: input.threadId ?? input.contactId,
    metadata: input.preferAudio
      ? { preferAudio: 'true', rawUserText: input.inboundText ?? '' }
      : input.inboundText
        ? { rawUserText: input.inboundText }
        : undefined,
  };
  await sendOutboundReply(input.channel, input.entry, inbound, input.draftText);
}

async function resolveRegistryEntry(
  approval: WorkerSocialApproval,
): Promise<RegistryEntry | null> {
  const channelRow = await getWorkerChannelByWorkerAndChannel(approval.workerId, approval.channel);
  if (!channelRow) return null;
  return {
    workerId: approval.workerId,
    workspaceId: approval.workspaceId,
    channelRowId: channelRow.id,
    credentialBlob: channelRow.credentials.encrypted ?? '',
  };
}

export async function approveSocialApproval(input: {
  workspaceId: string;
  approvalId: string;
  decisionBy: string;
  modifiedDraft?: string;
}): Promise<WorkerSocialApproval | null> {
  const existing = await getSocialApproval(input.workspaceId, input.approvalId);
  if (!existing || existing.status !== 'pending') return null;

  if (input.modifiedDraft && input.modifiedDraft !== existing.draftText) {
    await updateSocialApprovalDraft({
      workspaceId: input.workspaceId,
      approvalId: input.approvalId,
      draftText: input.modifiedDraft,
    });
  }

  const resolved = await resolveSocialApproval({
    workspaceId: input.workspaceId,
    approvalId: input.approvalId,
    status: 'approved',
    decisionBy: input.decisionBy,
  });
  if (!resolved) return null;

  const draftText = input.modifiedDraft ?? resolved.draftText;
  const entry = await resolveRegistryEntry(resolved);
  if (!entry) {
    throw new Error('Channel is not connected for this worker');
  }

  if (resolved.messageType === 'post') {
    if (resolved.channel === 'linkedin') {
      const { publishLinkedInPost } = await import('./linkedin-post-publish.js');
      const published = await publishLinkedInPost({
        workerId: resolved.workerId,
        text: draftText,
      });
      await markSocialApprovalSent(resolved.id);
      void markChannelVerified(entry.channelRowId).catch(() => {});
      await reportAivaScoutEvent({
        workspaceId: input.workspaceId,
        workerId: resolved.workerId,
        eventType: 'social_post_published',
        description: 'Approved LinkedIn post published',
        metadata: {
          approvalId: resolved.id,
          channel: resolved.channel,
          postUrn: published.postUrn,
        },
      });
      void logActivity(resolved.workerId, {
        actionType: 'message_sent',
        summary: 'LinkedIn post published',
        inputText: resolved.inboundText,
        outputText: draftText,
        escalated: false,
        channel: resolved.channel,
        contactId: resolved.contactId,
      }).catch(() => undefined);
      return { ...resolved, draftText, status: 'sent' };
    }
    throw new Error(`Post publish is not supported for channel ${resolved.channel}`);
  }

  await sendSocialReply({
    channel: resolved.channel,
    entry,
    contactId: resolved.contactId,
    conversationId: resolved.conversationId,
    threadId: resolved.contactId,
    draftText,
  });

  await markSocialApprovalSent(resolved.id);
  void markChannelVerified(entry.channelRowId).catch(() => {});

  await reportAivaScoutEvent({
    workspaceId: input.workspaceId,
    workerId: resolved.workerId,
    eventType: 'social_message_sent',
    description: `Approved social reply sent on ${resolved.channel}`,
    metadata: { approvalId: resolved.id, channel: resolved.channel },
  });

  void logActivity(resolved.workerId, {
    actionType: 'message_sent',
    summary: `Social reply sent on ${resolved.channel}`,
    inputText: resolved.inboundText,
    outputText: draftText,
    escalated: false,
    channel: resolved.channel,
    contactId: resolved.contactId,
  }).catch(() => undefined);

  return { ...resolved, draftText, status: 'sent' };
}

export async function rejectSocialApproval(input: {
  workspaceId: string;
  approvalId: string;
  decisionBy: string;
}): Promise<WorkerSocialApproval | null> {
  const resolved = await resolveSocialApproval({
    workspaceId: input.workspaceId,
    approvalId: input.approvalId,
    status: 'rejected',
    decisionBy: input.decisionBy,
  });
  if (!resolved) return null;

  await reportAivaScoutEvent({
    workspaceId: input.workspaceId,
    workerId: resolved.workerId,
    eventType: 'social_approval_rejected',
    description: `Social draft rejected on ${resolved.channel}`,
    metadata: { approvalId: resolved.id, channel: resolved.channel },
  });

  return resolved;
}

export async function patchSocialApprovalDraft(input: {
  workspaceId: string;
  approvalId: string;
  draftText: string;
}): Promise<WorkerSocialApproval | null> {
  return updateSocialApprovalDraft(input);
}
