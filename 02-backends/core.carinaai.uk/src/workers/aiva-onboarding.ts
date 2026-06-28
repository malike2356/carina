import { getAdapter } from '../channels/adapter-registry.js';
import type { AivaChannelName } from '../channels/types.js';
import { llm } from '../brain/llm.js';
import type { Worker } from '../types/index.js';

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

export async function sendWorkerOnboardingMessage(
  worker: Worker,
  channel: string,
  contactId: string,
  credentials: Record<string, string> = {},
): Promise<void> {
  const adapter = getAdapter(channel as AivaChannelName);
  if (!adapter) return;

  const summary = await summarizeRoleDescription(worker.roleDescription);
  const text = `Hi, I am ${worker.name}. I will be handling ${summary}. Send me what you need and I will get started.`;

  try {
    await adapter.send(
      {
        channel: channel as AivaChannelName,
        contactId,
        content: text,
      },
      credentials,
    );
  } catch (err) {
    console.warn(`[aiva-onboarding] failed to send first message on ${channel}:`, err);
  }
}
