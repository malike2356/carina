import crypto from 'crypto';
import type { NormalizedInboundMessage, InboundMailProvider } from './types.js';

function normalizeEmail(value: string): string {
  const match = value.match(/<([^>]+)>/);
  const raw = (match?.[1] ?? value).trim().toLowerCase();
  return raw;
}

function stripAngle(id: string): string {
  return id.replace(/^<|>$/g, '').trim();
}

export function checksumInboundPayload(parts: Record<string, unknown>): string {
  return crypto.createHash('sha256').update(JSON.stringify(parts)).digest('hex');
}

export function normalizeInboundMessage(input: {
  workspaceId: string;
  workerId?: string;
  provider: InboundMailProvider;
  providerMessageId: string;
  threadId?: string;
  inReplyTo?: string;
  references?: string | string[];
  from: string;
  to?: string | string[];
  cc?: string | string[];
  subject: string;
  textBody: string;
  htmlBody?: string;
  receivedAt?: string | Date;
  attachments?: NormalizedInboundMessage['attachments'];
  rawHeaders?: Record<string, string>;
}): NormalizedInboundMessage {
  const toList = Array.isArray(input.to)
    ? input.to.map(normalizeEmail).filter(Boolean)
    : String(input.to ?? '')
      .split(',')
      .map(normalizeEmail)
      .filter(Boolean);
  const ccList = Array.isArray(input.cc)
    ? input.cc.map(normalizeEmail).filter(Boolean)
    : String(input.cc ?? '')
      .split(',')
      .map(normalizeEmail)
      .filter(Boolean);
  const references = Array.isArray(input.references)
    ? input.references.map(stripAngle).filter(Boolean)
    : String(input.references ?? '')
      .split(/\s+/)
      .map(stripAngle)
      .filter(Boolean);
  const providerMessageId = stripAngle(input.providerMessageId) || crypto.randomUUID();
  const receivedAt = input.receivedAt
    ? new Date(input.receivedAt).toISOString()
    : new Date().toISOString();
  const textBody = String(input.textBody ?? '').slice(0, 100_000);
  const checksum = checksumInboundPayload({
    workspaceId: input.workspaceId,
    provider: input.provider,
    providerMessageId,
    threadId: input.threadId ?? '',
    inReplyTo: input.inReplyTo ? stripAngle(input.inReplyTo) : '',
    from: normalizeEmail(input.from),
    subject: input.subject,
    textBody: textBody.slice(0, 4000),
  });

  return {
    workspaceId: input.workspaceId,
    workerId: input.workerId,
    provider: input.provider,
    providerMessageId,
    threadId: input.threadId?.trim() || undefined,
    inReplyTo: input.inReplyTo ? stripAngle(input.inReplyTo) : undefined,
    references,
    from: normalizeEmail(input.from),
    to: toList,
    cc: ccList.length ? ccList : undefined,
    subject: String(input.subject ?? '').slice(0, 998),
    textBody,
    htmlSafeMeta: input.htmlBody
      ? { hasHtml: true, truncated: input.htmlBody.length > 50_000 }
      : undefined,
    receivedAt,
    attachments: (input.attachments ?? []).map((a) => ({
      filename: String(a.filename ?? 'attachment').slice(0, 255),
      contentType: a.contentType,
      sizeBytes: a.sizeBytes,
      providerAttachmentId: a.providerAttachmentId,
    })),
    checksum,
    rawHeaders: input.rawHeaders,
  };
}

/** Extract [aiva:deliveryId] correlation tokens from subject/body when present. */
export function extractCorrelationDeliveryId(subject: string, body: string): string | null {
  const haystack = `${subject}\n${body}`;
  const match = haystack.match(/\[aiva:([0-9a-f-]{36})\]/i);
  return match?.[1] ?? null;
}
