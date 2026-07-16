import type { SocialChannelName } from '../../channels/social-channel-utils.js';
import { processAivaMessage } from '../../workers/aiva-process-message.js';
import { getWorker } from '../../workers/worker-store.js';
import { createSocialApproval } from './social-approval-store.js';
import { reportAivaScoutEvent } from '../../security/scout-event-queue.js';

const POST_CHANNEL_RE = /\[ilaud-social-post:(\w+)\]/i;

export function isSocialPostAutomation(input: { name: string; description: string }): boolean {
  const combined = `${input.name} ${input.description}`;
  return POST_CHANNEL_RE.test(combined)
    || /\bilaud-social-post\b/i.test(combined)
    || (/\blinkedin post\b/i.test(combined) && /\bdraft\b/i.test(combined));
}

export function parseSocialPostChannel(description: string): SocialChannelName {
  const match = description.match(POST_CHANNEL_RE);
  const channel = match?.[1]?.toLowerCase() ?? 'linkedin';
  if (channel === 'linkedin') return 'linkedin';
  if (channel === 'instagram') return 'instagram';
  if (channel === 'twitter') return 'twitter';
  return 'linkedin';
}

export async function createSocialPostDraft(input: {
  workerId: string;
  workspaceId: string;
  automationName: string;
  prompt: string;
  channel?: SocialChannelName;
  scheduledFor?: Date;
  draftText?: string;
}): Promise<{ approvalId: string; draftText: string }> {
  const worker = await getWorker(input.workspaceId, input.workerId);
  if (!worker || worker.status !== 'active') {
    throw new Error('Worker is not active');
  }

  const channel = input.channel ?? parseSocialPostChannel(input.prompt);
  const draftText = input.draftText?.trim()
    ? input.draftText.trim()
    : await processAivaMessage({
      workerId: input.workerId,
      workspaceId: input.workspaceId,
      userMessage: [
        'Draft a public social media post (not a DM reply).',
        'Output only the post text, no hashtags block unless natural.',
        '',
        input.prompt,
      ].join('\n'),
      channel: 'web',
      contactId: `post-${input.automationName}`,
    });

  const approval = await createSocialApproval({
    workerId: input.workerId,
    workspaceId: input.workspaceId,
    channel,
    contactId: `${channel}-feed`,
    inboundText: input.prompt.slice(0, 500),
    draftText: draftText.trim(),
    messageType: 'post',
    scheduledFor: input.scheduledFor,
  });

  await reportAivaScoutEvent({
    workspaceId: input.workspaceId,
    workerId: input.workerId,
    eventType: 'social_post_scheduled',
    description: `Scheduled post draft awaiting approval on ${channel}`,
    metadata: {
      approvalId: approval.id,
      channel,
      messageType: 'post',
      automationName: input.automationName,
      draftText: approval.draftText.slice(0, 200),
    },
  });

  return { approvalId: approval.id, draftText: approval.draftText };
}
