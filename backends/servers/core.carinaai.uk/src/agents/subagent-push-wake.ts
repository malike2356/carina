import { registerDelegationCompletionHandler } from './delegation-completion.js';
import type { DelegationCompletionEvent } from './delegation-completion.js';
import { getSessionDelivery } from './cron-delivery-registry.js';
import { channelRegistry } from '../gateway/channels/channel-registry.js';
import { getCarinaAgentName } from './identity-defaults.js';

const wakeQueues = new Map<string, string[]>();

export function queueSubagentWakeMessage(parentSessionId: string, message: string): void {
  const trimmed = message.trim();
  if (!trimmed) return;
  const queue = wakeQueues.get(parentSessionId) ?? [];
  queue.push(trimmed);
  wakeQueues.set(parentSessionId, queue);
}

export function drainSubagentWakeMessages(parentSessionId: string): string[] {
  const queue = wakeQueues.get(parentSessionId) ?? [];
  wakeQueues.delete(parentSessionId);
  return queue;
}

export function clearSubagentWakeQueuesForTests(): void {
  wakeQueues.clear();
}

export function subagentPushWakeEnabled(): boolean {
  return process.env.CARINA_SUBAGENT_PUSH_WAKE !== 'false';
}

function formatWakeSummary(event: DelegationCompletionEvent): string {
  const role = event.role ? ` (${event.role})` : '';
  const status = event.success ? 'completed' : 'failed';
  return `Subagent${role} ${status}: ${event.summary} [${event.subSessionId}]`;
}

export async function pushWakeParentOnSubagentComplete(event: DelegationCompletionEvent): Promise<void> {
  if (!subagentPushWakeEnabled()) return;

  const summary = formatWakeSummary(event);
  queueSubagentWakeMessage(event.parentSessionId, summary);

  const delivery = getSessionDelivery(event.parentSessionId);
  if (!delivery) return;

  const adapter = channelRegistry.getByName(delivery.channel);
  if (!adapter?.enabled) return;

  const agentName = getCarinaAgentName();
  const prefix = event.success ? 'Background task finished' : 'Background task failed';
  const text = `[${agentName}] ${prefix}: ${event.summary}`;

  try {
    await adapter.sendMessage(delivery.conversationId, text);
  } catch {
    // push wake must not break delegation completion
  }
}

export function registerSubagentPushWakeHandler(): void {
  registerDelegationCompletionHandler((event) => pushWakeParentOnSubagentComplete(event));
}

export function buildSubagentWakeContext(messages: string[]): string | null {
  if (messages.length === 0) return null;
  return [
    'Subagent completion wake (background tasks finished since last turn):',
    ...messages.map((line) => `- ${line}`),
    'Incorporate these results if the operator is continuing related work.',
  ].join('\n');
}
