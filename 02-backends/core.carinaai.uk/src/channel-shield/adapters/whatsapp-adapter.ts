import crypto from 'node:crypto';
import type { ChannelShieldAdapter, ShieldEnvelope, ShieldMessage, ShieldProtection } from '../types.js';
import { baseEnvelope, defaultHealth, deliveryLog, type IngressRequest } from './helpers.js';

export const whatsappShieldAdapter: ChannelShieldAdapter = {
  channel: 'whatsapp',

  async authenticateIngress(req: unknown): Promise<boolean> {
    const r = req as IngressRequest;
    const secret = process.env.WHATSAPP_APP_SECRET?.trim() || process.env.META_APP_SECRET?.trim();
    if (!secret) return process.env.NODE_ENV !== 'production';
    const sig = r.headers?.['x-hub-signature-256'];
    if (!sig) return false;
    const raw = r.rawBody?.toString() ?? JSON.stringify(r.body ?? {});
    const expected = `sha256=${crypto.createHmac('sha256', secret).update(raw).digest('hex')}`;
    try {
      return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
    } catch {
      return false;
    }
  },

  async ingest(req: unknown, protection: ShieldProtection): Promise<ShieldEnvelope> {
    const body = ((req as IngressRequest).body ?? {}) as Record<string, unknown>;
    const entry = Array.isArray(body.entry) ? (body.entry[0] as Record<string, unknown>) : body;
    const changes = Array.isArray(entry.changes) ? (entry.changes[0] as Record<string, unknown>) : entry;
    const value = (changes.value ?? changes) as Record<string, unknown>;
    const messages = Array.isArray(value.messages) ? (value.messages as Array<Record<string, unknown>>) : [];
    const msg = messages[0] ?? (body as Record<string, unknown>);
    const textObj = msg.text as { body?: string } | undefined;
    const text = String(textObj?.body ?? msg.body ?? msg.text ?? '');
    const id = String(msg.id ?? crypto.randomUUID());
    const from = String(msg.from ?? 'unknown');
    const attachments: ShieldEnvelope['attachments'] = [];
    for (const kind of ['image', 'document', 'audio', 'video'] as const) {
      const media = msg[kind] as Record<string, unknown> | undefined;
      if (media) {
        attachments.push({
          id: String(media.id ?? kind),
          filename: String(media.filename ?? `${kind}.bin`),
          contentType: String(media.mime_type ?? 'application/octet-stream'),
          sizeBytes: 0,
        });
      }
    }

    return baseEnvelope('whatsapp', protection, {
      externalMessageId: id,
      conversationId: from,
      from: { id: from, handles: [from] },
      to: [{ id: protection.externalKey }],
      text,
      attachments,
      authSignals: { signatureValid: true },
      metadata: { phoneNumberId: protection.externalKey },
    });
  },

  async deliver(message: ShieldMessage, envelope: ShieldEnvelope): Promise<void> {
    deliveryLog('whatsapp', message, 'deliver');
    const token = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
    const phoneId = protectionOrPhone(envelope, message);
    if (!token || !phoneId) return;
    await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: envelope.from.id,
        type: 'text',
        text: { body: envelope.text.slice(0, 4096) },
      }),
      signal: AbortSignal.timeout(10_000),
    });
  },

  async notifySafeSummary(message: ShieldMessage, summary: string): Promise<void> {
    deliveryLog('whatsapp', message, 'summary');
    const token = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
    const phoneId = String(message.envelope.metadata.phoneNumberId ?? process.env.WHATSAPP_PHONE_NUMBER_ID ?? '');
    if (!token || !phoneId) return;
    await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: message.envelope.from.id,
        type: 'text',
        text: { body: summary.slice(0, 900) },
      }),
      signal: AbortSignal.timeout(10_000),
    });
  },

  async health() {
    return defaultHealth('whatsapp', ['WHATSAPP_APP_SECRET']);
  },
};

function protectionOrPhone(envelope: ShieldEnvelope, message: ShieldMessage): string {
  return String(
    envelope.metadata.phoneNumberId ?? message.envelope.metadata.phoneNumberId ?? process.env.WHATSAPP_PHONE_NUMBER_ID ?? '',
  );
}
