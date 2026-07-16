import { appendEvent, getMessage, getProtection, updateMessage } from './store.js';
import { getShieldAdapter } from './adapters/registry.js';
import { reportShieldEvent, noteDualControlRelease } from './scout-bridge.js';
import { buildSafeSummary } from './verdict.js';
import { deliverCleanMessage } from './delivery.js';

export async function holdMessage(messageId: string, reason: string): Promise<void> {
  const message = await getMessage(messageId);
  if (!message) return;
  await updateMessage(messageId, { quarantineStatus: 'held' });
  await appendEvent(messageId, 'system', 'quarantined', { reason });
  await reportShieldEvent({
    eventType: 'channel_shield.quarantined',
    severity: 'warning',
    workspaceId: message.workspaceId,
    channel: message.channel,
    messageId,
    metadata: { reason },
  });

  try {
    const adapter = getShieldAdapter(message.channel);
    if (adapter.suppressOriginal) {
      await adapter.suppressOriginal(message.envelope);
    }
  } catch (err) {
    console.warn('[channel-shield] suppressOriginal failed', messageId, err);
  }
}

export async function notifySafeSummaryForMessage(messageId: string): Promise<void> {
  const message = await getMessage(messageId);
  if (!message) return;
  const verdict = message.verdict ?? 'suspect';
  const summary = message.safeSummaryText ?? buildSafeSummary(message, verdict);
  await updateMessage(messageId, { safeSummaryText: summary });
  try {
    const adapter = getShieldAdapter(message.channel);
    await adapter.notifySafeSummary(message, summary);
    await appendEvent(messageId, 'system', 'safe_summary_sent', { channel: message.channel });
  } catch (err) {
    console.warn('[channel-shield] safe summary notify failed', messageId, err);
    await appendEvent(messageId, 'system', 'safe_summary_failed', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function destroyMessage(messageId: string, actor: string): Promise<void> {
  const message = await getMessage(messageId);
  if (!message) throw new Error('message not found');
  await updateMessage(messageId, { quarantineStatus: 'destroyed' });
  await appendEvent(messageId, actor, 'destroyed', {});
  await reportShieldEvent({
    eventType: 'channel_shield.destroyed',
    severity: 'warning',
    workspaceId: message.workspaceId,
    channel: message.channel,
    messageId,
    metadata: { actor },
  });
}

export async function releaseMessage(
  messageId: string,
  actor: string,
  opts: { approver?: string } = {},
): Promise<void> {
  const message = await getMessage(messageId);
  if (!message) throw new Error('message not found');
  if (message.quarantineStatus === 'destroyed') {
    throw new Error('destroyed messages cannot be released');
  }

  if (message.verdict === 'malicious') {
    if (!opts.approver || opts.approver === actor) {
      throw new Error('malicious release requires dual-control approver different from actor');
    }
    await noteDualControlRelease(messageId, actor, opts.approver);
  }

  await updateMessage(messageId, { quarantineStatus: 'released' });
  await appendEvent(messageId, actor, 'released', { approver: opts.approver });
  await deliverCleanMessage(messageId);
}
