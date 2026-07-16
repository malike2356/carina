import { getAdapter } from '../channels/adapter-registry.js';
import type { AivaChannelName } from '../channels/types.js';
import { isSocialChannel } from '../channels/social-channel-utils.js';
import { llm } from '../brain/llm.js';
import { firstName, getWorkspaceContact } from '../email/workspace-contact.js';
import type { Worker } from '../types/index.js';
import {
  socialChannelDisplayNameFor,
  workerHasSocialPresenceCapability,
} from './worker-capability-context.js';

export async function summarizeRoleDescription(roleDescription: string): Promise<string> {
  try {
    const response = await llm.chatCheap([{
      role: 'user',
      content: `Summarise this job role in one short natural sentence (max 20 words): ${roleDescription}`,
      timestamp: new Date(),
    }]);
    const summary = response.content.trim();
    if (summary) return summary.replace(/^["']|["']$/g, '');
  } catch {
    // fall through
  }
  return roleDescription.split(/[.!?]/)[0]?.trim() || roleDescription.slice(0, 80);
}

function socialChannelSetupHint(worker: Worker): string {
  if (!workerHasSocialPresenceCapability(worker)) return '';
  const planned = worker.channels.filter(isSocialChannel);
  if (planned.length === 0) return '';
  const labels = planned.map(socialChannelDisplayNameFor).join(', ');
  return ` Connect ${labels} on my Channels tab to receive live DMs and queue drafts for your approval inbox.`;
}

export async function sendWorkerOnboardingMessage(
  worker: Worker,
  channel: string,
  contactId: string,
  credentials: Record<string, string> = {},
  ownerFirstName?: string,
  override?: { content?: string; subject?: string },
): Promise<void> {
  const adapter = getAdapter(channel as AivaChannelName);
  if (!adapter) return;

  const summary = await summarizeRoleDescription(worker.roleDescription);
  const greeting = ownerFirstName?.trim() ? `Hey ${ownerFirstName.trim()},` : 'Hey,';
  const defaultText = `${greeting} I'm ${worker.name}. Think of me as your ${summary}. Send me what you need and I'll get started.${socialChannelSetupHint(worker)}`;
  const text = override?.content?.trim() || defaultText;
  const subject = override?.subject?.trim() || `Hey, I'm ${worker.name}!`;

  try {
    await adapter.send(
      {
        channel: channel as AivaChannelName,
        contactId,
        content: text,
        metadata: { subject, isFirstContact: 'true' },
      },
      credentials,
    );
  } catch (err) {
    console.warn(`[workspace-onboarding] failed to send first message on ${channel}:`, err);
  }
}
