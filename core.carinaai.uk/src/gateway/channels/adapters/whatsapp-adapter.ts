import twilio from 'twilio';
import { config } from '../../../config/index.js';
import { formatForChannel } from '../channel-formatter.js';
import type {
  Attachment,
  ChannelMessage,
  IChannelAdapter,
  SendOptions,
  WebhookValidationInput,
} from '../channel-adapter.interface.js';

export class WhatsAppAdapter implements IChannelAdapter {
  readonly name = 'whatsapp' as const;

  constructor(readonly enabled: boolean) {}

  parseInbound(raw: unknown): ChannelMessage | null {
    const body = raw as Record<string, unknown>;
    const from = String(body.From ?? '');
    const text = String(body.Body ?? '').trim();
    if (!from || (!text && !body.NumMedia)) return null;

    const attachments = parseTwilioAttachments(body);
    const mediaPaths = Array.isArray(body.__mediaPaths) ? body.__mediaPaths : [];
    for (const mediaPath of mediaPaths) {
      if (typeof mediaPath === 'string') attachments.push({ path: mediaPath });
    }
    return {
      id: String(body.MessageSid ?? Date.now()),
      channel: 'whatsapp',
      externalUserId: from,
      conversationId: from,
      text,
      timestamp: new Date(),
      isDirect: true,
      isMention: false,
      isCommand: text.startsWith('/'),
      attachments,
      raw,
    };
  }

  async sendMessage(conversationId: string, text: string, _options: SendOptions = {}): Promise<void> {
    if (!this.enabled) return;
    const client = twilio(config.twilio.accountSid, config.twilio.authToken);
    for (const chunk of this.formatForChannel(text)) {
      await client.messages.create({
        from: config.twilio.fromNumber,
        to: conversationId,
        body: chunk,
      });
    }
  }

  formatForChannel(text: string): string[] {
    return formatForChannel('whatsapp', text);
  }

  validateWebhook(input: WebhookValidationInput): boolean {
    if (!config.twilio.authToken || !input.url) return false;
    const signature = headerValue(input.headers['x-twilio-signature']);
    return twilio.validateRequest(
      config.twilio.authToken,
      signature ?? '',
      input.url,
      input.body as Record<string, string>,
    );
  }
}

export function parseTwilioAttachments(body: Record<string, unknown>): Attachment[] {
  const count = parseInt(String(body.NumMedia ?? '0'), 10) || 0;
  const attachments: Attachment[] = [];
  for (let i = 0; i < count; i++) {
    const url = String(body[`MediaUrl${i}`] ?? '');
    if (!url) continue;
    attachments.push({
      url,
      contentType: String(body[`MediaContentType${i}`] ?? ''),
    });
  }
  return attachments;
}

function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
