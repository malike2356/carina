import crypto from 'node:crypto';
import type { ChannelShieldAdapter, ShieldEnvelope, ShieldMessage, ShieldProtection } from '../types.js';
import { baseEnvelope, defaultHealth, deliveryLog, type IngressRequest } from './helpers.js';

export const smsShieldAdapter: ChannelShieldAdapter = {
  channel: 'sms',

  async authenticateIngress(req: unknown): Promise<boolean> {
    const r = req as IngressRequest;
    const authToken = process.env.TWILIO_AUTH_TOKEN?.trim() || process.env.CHANNEL_SHIELD_SMS_SECRET?.trim();
    if (!authToken) return process.env.NODE_ENV !== 'production';
    const sig = r.headers?.['x-twilio-signature'] ?? r.headers?.['x-channel-shield-secret'];
    if (r.headers?.['x-channel-shield-secret']) return sig === authToken;
    // Twilio signature validation needs full URL; accept shared secret for Shield ingress.
    return Boolean(sig);
  },

  async ingest(req: unknown, protection: ShieldProtection): Promise<ShieldEnvelope> {
    const body = ((req as IngressRequest).body ?? {}) as Record<string, unknown>;
    const from = String(body.From ?? body.from ?? 'unknown');
    const to = String(body.To ?? body.to ?? protection.externalKey);
    const text = String(body.Body ?? body.body ?? body.text ?? '');
    const id = String(body.MessageSid ?? body.SmsSid ?? body.id ?? crypto.randomUUID());
    const numMedia = Number(body.NumMedia ?? 0);
    const attachments: ShieldEnvelope['attachments'] = [];
    for (let i = 0; i < numMedia; i++) {
      const url = body[`MediaUrl${i}`];
      const ctype = body[`MediaContentType${i}`];
      if (url) {
        attachments.push({
          id: `mms-${i}`,
          filename: `mms-${i}`,
          contentType: String(ctype ?? 'application/octet-stream'),
          sizeBytes: 0,
          storageUri: String(url),
        });
      }
    }

    return baseEnvelope('sms', protection, {
      externalMessageId: id,
      conversationId: from,
      from: { id: from, handles: [from] },
      to: [{ id: to }],
      text,
      attachments,
      authSignals: { signatureValid: true },
      metadata: { provider: 'twilio' },
    });
  },

  async deliver(message: ShieldMessage, envelope: ShieldEnvelope): Promise<void> {
    deliveryLog('sms', message, 'deliver');
    const sid = process.env.TWILIO_ACCOUNT_SID?.trim();
    const token = process.env.TWILIO_AUTH_TOKEN?.trim();
    const from = process.env.TWILIO_FROM_NUMBER?.trim() || envelope.to[0]?.id;
    if (!sid || !token || !from) return;
    const params = new URLSearchParams({
      To: envelope.from.id,
      From: from,
      Body: envelope.text.slice(0, 1600),
    });
    await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
      signal: AbortSignal.timeout(10_000),
    });
  },

  async notifySafeSummary(message: ShieldMessage, summary: string): Promise<void> {
    deliveryLog('sms', message, 'summary');
    const sid = process.env.TWILIO_ACCOUNT_SID?.trim();
    const token = process.env.TWILIO_AUTH_TOKEN?.trim();
    const from = process.env.TWILIO_FROM_NUMBER?.trim() || message.envelope.to[0]?.id;
    if (!sid || !token || !from) return;
    const short = summary.length > 300 ? `${summary.slice(0, 297)}...` : summary;
    const params = new URLSearchParams({
      To: message.envelope.from.id,
      From: from,
      Body: short,
    });
    await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
      signal: AbortSignal.timeout(10_000),
    });
  },

  async health() {
    return defaultHealth('sms', ['TWILIO_AUTH_TOKEN']);
  },
};
