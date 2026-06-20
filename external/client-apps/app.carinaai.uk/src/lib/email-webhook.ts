import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

export function signInboundPayload(secret: string, body: string): string {
  return createHmac('sha256', secret).update(body).digest('hex');
}

export function verifyInboundPayload(secret: string, body: string, signature: string): boolean {
  if (!secret || !signature) return false;
  const expected = signInboundPayload(secret, body);
  try {
    return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'));
  } catch {
    return false;
  }
}

export function generateInboundEmailToken(): string {
  return randomBytes(24).toString('hex');
}

export interface InboundEmailPayload {
  from: string;
  to?: string;
  subject: string;
  text: string;
  html?: string;
  messageId?: string;
}

export function parseInboundEmailBody(body: Record<string, unknown>): InboundEmailPayload {
  const data = (body.data ?? body) as Record<string, unknown>;
  return {
    from: String(data.from ?? body.from ?? ''),
    to: String(data.to ?? body.to ?? ''),
    subject: String(data.subject ?? body.subject ?? ''),
    text: String(data.text ?? body.text ?? ''),
    html: String(data.html ?? body.html ?? ''),
    messageId: String(data.message_id ?? data.messageId ?? body.message_id ?? ''),
  };
}
