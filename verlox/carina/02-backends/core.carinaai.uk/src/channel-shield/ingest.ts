import {
  appendEvent,
  encryptAtRest,
  findProtection,
  getProtection,
  insertAttachments,
  insertMessage,
  updateMessage,
} from './store.js';
import type { ShieldEnvelope, ShieldMessage, ShieldProtection } from './types.js';
import { reportShieldEvent } from './scout-bridge.js';
import { runShieldPipeline } from './pipeline.js';

export async function acceptEnvelope(
  envelope: ShieldEnvelope,
  protection?: ShieldProtection | null,
): Promise<ShieldMessage> {
  const prot =
    protection ??
    (await getProtection(envelope.protectionId)) ??
    (await findProtection(envelope.workspaceId, envelope.channel, envelope.protectionId));

  if (!prot) {
    throw new Error(`Channel Shield protection not found for ${envelope.channel}:${envelope.protectionId}`);
  }

  if (prot.mode === 'off' || prot.status === 'disabled' || prot.status === 'paused') {
    throw new Error(`Channel Shield protection inactive (${prot.status}/${prot.mode})`);
  }

  const rawCiphertext = encryptAtRest(
    JSON.stringify({
      envelope,
      receivedAt: envelope.receivedAt,
    }),
  );

  const message = await insertMessage({
    protection: prot,
    envelope: { ...envelope, protectionId: prot.id, workspaceId: prot.workspaceId },
    rawCiphertext,
  });

  await insertAttachments(message.id, envelope.attachments);
  await appendEvent(message.id, 'system', 'accepted', {
    channel: envelope.channel,
    externalMessageId: envelope.externalMessageId,
  });

  await reportShieldEvent({
    eventType: 'channel_shield.message_accepted',
    severity: 'info',
    workspaceId: prot.workspaceId,
    channel: envelope.channel,
    messageId: message.id,
    metadata: {
      protectionId: prot.id,
      conversationId: envelope.conversationId,
    },
  });

  // Run pipeline asynchronously for monitor/protect; await in tests via runShieldPipeline.
  if (process.env.CHANNEL_SHIELD_SYNC_PIPELINE === 'true') {
    await runShieldPipeline(message.id);
  } else {
    void runShieldPipeline(message.id).catch((err) => {
      console.error('[channel-shield] pipeline failed', message.id, err);
    });
  }

  return message;
}

export async function acceptAndProcess(
  envelope: ShieldEnvelope,
  protection?: ShieldProtection | null,
): Promise<ShieldMessage> {
  const prev = process.env.CHANNEL_SHIELD_SYNC_PIPELINE;
  process.env.CHANNEL_SHIELD_SYNC_PIPELINE = 'true';
  try {
    const message = await acceptEnvelope(envelope, protection);
    const refreshed = await updateMessage(message.id, {});
    return refreshed ?? message;
  } finally {
    if (prev === undefined) delete process.env.CHANNEL_SHIELD_SYNC_PIPELINE;
    else process.env.CHANNEL_SHIELD_SYNC_PIPELINE = prev;
  }
}
