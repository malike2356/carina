import crypto from 'node:crypto';
import type { ChannelShieldAdapter, ShieldEnvelope, ShieldMessage, ShieldProtection } from '../types.js';
import { baseEnvelope, defaultHealth, deliveryLog, type IngressRequest } from './helpers.js';

function verifySmtpOrWebhook(req: IngressRequest): boolean {
  const secret = process.env.CHANNEL_SHIELD_EMAIL_INGRESS_SECRET?.trim() || process.env.EMAIL_CHANNEL_WEBHOOK_SECRET?.trim();
  if (!secret) return process.env.NODE_ENV !== 'production';
  const hdr = req.headers?.['x-channel-shield-secret'] ?? req.headers?.['x-email-webhook-secret'];
  return hdr === secret;
}

export const emailShieldAdapter: ChannelShieldAdapter = {
  channel: 'email',

  async authenticateIngress(req: unknown): Promise<boolean> {
    return verifySmtpOrWebhook(req as IngressRequest);
  },

  async ingest(req: unknown, protection: ShieldProtection): Promise<ShieldEnvelope> {
    const r = req as IngressRequest;
    const body = (r.body ?? {}) as Record<string, unknown>;
    const from = String(body.from ?? body.From ?? 'unknown@invalid');
    const toRaw = body.to ?? body.To ?? [];
    const toList = Array.isArray(toRaw)
      ? toRaw.map((t) => ({ id: String(typeof t === 'string' ? t : (t as { id?: string }).id ?? t) }))
      : [{ id: String(toRaw) }];
    const subject = body.subject ? String(body.subject) : body.Subject ? String(body.Subject) : undefined;
    const text = String(body.text ?? body.TextBody ?? body.body ?? '');
    const html = body.html ? String(body.html) : body.HtmlBody ? String(body.HtmlBody) : undefined;
    const externalMessageId = String(
      body.messageId ?? body['Message-ID'] ?? body.id ?? crypto.randomUUID(),
    ).replace(/[<>]/g, '');
    const attachments = Array.isArray(body.attachments)
      ? (body.attachments as Array<Record<string, unknown>>).map((a, i) => ({
          id: String(a.id ?? `att-${i}`),
          filename: String(a.filename ?? a.name ?? `file-${i}`),
          contentType: String(a.contentType ?? a.content_type ?? 'application/octet-stream'),
          sizeBytes: Number(a.sizeBytes ?? a.size ?? 0),
          sha256: a.sha256 ? String(a.sha256) : undefined,
          storageUri: a.storageUri ? String(a.storageUri) : undefined,
        }))
      : [];

    return baseEnvelope('email', protection, {
      externalMessageId,
      conversationId: String(body.threadId ?? body['In-Reply-To'] ?? externalMessageId),
      from: { id: from, display: String(body.fromName ?? from), handles: [from] },
      to: toList,
      subject,
      text,
      html,
      attachments,
      authSignals: {
        spf: body.spf ?? (body.authSignals as Record<string, unknown> | undefined)?.spf,
        dkim: body.dkim ?? (body.authSignals as Record<string, unknown> | undefined)?.dkim,
        dmarc: body.dmarc ?? (body.authSignals as Record<string, unknown> | undefined)?.dmarc,
        ...(typeof body.authSignals === 'object' && body.authSignals ? (body.authSignals as object) : {}),
      },
      metadata: { mode: body.mode ?? 'smtp_mx', provider: body.provider ?? 'smtp' },
    });
  },

  async deliver(message: ShieldMessage, envelope: ShieldEnvelope): Promise<void> {
    deliveryLog('email', message, 'deliver', { to: envelope.to, subject: envelope.subject });
    const smtpUrl = process.env.CHANNEL_SHIELD_EMAIL_DELIVER_URL?.trim();
    if (!smtpUrl) {
      // Soft deliver: recorded; outbound SMTP optional in non-prod
      return;
    }
    await fetch(smtpUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messageId: message.id,
        from: envelope.from,
        to: envelope.to,
        subject: envelope.subject,
        text: envelope.text,
        html: envelope.html,
        attachments: envelope.attachments,
      }),
      signal: AbortSignal.timeout(15_000),
    });
  },

  async notifySafeSummary(message: ShieldMessage, summary: string): Promise<void> {
    deliveryLog('email', message, 'summary');
    const smtpUrl = process.env.CHANNEL_SHIELD_EMAIL_DELIVER_URL?.trim();
    if (!smtpUrl) return;
    await fetch(smtpUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messageId: message.id,
        to: message.envelope.to,
        subject: `[Channel Shield] Held: ${message.envelope.subject ?? 'message'}`,
        text: summary,
      }),
      signal: AbortSignal.timeout(15_000),
    });
  },

  async health() {
    return defaultHealth('email', ['CHANNEL_SHIELD_EMAIL_INGRESS_SECRET']);
  },
};
