import type { Request } from 'express';
import { isControlAuthorized } from '../infrastructure/control-auth.js';
import { signPayload, verifyPayloadSignature } from './store.js';

export function getInboundWebhookSecret(): string | null {
  const secret = process.env.CARINA_WEBHOOK_INBOUND_SECRET?.trim();
  return secret || null;
}

export function verifyInboundTrigger(req: Request, rawBody: string): boolean {
  if (isControlAuthorized(req)) return true;
  if (req.session?.webAuthed) return true;

  const secret = getInboundWebhookSecret();
  if (!secret) return false;

  const signature = String(req.headers['x-carina-inbound-signature'] ?? '').trim();
  return verifyPayloadSignature(secret, rawBody, signature);
}

export function signInboundPayload(body: string): string | null {
  const secret = getInboundWebhookSecret();
  if (!secret) return null;
  return signPayload(secret, body);
}
