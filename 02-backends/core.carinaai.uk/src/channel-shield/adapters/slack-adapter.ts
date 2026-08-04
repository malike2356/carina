import crypto from 'node:crypto';
import type { ChannelShieldAdapter, ShieldEnvelope, ShieldMessage, ShieldProtection } from '../types.js';
import { baseEnvelope, defaultHealth, deliveryLog, type IngressRequest } from './helpers.js';

function verifySlack(req: IngressRequest): boolean {
  const timestamp = req.headers?.['x-slack-request-timestamp'];
  const sig = req.headers?.['x-slack-signature'];
  const signingSecret = process.env.SLACK_SIGNING_SECRET?.trim();
  if (!timestamp || !sig || !signingSecret) return process.env.NODE_ENV !== 'production';
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const raw = req.rawBody?.toString() ?? JSON.stringify(req.body ?? {});
  const expected = `v0=${crypto.createHmac('sha256', signingSecret).update(`v0:${timestamp}:${raw}`).digest('hex')}`;
  try {
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

export const slackShieldAdapter: ChannelShieldAdapter = {
  channel: 'slack',

  async authenticateIngress(req: unknown): Promise<boolean> {
    return verifySlack(req as IngressRequest);
  },

  async ingest(req: unknown, protection: ShieldProtection): Promise<ShieldEnvelope> {
    const r = req as IngressRequest;
    const body = (r.body ?? {}) as Record<string, unknown>;
    const event = (body.event ?? body) as Record<string, unknown>;
    const text = String(event.text ?? body.text ?? '');
    const user = String(event.user ?? body.user ?? 'unknown');
    const channel = String(event.channel ?? body.channel ?? protection.externalKey);
    const ts = String(event.ts ?? body.ts ?? crypto.randomUUID());
    const files = Array.isArray(event.files) ? (event.files as Array<Record<string, unknown>>) : [];
    const attachments = files.map((f, i) => ({
      id: String(f.id ?? `file-${i}`),
      filename: String(f.name ?? f.title ?? `file-${i}`),
      contentType: String(f.mimetype ?? 'application/octet-stream'),
      sizeBytes: Number(f.size ?? 0),
      storageUri: f.url_private ? String(f.url_private) : undefined,
    }));

    return baseEnvelope('slack', protection, {
      externalMessageId: ts,
      conversationId: String(event.thread_ts ?? channel),
      from: { id: user, display: user },
      to: [{ id: channel }],
      text,
      attachments,
      authSignals: { signatureValid: true, teamId: body.team_id },
      metadata: { teamId: body.team_id, eventType: event.type },
    });
  },

  async deliver(message: ShieldMessage, envelope: ShieldEnvelope): Promise<void> {
    deliveryLog('slack', message, 'deliver');
    const token = process.env.SLACK_BOT_TOKEN?.trim();
    if (!token) return;
    await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel: envelope.conversationId,
        text: envelope.text,
        thread_ts: envelope.metadata.thread_ts,
      }),
      signal: AbortSignal.timeout(10_000),
    });
  },

  async notifySafeSummary(message: ShieldMessage, summary: string): Promise<void> {
    deliveryLog('slack', message, 'summary');
    const token = process.env.SLACK_BOT_TOKEN?.trim();
    if (!token) return;
    await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel: message.envelope.to[0]?.id ?? message.envelope.conversationId,
        text: summary,
        thread_ts: message.envelope.externalMessageId,
      }),
      signal: AbortSignal.timeout(10_000),
    });
  },

  async health() {
    return defaultHealth('slack', ['SLACK_SIGNING_SECRET']);
  },
};
