import { findProtection, listProtections } from './store.js';
import { acceptAndProcess } from './ingest.js';
import type { ShieldChannel, ShieldEnvelope } from './types.js';
import { extractLinks } from './adapters/helpers.js';

const CHANNEL_MAP: Record<string, ShieldChannel> = {
  email: 'email',
  slack: 'slack',
  teams: 'teams',
  telegram: 'telegram',
  whatsapp: 'whatsapp',
  discord: 'discord',
  sms: 'sms',
  web: 'web',
  widget: 'web',
};

/**
 * If the workspace has an active Channel Shield protection for this channel,
 * analyse before live delivery. Returns true when the live payload must be suppressed.
 */
export async function maybeInterceptInbound(input: {
  workspaceId: string;
  channel: string;
  externalKey?: string;
  externalMessageId: string;
  conversationId: string;
  from: { id: string; display?: string };
  text: string;
  subject?: string;
  attachments?: ShieldEnvelope['attachments'];
  authSignals?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}): Promise<{ intercepted: boolean; messageId?: string; verdict?: string | null; allowLive: boolean }> {
  const channel = CHANNEL_MAP[input.channel];
  if (!channel) return { intercepted: false, allowLive: true };

  let protection = input.externalKey
    ? await findProtection(input.workspaceId, channel, input.externalKey)
    : null;
  if (!protection) {
    const list = await listProtections(input.workspaceId, channel);
    protection = list.find((p) => p.status === 'active' && p.mode !== 'off') ?? null;
  }
  if (!protection || protection.mode === 'off' || protection.status !== 'active') {
    return { intercepted: false, allowLive: true };
  }

  const envelope: ShieldEnvelope = {
    channel,
    workspaceId: input.workspaceId,
    protectionId: protection.id,
    externalMessageId: input.externalMessageId,
    conversationId: input.conversationId,
    from: input.from,
    to: [{ id: protection.externalKey }],
    subject: input.subject,
    text: input.text,
    links: extractLinks(input.text),
    attachments: input.attachments ?? [],
    rawStorageUri: `shield://${channel}/${protection.id}/${input.externalMessageId}`,
    receivedAt: new Date().toISOString(),
    authSignals: input.authSignals ?? {},
    metadata: input.metadata ?? {},
  };

  const message = await acceptAndProcess(envelope, protection);
  const { getMessage } = await import('./store.js');
  const finalMsg = (await getMessage(message.id)) ?? message;
  const allowLive =
    protection.mode === 'monitor' ||
    (finalMsg.verdict === 'clean' && finalMsg.quarantineStatus !== 'held');

  return {
    intercepted: true,
    messageId: finalMsg.id,
    verdict: finalMsg.verdict,
    allowLive,
  };
}
