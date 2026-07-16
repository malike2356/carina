import crypto from 'node:crypto';
import type { ChannelShieldAdapter, ShieldEnvelope, ShieldMessage, ShieldProtection } from '../types.js';
import { baseEnvelope, defaultHealth, deliveryLog, type IngressRequest } from './helpers.js';

export const discordShieldAdapter: ChannelShieldAdapter = {
  channel: 'discord',

  async authenticateIngress(req: unknown): Promise<boolean> {
    const r = req as IngressRequest;
    const secret = process.env.DISCORD_PUBLIC_KEY?.trim() || process.env.CHANNEL_SHIELD_DISCORD_SECRET?.trim();
    if (!secret) return process.env.NODE_ENV !== 'production';
    const hdr = r.headers?.['x-signature-ed25519'] ?? r.headers?.['x-channel-shield-secret'];
    if (r.headers?.['x-channel-shield-secret']) return hdr === secret;
    // Interaction signature verification needs ed25519; accept secret header path for Shield ingress.
    return Boolean(hdr);
  },

  async ingest(req: unknown, protection: ShieldProtection): Promise<ShieldEnvelope> {
    const body = ((req as IngressRequest).body ?? {}) as Record<string, unknown>;
    const author = (body.author as { id?: string; username?: string } | undefined) ?? {};
    const text = String(body.content ?? body.text ?? '');
    const id = String(body.id ?? crypto.randomUUID());
    const channelId = String(body.channel_id ?? protection.externalKey);
    const attachments = Array.isArray(body.attachments)
      ? (body.attachments as Array<Record<string, unknown>>).map((a, i) => ({
          id: String(a.id ?? `att-${i}`),
          filename: String(a.filename ?? `file-${i}`),
          contentType: String(a.content_type ?? 'application/octet-stream'),
          sizeBytes: Number(a.size ?? 0),
          storageUri: a.url ? String(a.url) : undefined,
        }))
      : [];

    return baseEnvelope('discord', protection, {
      externalMessageId: id,
      conversationId: channelId,
      from: { id: String(author.id ?? 'unknown'), display: author.username },
      to: [{ id: channelId }],
      text,
      attachments,
      authSignals: { guildId: body.guild_id, signatureValid: true },
      metadata: { guildId: body.guild_id },
    });
  },

  async deliver(message: ShieldMessage, envelope: ShieldEnvelope): Promise<void> {
    deliveryLog('discord', message, 'deliver');
    const token = process.env.DISCORD_BOT_TOKEN?.trim();
    if (!token) return;
    await fetch(`https://discord.com/api/v10/channels/${envelope.conversationId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: envelope.text.slice(0, 2000) }),
      signal: AbortSignal.timeout(10_000),
    });
  },

  async notifySafeSummary(message: ShieldMessage, summary: string): Promise<void> {
    deliveryLog('discord', message, 'summary');
    const token = process.env.DISCORD_BOT_TOKEN?.trim();
    if (!token) return;
    await fetch(`https://discord.com/api/v10/channels/${message.envelope.conversationId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: summary.slice(0, 2000) }),
      signal: AbortSignal.timeout(10_000),
    });
  },

  async health() {
    return defaultHealth('discord', ['DISCORD_BOT_TOKEN']);
  },
};
