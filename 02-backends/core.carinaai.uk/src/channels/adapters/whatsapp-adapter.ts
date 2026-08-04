import crypto from 'node:crypto';
import type {
  ChannelAdapter,
  InboundMessage,
  OutboundMessage,
} from '../types.js';

type WhatsAppMessage = {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: { body?: string };
};

type WhatsAppValue = {
  metadata?: { phone_number_id?: string };
  contacts?: Array<{ wa_id?: string; profile?: { name?: string } }>;
  messages?: WhatsAppMessage[];
  statuses?: Array<{
    id: string;
    status: string;
    recipient_id?: string;
    errors?: unknown[];
  }>;
};

type WhatsAppWebhook = {
  entry?: Array<{
    changes?: Array<{ value?: WhatsAppValue }>;
  }>;
};

function webhookValue(payload: unknown): WhatsAppValue | undefined {
  return (payload as WhatsAppWebhook)?.entry?.[0]?.changes?.[0]?.value;
}

function contactNameFor(
  from: string,
  contacts?: WhatsAppValue['contacts'],
): string | undefined {
  const match = contacts?.find((contact) => contact.wa_id === from);
  return match?.profile?.name ?? contacts?.[0]?.profile?.name;
}

export function buildWhatsAppPayloadForMessage(
  payload: unknown,
  message: WhatsAppMessage,
): unknown {
  const body = payload as WhatsAppWebhook;
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
        value: { ...value, messages: [message] },
      }],
    }],
  };
}

export class WhatsApp24hWindowError extends Error {
  constructor(public readonly contactId: string) {
    super(`24h messaging window expired for ${contactId}`);
    this.name = 'WhatsApp24hWindowError';
  }
}

export function listWhatsAppInboundMessages(
  payload: unknown,
  workerId: string,
  workspaceId: string,
): InboundMessage[] {
  const value = webhookValue(payload);
  const out: InboundMessage[] = [];
  for (const message of value?.messages ?? []) {
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

export function extractWhatsAppStatuses(payload: unknown) {
  return (webhookValue(payload)?.statuses ?? []).map((status) => ({
    id: status.id,
    status: status.status,
    recipientId: status.recipient_id,
    errors: status.errors,
  }));
}

function welcomeTemplatePayload(message: OutboundMessage) {
  const templateName =
    process.env.WHATSAPP_WELCOME_TEMPLATE?.trim() || 'aiva_welcome';
  const languageCode =
    process.env.WHATSAPP_WELCOME_TEMPLATE_LANGUAGE?.trim() || 'en_GB';
  const firstName = message.metadata?.ownerFirstName?.trim() || 'there';
  const workerName = message.metadata?.workerName?.trim() || 'Aiva';
  const workerRole =
    message.metadata?.workerRole?.trim() || 'your personal assistant';

  return {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: message.contactId,
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
      components: [{
        type: 'body',
        parameters: [
          { type: 'text', text: firstName },
          { type: 'text', text: workerName },
          { type: 'text', text: workerRole },
        ],
      }],
    },
  };
}

function textPayload(message: OutboundMessage) {
  return {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: message.contactId,
    type: 'text',
    text: { preview_url: false, body: message.content },
    ...(message.replyToThreadId
      ? { context: { message_id: message.replyToThreadId } }
      : {}),
  };
}

export const whatsappAdapter: ChannelAdapter = {
  channel: 'whatsapp',

  verify(headers, rawBody) {
    const signature = headers['x-hub-signature-256'];
    const appSecret = process.env.WHATSAPP_APP_SECRET?.trim();
    if (!signature || !appSecret) return process.env.NODE_ENV !== 'production';
    const expected =
      `sha256=${crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex')}`;
    try {
      return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    } catch {
      return false;
    }
  },

  parse(payload, workerId, workspaceId) {
    return listWhatsAppInboundMessages(payload, workerId, workspaceId)[0] ?? null;
  },

  async send(message, credentials) {
    const accessToken = credentials.access_token ?? credentials.token;
    const phoneNumberId = credentials.phone_number_id;
    if (!accessToken || !phoneNumberId) {
      throw new Error('WhatsApp credentials missing access_token or phone_number_id');
    }

    const useWelcomeTemplate = message.metadata?.isFirstContact === 'true';
    const response = await fetch(
      `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(
          useWelcomeTemplate ? welcomeTemplatePayload(message) : textPayload(message),
        ),
      },
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({})) as {
        error?: { code?: number };
      };
      if (error.error?.code === 131047) {
        throw new WhatsApp24hWindowError(message.contactId);
      }
      throw new Error(`WhatsApp send failed: ${JSON.stringify(error)}`);
    }
  },
};

export function whatsappWelcomeConfigured(): boolean {
  const accessToken =
    process.env.WHATSAPP_ACCESS_TOKEN?.trim()
    || process.env.META_WHATSAPP_ACCESS_TOKEN?.trim();
  const phoneNumberId =
    process.env.WHATSAPP_PHONE_NUMBER_ID?.trim()
    || process.env.META_WHATSAPP_PHONE_NUMBER_ID?.trim();
  return Boolean(accessToken && phoneNumberId);
}

export async function sendWhatsAppWelcomeTemplate(input: {
  phone: string;
  ownerFirstName: string;
  workerName: string;
  workerRole: string;
}): Promise<void> {
  const accessToken =
    process.env.WHATSAPP_ACCESS_TOKEN?.trim()
    || process.env.META_WHATSAPP_ACCESS_TOKEN?.trim();
  const phoneNumberId =
    process.env.WHATSAPP_PHONE_NUMBER_ID?.trim()
    || process.env.META_WHATSAPP_PHONE_NUMBER_ID?.trim();
  if (!accessToken || !phoneNumberId) {
    throw new Error('WhatsApp welcome credentials are not configured');
  }

  await whatsappAdapter.send({
    channel: 'whatsapp',
    contactId: input.phone.replace(/\D/g, ''),
    content: 'Welcome',
    metadata: {
      isFirstContact: 'true',
      ownerFirstName: input.ownerFirstName,
      workerName: input.workerName,
      workerRole: input.workerRole,
    },
  }, {
    access_token: accessToken,
    phone_number_id: phoneNumberId,
  });
}

export function extractWhatsAppPhoneNumberId(payload: unknown): string | null {
  return webhookValue(payload)?.metadata?.phone_number_id ?? null;
}
