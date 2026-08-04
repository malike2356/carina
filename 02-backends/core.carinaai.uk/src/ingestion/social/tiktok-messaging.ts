import crypto from 'crypto';
import type { InboundMessage } from '../../channels/types.js';

/** Pin API version; update when TikTok Business Messaging docs change. */
export const TIKTOK_MESSAGING_API_VERSION = 'v1.3';
const TIKTOK_BUSINESS_API_BASE = `https://business-api.tiktok.com/open_api/${TIKTOK_MESSAGING_API_VERSION}`;

export interface TikTokInboundRecord {
  conversationId: string;
  contactId: string;
  text: string;
  messageId?: string;
  timestamp: Date;
}

export function parseTikTokWebhookPayload(
  payload: unknown,
  workerId: string,
  workspaceId: string,
  businessOpenId: string,
): InboundMessage | null {
  const record = extractInboundRecord(payload, businessOpenId);
  if (!record) return null;
  return toInboundMessage(record, workerId, workspaceId, payload);
}

export function parseTikTokPollMessage(
  row: Record<string, unknown>,
  workerId: string,
  workspaceId: string,
  businessOpenId: string,
): InboundMessage | null {
  const record = extractInboundRecord(row, businessOpenId);
  if (!record) return null;
  return toInboundMessage(record, workerId, workspaceId, row);
}

function toInboundMessage(
  record: TikTokInboundRecord,
  workerId: string,
  workspaceId: string,
  rawPayload: unknown,
): InboundMessage {
  return {
    channel: 'tiktok',
    workerId,
    workspaceId,
    contactId: record.contactId,
    conversationId: record.conversationId,
    content: record.text,
    rawPayload,
    timestamp: record.timestamp,
    threadId: record.messageId ?? record.conversationId,
  };
}

function extractInboundRecord(
  payload: unknown,
  businessOpenId: string,
): TikTokInboundRecord | null {
  if (!payload || typeof payload !== 'object') return null;
  const root = payload as Record<string, unknown>;

  const event = String(root.event ?? root.event_type ?? '').toLowerCase();
  if (event && !event.includes('message') && event !== 'im_receive_msg') {
    return null;
  }

  const content = (root.content ?? root.data ?? root.message ?? root) as Record<string, unknown>;
  const nested = (content.content ?? content.message ?? content) as Record<string, unknown>;

  const conversationId = stringField(
    nested.conversation_id
    ?? nested.conversationId
    ?? content.conversation_id
    ?? content.conversationId,
  );
  const senderId = stringField(
    nested.sender_id
    ?? nested.from_user_id
    ?? nested.from_user_open_id
    ?? nested.user_id
    ?? content.sender_id
    ?? content.from_user_id,
  );
  const text = extractText(nested) ?? extractText(content) ?? extractText(root);
  if (!conversationId || !senderId || !text?.trim()) return null;
  if (businessOpenId && senderId === businessOpenId) return null;

  const messageId = stringField(nested.message_id ?? nested.id ?? content.message_id);
  const tsRaw = nested.create_time ?? nested.timestamp ?? content.create_time ?? root.timestamp;
  const timestamp = parseTimestamp(tsRaw);

  return {
    conversationId,
    contactId: senderId,
    text: text.trim(),
    messageId: messageId ?? undefined,
    timestamp,
  };
}

function extractText(source: Record<string, unknown>): string | null {
  if (typeof source.text === 'string') return source.text;
  const textObj = source.text;
  if (textObj && typeof textObj === 'object') {
    const body = (textObj as Record<string, unknown>).body;
    if (typeof body === 'string') return body;
  }
  const content = source.content;
  if (typeof content === 'string') return content;
  if (content && typeof content === 'object') {
    const body = (content as Record<string, unknown>).text ?? (content as Record<string, unknown>).body;
    if (typeof body === 'string') return body;
  }
  return null;
}

function stringField(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number') return String(value);
  return null;
}

function parseTimestamp(value: unknown): Date {
  if (typeof value === 'number') {
    const ms = value > 1_000_000_000_000 ? value : value * 1000;
    return new Date(ms);
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return new Date(parsed);
  }
  return new Date();
}

export async function fetchTikTokInboundSince(input: {
  credentials: Record<string, string>;
  sinceIso?: string;
}): Promise<TikTokInboundRecord[]> {
  const accessToken = input.credentials.access_token?.trim();
  const businessId = input.credentials.business_id?.trim()
    ?? input.credentials.open_id?.trim();
  if (!accessToken || !businessId) return [];

  const params = new URLSearchParams({ business_id: businessId });
  if (input.sinceIso) params.set('start_time', input.sinceIso);

  const url = `${TIKTOK_BUSINESS_API_BASE}/business/message/list/?${params.toString()}`;
  const response = await fetchWithBackoff(url, {
    method: 'GET',
    headers: { 'Access-Token': accessToken },
  });
  if (!response.ok) return [];

  const body = await response.json() as {
    data?: { messages?: Record<string, unknown>[]; list?: Record<string, unknown>[] };
  };
  const rows = body.data?.messages ?? body.data?.list ?? [];
  const records: TikTokInboundRecord[] = [];
  for (const row of rows) {
    const parsed = extractInboundRecord({ data: row }, businessId);
    if (parsed) records.push(parsed);
  }
  return records;
}

export async function sendTikTokTextMessage(
  message: { contactId: string; conversationId?: string; content: string },
  credentials: Record<string, string>,
): Promise<void> {
  const accessToken = credentials.access_token?.trim();
  const businessId = credentials.business_id?.trim() ?? credentials.open_id?.trim();
  if (!accessToken || !businessId) {
    throw new Error('TikTok credentials missing access_token or business_id');
  }

  const conversationId = message.conversationId ?? message.contactId;
  const url = `${TIKTOK_BUSINESS_API_BASE}/business/message/send/`;
  const response = await fetchWithBackoff(url, {
    method: 'POST',
    headers: {
      'Access-Token': accessToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      business_id: businessId,
      conversation_id: conversationId,
      to_user_id: message.contactId,
      message_type: 'TEXT',
      text: { body: message.content },
    }),
  });

  if (!response.ok) {
    const error = await response.text().catch(() => '');
    throw new Error(`TikTok send failed: ${error || response.status}`);
  }
}

export function verifyTikTokWebhookSignature(
  headers: Record<string, string>,
  rawBody: Buffer,
  credentials: Record<string, string>,
): boolean {
  const secret = credentials.webhook_secret?.trim() ?? '';
  const signature = headers['tiktok-signature']
    ?? headers['x-tiktok-signature']
    ?? '';
  if (!secret) return process.env.NODE_ENV !== 'production';
  if (!signature) return false;

  const timestamp = headers['tiktok-timestamp'] ?? headers['x-tiktok-timestamp'] ?? '';
  const payload = timestamp ? `${timestamp}${rawBody.toString('utf8')}` : rawBody;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  const normalized = signature.replace(/^sha256=/i, '').trim();
  return normalized === expected;
}

async function fetchWithBackoff(
  url: string,
  init: RequestInit,
  attempt = 0,
): Promise<Response> {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(15_000) });
  if (response.status === 429 && attempt < 2) {
    await new Promise((resolve) => setTimeout(resolve, (attempt + 1) * 2000));
    return fetchWithBackoff(url, init, attempt + 1);
  }
  return response;
}
