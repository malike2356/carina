import crypto from 'crypto';
import type { ChannelAdapter, InboundMessage, OutboundMessage } from '../types.js';

interface WhatsAppContact {
  wa_id?: string;
  profile?: { name?: string };
}

interface WhatsAppWebhookPayload {
  entry?: Array<{
    changes?: Array<{
      value?: {
        metadata?: { phone_number_id?: string };
        contacts?: WhatsAppContact[];
        messages?: Array<{
          from: string;
          id: string;
          timestamp: string;
          type: string;
          text?: { body: string };
        }>;
        statuses?: Array<{
          id: string;
          status: string;
          recipient_id?: string;
          errors?: Array<{ code?: number; title?: string }>;
        }>;
      };
    }>;
  }>;
}

function contactNameFor(from: string, contacts?: WhatsAppContact[]): string | undefined {
  const match = contacts?.find((c) => c.wa_id === from);
  return match?.profile?.name ?? contacts?.[0]?.profile?.name;
}

export function buildWhatsAppPayloadForMessage(
  payload: unknown,
  message: {
    from: string;
    id: string;
    timestamp: string;
    type: string;
    text?: { body: string };
  },
): unknown {
  const body = payload as WhatsAppWebhookPayload;
  const entry = body.entry?.[0];
  const change = entry?.changes?.[0];
  const value = change?.value;
  if (!entry || !change || !value) return payload;
  return {
    ...body,
    entry: [{
      ...entry,
      changes: [{
        ...change,
        value: {
          ...value,
          messages: [message],
        },
      }],
    }],
  };
}

export class WhatsApp24hWindowError extends Error {
  constructor(public contactId: string) {
    super(`24h messaging window expired for ${contactId}`);
    this.name = 'WhatsApp24hWindowError';
  }
}

export function listWhatsAppInboundMessages(
  payload: unknown,
  workerId: string,
  workspaceId: string,
): InboundMessage[] {
  const body = payload as WhatsAppWebhookPayload;
  const value = body?.entry?.[0]?.changes?.[0]?.value;
  const messages = value?.messages ?? [];
  const out: InboundMessage[] = [];
  for (const message of messages) {
    if (message.type !== 'text' || !message.text?.body) continue;
    out.push({
      channel: 'whatsapp',
      workerId,
      workspaceId,
      contactId: message.from,
      contactName: contactNameFor(message.from, value?.contacts),
      content: message.text.body,
      rawPayload: message,
      timestamp: new Date(Number(message.timestamp) * 1000),
      threadId: message.id,
    });
  }
  return out;
}

export function extractWhatsAppStatuses(payload: unknown): Array<{
  id: string;
  status: string;
  recipientId?: string;
  errors?: Array<{ code?: number; title?: string }>;
}> {
  const body = payload as WhatsAppWebhookPayload;
  const statuses = body?.entry?.[0]?.changes?.[0]?.value?.statuses ?? [];
  return statuses.map((s) => ({
    id: s.id,
    status: s.status,
    recipientId: s.recipient_id,
    errors: s.errors,
  }));
}

export const whatsappAdapter: ChannelAdapter = {
  channel: 'whatsapp',

  verify(headers, rawBody) {
    const sig = headers['x-hub-signature-256'];
    const appSecret = process.env.WHATSAPP_APP_SECRET?.trim();
    if (!sig || !appSecret) return process.env.NODE_ENV !== 'production';
    const expected = `sha256=${crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex')}`;
    try {
      return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
    } catch {
      return false;
    }
  },

  parse(payload, workerId, workspaceId): InboundMessage | null {
    const body = payload as WhatsAppWebhookPayload;
    const message = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!message) return null;
    return listWhatsAppInboundMessages(
      buildWhatsAppPayloadForMessage(payload, message),
      workerId,
      workspaceId,
    )[0] ?? null;
  },

  async send(message: OutboundMessage, credentials: Record<string, string>): Promise<void> {
    const accessToken = credentials.access_token ?? credentials.token;
    const phoneNumberId = credentials.phone_number_id;
    if (!accessToken || !phoneNumberId) {
      throw new Error('WhatsApp credentials missing access_token or phone_number_id');
    }

    const url = `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`;
    const body = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: message.contactId,
      type: 'text',
      text: { preview_url: false, body: message.content },
      ...(message.replyToThreadId ? { context: { message_id: message.replyToThreadId } } : {}),
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({})) as { error?: { code?: number } };
      if (error?.error?.code === 131047) {
        throw new WhatsApp24hWindowError(message.contactId);
      }
      throw new Error(`WhatsApp send failed: ${JSON.stringify(error)}`);
    }
  },
};

export function extractWhatsAppPhoneNumberId(payload: unknown): string | null {
  const body = payload as WhatsAppWebhookPayload;
  return body?.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id ?? null;
}
