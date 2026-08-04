import crypto from 'node:crypto';
import type { ChannelShieldAdapter, ShieldEnvelope, ShieldMessage, ShieldProtection } from '../types.js';
import { baseEnvelope, defaultHealth, deliveryLog, type IngressRequest } from './helpers.js';

export const telegramShieldAdapter: ChannelShieldAdapter = {
  channel: 'telegram',

  async authenticateIngress(req: unknown): Promise<boolean> {
    const r = req as IngressRequest;
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
    const rawHeader = r.headers?.['x-telegram-bot-api-secret-token'];
    const provided = Array.isArray(rawHeader) ? String(rawHeader[0] ?? '') : String(rawHeader ?? '');
    if (!secret) {
      if (provided) {
        console.warn('[telegram-shield] secret header present but TELEGRAM_WEBHOOK_SECRET is unset');
        return false;
      }
      return true;
    }
    return provided === secret;
  },

  async ingest(req: unknown, protection: ShieldProtection): Promise<ShieldEnvelope> {
    const body = ((req as IngressRequest).body ?? {}) as Record<string, unknown>;
    const msg = (body.message ?? body) as Record<string, unknown>;
    const from = (msg.from as { id?: number; first_name?: string; username?: string } | undefined) ?? {};
    const chat = (msg.chat as { id?: number } | undefined) ?? {};
    const text = String(msg.text ?? msg.caption ?? '');
    const id = String(msg.message_id ?? crypto.randomUUID());
    const document = msg.document as Record<string, unknown> | undefined;
    const photo = Array.isArray(msg.photo) ? (msg.photo as Array<Record<string, unknown>>).at(-1) : undefined;
    const attachments: ShieldEnvelope['attachments'] = [];
    if (document) {
      attachments.push({
        id: String(document.file_id ?? 'doc'),
        filename: String(document.file_name ?? 'document'),
        contentType: String(document.mime_type ?? 'application/octet-stream'),
        sizeBytes: Number(document.file_size ?? 0),
      });
    }
    if (photo) {
      attachments.push({
        id: String(photo.file_id ?? 'photo'),
        filename: 'photo.jpg',
        contentType: 'image/jpeg',
        sizeBytes: Number(photo.file_size ?? 0),
      });
    }

    return baseEnvelope('telegram', protection, {
      externalMessageId: id,
      conversationId: String(chat.id ?? protection.externalKey),
      from: {
        id: String(from.id ?? 'unknown'),
        display: from.first_name ?? from.username,
        handles: from.username ? [`@${from.username}`] : undefined,
      },
      to: [{ id: String(chat.id ?? '') }],
      text,
      attachments,
      authSignals: { signatureValid: true },
      metadata: { updateId: body.update_id },
    });
  },

  async deliver(message: ShieldMessage, envelope: ShieldEnvelope): Promise<void> {
    deliveryLog('telegram', message, 'deliver');
    const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
    if (!token) return;
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: envelope.conversationId, text: envelope.text }),
      signal: AbortSignal.timeout(10_000),
    });
  },

  async notifySafeSummary(message: ShieldMessage, summary: string): Promise<void> {
    deliveryLog('telegram', message, 'summary');
    const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
    if (!token) return;
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: message.envelope.conversationId, text: summary }),
      signal: AbortSignal.timeout(10_000),
    });
  },

  async health() {
    return defaultHealth('telegram', ['TELEGRAM_WEBHOOK_SECRET']);
  },
};
