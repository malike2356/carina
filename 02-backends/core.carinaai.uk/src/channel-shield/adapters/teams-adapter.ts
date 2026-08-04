import crypto from 'node:crypto';
import type { ChannelShieldAdapter, ShieldEnvelope, ShieldMessage, ShieldProtection } from '../types.js';
import { baseEnvelope, defaultHealth, deliveryLog, type IngressRequest } from './helpers.js';

export const teamsShieldAdapter: ChannelShieldAdapter = {
  channel: 'teams',

  async authenticateIngress(req: unknown): Promise<boolean> {
    const r = req as IngressRequest;
    const secret = process.env.TEAMS_WEBHOOK_SECRET?.trim() || process.env.CHANNEL_SHIELD_TEAMS_SECRET?.trim();
    if (!secret) return process.env.NODE_ENV !== 'production';
    return (r.headers?.['authorization'] ?? r.headers?.['x-teams-secret']) === secret
      || r.headers?.['x-channel-shield-secret'] === secret;
  },

  async ingest(req: unknown, protection: ShieldProtection): Promise<ShieldEnvelope> {
    const body = ((req as IngressRequest).body ?? {}) as Record<string, unknown>;
    const fromObj = (body.from as { id?: string; name?: string } | undefined) ?? {};
    const text = String(body.text ?? body.body ?? '');
    const id = String(body.id ?? body.messageId ?? crypto.randomUUID());
    const conversation = (body.conversation as { id?: string } | undefined)?.id
      ?? String(body.channelId ?? protection.externalKey);
    const attachments = Array.isArray(body.attachments)
      ? (body.attachments as Array<Record<string, unknown>>).map((a, i) => ({
          id: String(a.id ?? `att-${i}`),
          filename: String(a.name ?? a.contentUrl ?? `file-${i}`),
          contentType: String(a.contentType ?? 'application/octet-stream'),
          sizeBytes: Number(a.size ?? 0),
          storageUri: a.contentUrl ? String(a.contentUrl) : undefined,
        }))
      : [];

    return baseEnvelope('teams', protection, {
      externalMessageId: id,
      conversationId: conversation,
      from: { id: String(fromObj.id ?? body.fromId ?? 'unknown'), display: fromObj.name },
      to: [{ id: conversation }],
      text,
      attachments,
      authSignals: { tenantId: body.tenantId, signatureValid: true },
      metadata: { serviceUrl: body.serviceUrl, activityType: body.type },
    });
  },

  async deliver(message: ShieldMessage, envelope: ShieldEnvelope): Promise<void> {
    deliveryLog('teams', message, 'deliver');
    const serviceUrl = String(envelope.metadata.serviceUrl ?? process.env.TEAMS_BOT_SERVICE_URL ?? '');
    if (!serviceUrl) return;
    await fetch(`${serviceUrl.replace(/\/$/, '')}/v3/conversations/${encodeURIComponent(envelope.conversationId)}/activities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'message', text: envelope.text }),
      signal: AbortSignal.timeout(10_000),
    });
  },

  async notifySafeSummary(message: ShieldMessage, summary: string): Promise<void> {
    deliveryLog('teams', message, 'summary');
    const serviceUrl = String(message.envelope.metadata.serviceUrl ?? process.env.TEAMS_BOT_SERVICE_URL ?? '');
    if (!serviceUrl) return;
    await fetch(
      `${serviceUrl.replace(/\/$/, '')}/v3/conversations/${encodeURIComponent(message.envelope.conversationId)}/activities`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'message', text: summary }),
        signal: AbortSignal.timeout(10_000),
      },
    );
  },

  async health() {
    return defaultHealth('teams', ['TEAMS_WEBHOOK_SECRET']);
  },
};
