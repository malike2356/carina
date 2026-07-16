import { appendEvent, getMessage, getProtection, updateMessage } from './store.js';
import { getShieldAdapter } from './adapters/registry.js';
import { reportShieldEvent, isShieldDeliveryKilled } from './scout-bridge.js';

export async function deliverCleanMessage(messageId: string): Promise<void> {
  const message = await getMessage(messageId);
  if (!message) throw new Error('message not found');
  if (message.quarantineStatus === 'destroyed') {
    throw new Error('cannot deliver destroyed message');
  }
  if (message.deliveredAt) return;

  const protection = await getProtection(message.protectionId);
  if (!protection) throw new Error('protection not found');

  if (await isShieldDeliveryKilled(message.workspaceId, protection.id)) {
    await updateMessage(messageId, { quarantineStatus: 'held' });
    await appendEvent(messageId, 'system', 'deliver_blocked_kill', {});
    throw new Error('Channel Shield kill switch active');
  }

  if (message.verdict === 'malicious' && message.quarantineStatus === 'held') {
    throw new Error('malicious held messages require explicit release');
  }

  const adapter = getShieldAdapter(message.channel);
  await adapter.deliver(message, message.envelope);
  const now = new Date().toISOString();
  await updateMessage(messageId, {
    deliveredAt: now,
    quarantineStatus: message.quarantineStatus === 'held' ? 'released' : message.quarantineStatus,
  });
  await appendEvent(messageId, 'system', 'delivered', { channel: message.channel });
  await reportShieldEvent({
    eventType: 'channel_shield.delivered',
    severity: 'info',
    workspaceId: message.workspaceId,
    channel: message.channel,
    messageId,
    metadata: { protectionId: protection.id },
  });
}
