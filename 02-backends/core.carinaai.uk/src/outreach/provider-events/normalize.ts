import crypto from 'crypto';
import type { NormalizedProviderEvent, ProviderEventKind } from './types.js';

export function checksumProviderPayload(parts: Record<string, unknown>): string {
  return crypto.createHash('sha256').update(JSON.stringify(parts)).digest('hex');
}

const RESEND_KIND_MAP: Record<string, ProviderEventKind> = {
  'email.sent': 'sent',
  'email.delivered': 'delivered',
  'email.delivery_delayed': 'deferred',
  'email.bounced': 'hard_bounce',
  'email.complained': 'complaint',
  'email.opened': 'opened',
  'email.clicked': 'clicked',
  'email.failed': 'failed',
};

export function normalizeResendDeliveryEvent(input: {
  body: Record<string, unknown>;
  svixId?: string;
  receivedAt?: Date;
}): NormalizedProviderEvent | null {
  const type = String(input.body.type ?? input.body.event ?? '').trim();
  const kind = RESEND_KIND_MAP[type];
  if (!kind) return null;

  const data = (input.body.data && typeof input.body.data === 'object')
    ? input.body.data as Record<string, unknown>
    : input.body;
  const providerMessageId = String(
    data.email_id ?? data.emailId ?? data.message_id ?? data.id ?? '',
  ).trim() || undefined;

  // Soft vs hard bounce: Resend may set bounce.type
  let resolvedKind = kind;
  if (type === 'email.bounced') {
    const bounceType = String((data.bounce as { type?: string } | undefined)?.type
      ?? data.bounce_type
      ?? data.type
      ?? '').toLowerCase();
    if (bounceType.includes('soft') || bounceType === 'transient') {
      resolvedKind = 'soft_bounce';
    }
  }

  const tags = Array.isArray(data.tags) ? data.tags as Array<{ name?: string; value?: string }> : [];
  const tagMap = Object.fromEntries(
    tags.filter((t) => t.name && t.value).map((t) => [String(t.name), String(t.value)]),
  );
  const workspaceId = tagMap.workspace_id || tagMap.workspaceId || undefined;
  const deliveryId = tagMap.delivery_id || tagMap.deliveryId || undefined;
  const mailboxIdentity = String(data.to ?? data.from ?? tagMap.mailbox ?? '').trim() || undefined;

  const occurredAt = data.created_at || data.createdAt || input.body.created_at;
  const occurred = occurredAt ? new Date(String(occurredAt)).toISOString() : new Date().toISOString();
  const providerEventId = String(
    input.svixId
    || input.body.id
    || `${type}:${providerMessageId ?? 'unknown'}:${occurred}`,
  );

  const checksum = checksumProviderPayload({
    provider: 'resend',
    providerEventId,
    type,
    providerMessageId,
    kind: resolvedKind,
  });

  return {
    provider: 'resend',
    providerEventId,
    workspaceId,
    mailboxIdentity,
    providerMessageId,
    deliveryId,
    kind: resolvedKind,
    occurredAt: occurred,
    receivedAt: (input.receivedAt ?? new Date()).toISOString(),
    checksum,
    payload: input.body,
  };
}

const MAILGUN_KIND_MAP: Record<string, ProviderEventKind> = {
  accepted: 'accepted',
  delivered: 'delivered',
  failed: 'failed',
  rejected: 'failed',
  complained: 'complaint',
  unsubscribed: 'unsubscribe',
  opened: 'opened',
  clicked: 'clicked',
};

export function normalizeMailgunDeliveryEvent(input: {
  body: Record<string, unknown>;
  receivedAt?: Date;
}): NormalizedProviderEvent | null {
  const eventData = (input.body['event-data'] && typeof input.body['event-data'] === 'object')
    ? input.body['event-data'] as Record<string, unknown>
    : input.body;
  const eventName = String(eventData.event ?? input.body.event ?? '').toLowerCase();
  let kind: ProviderEventKind | undefined;
  if (eventName === 'failed') {
    const severity = String(
      (eventData.severity && typeof eventData.severity === 'object'
        ? (eventData.severity as { severity?: string }).severity
        : eventData.severity)
      ?? '',
    ).toLowerCase();
    kind = severity === 'temporary' ? 'soft_bounce' : 'hard_bounce';
  } else {
    kind = MAILGUN_KIND_MAP[eventName];
  }
  if (!kind) return null;

  const message = (eventData.message && typeof eventData.message === 'object')
    ? eventData.message as Record<string, unknown>
    : {};
  const headers = (message.headers && typeof message.headers === 'object')
    ? message.headers as Record<string, string>
    : {};
  const providerMessageId = String(
    headers['message-id']
    ?? eventData['message-id']
    ?? '',
  ).replace(/^<|>$/g, '').trim() || undefined;

  const signature = (input.body.signature && typeof input.body.signature === 'object')
    ? input.body.signature as Record<string, unknown>
    : {};
  const providerEventId = String(
    eventData.id
    ?? signature.token
    ?? `${eventName}:${providerMessageId ?? 'unknown'}:${eventData.timestamp ?? Date.now()}`,
  );

  const userVariables = (eventData['user-variables'] && typeof eventData['user-variables'] === 'object')
    ? eventData['user-variables'] as Record<string, string>
    : {};

  const checksum = checksumProviderPayload({
    provider: 'mailgun',
    providerEventId,
    eventName,
    providerMessageId,
    kind,
  });

  return {
    provider: 'mailgun',
    providerEventId,
    workspaceId: userVariables.workspace_id || userVariables.workspaceId,
    mailboxIdentity: String(eventData.recipient ?? '').trim() || undefined,
    providerMessageId,
    deliveryId: userVariables.delivery_id || userVariables.deliveryId,
    kind,
    occurredAt: eventData.timestamp
      ? new Date(Number(eventData.timestamp) * 1000).toISOString()
      : new Date().toISOString(),
    receivedAt: (input.receivedAt ?? new Date()).toISOString(),
    checksum,
    payload: input.body,
  };
}
