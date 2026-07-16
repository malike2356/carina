import crypto from 'node:crypto';
import type { ChannelShieldAdapter, ShieldEnvelope, ShieldMessage, ShieldProtection } from '../types.js';
import { baseEnvelope, defaultHealth, deliveryLog, type IngressRequest } from './helpers.js';

export const webShieldAdapter: ChannelShieldAdapter = {
  channel: 'web',

  async authenticateIngress(req: unknown): Promise<boolean> {
    const r = req as IngressRequest;
    const secret = process.env.CHANNEL_SHIELD_WEB_SECRET?.trim() || process.env.WIDGET_INGRESS_SECRET?.trim();
    if (!secret) return process.env.NODE_ENV !== 'production';
    const hdr = r.headers?.['x-channel-shield-secret'] ?? r.headers?.['x-widget-secret'];
    const origin = r.headers?.origin ?? '';
    const allow = (process.env.CHANNEL_SHIELD_WEB_ORIGINS ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (allow.length && origin && !allow.includes(origin)) return false;
    return hdr === secret;
  },

  async ingest(req: unknown, protection: ShieldProtection): Promise<ShieldEnvelope> {
    const body = ((req as IngressRequest).body ?? {}) as Record<string, unknown>;
    const text = String(body.text ?? body.message ?? body.content ?? '');
    const id = String(body.messageId ?? body.id ?? crypto.randomUUID());
    const from = String(body.visitorId ?? body.from ?? body.sessionId ?? 'visitor');
    const attachments = Array.isArray(body.attachments)
      ? (body.attachments as Array<Record<string, unknown>>).map((a, i) => ({
          id: String(a.id ?? `att-${i}`),
          filename: String(a.filename ?? a.name ?? `file-${i}`),
          contentType: String(a.contentType ?? 'application/octet-stream'),
          sizeBytes: Number(a.sizeBytes ?? a.size ?? 0),
          storageUri: a.url ? String(a.url) : undefined,
          sha256: a.sha256 ? String(a.sha256) : undefined,
        }))
      : [];

    return baseEnvelope('web', protection, {
      externalMessageId: id,
      conversationId: String(body.conversationId ?? body.threadId ?? from),
      from: { id: from, display: body.name ? String(body.name) : from },
      to: [{ id: protection.externalKey }],
      text,
      attachments,
      authSignals: {
        origin: (req as IngressRequest).headers?.origin,
        signatureValid: true,
      },
      metadata: { siteKey: protection.externalKey, embedKey: body.embedKey },
    });
  },

  async deliver(message: ShieldMessage, envelope: ShieldEnvelope): Promise<void> {
    deliveryLog('web', message, 'deliver');
    const hook = process.env.CHANNEL_SHIELD_WEB_DELIVER_URL?.trim();
    if (!hook) return;
    await fetch(hook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'channel_shield.deliver',
        messageId: message.id,
        conversationId: envelope.conversationId,
        text: envelope.text,
      }),
      signal: AbortSignal.timeout(10_000),
    });
  },

  async notifySafeSummary(message: ShieldMessage, summary: string): Promise<void> {
    deliveryLog('web', message, 'summary');
    const hook = process.env.CHANNEL_SHIELD_WEB_DELIVER_URL?.trim();
    if (!hook) return;
    await fetch(hook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'channel_shield.safe_summary',
        messageId: message.id,
        conversationId: message.envelope.conversationId,
        text: summary,
      }),
      signal: AbortSignal.timeout(10_000),
    });
  },

  async health() {
    return defaultHealth('web', ['CHANNEL_SHIELD_WEB_SECRET']);
  },
};
