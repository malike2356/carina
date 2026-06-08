import twilio from 'twilio';
import { config } from '../../../config/index.js';
import { splitByLength } from '../channel-formatter.js';
import type {
  ChannelMessage,
  IChannelAdapter,
  SendOptions,
  WebhookValidationInput,
} from '../channel-adapter.interface.js';

const SMS_PREFIX = '[Carina] ';

export class SmsAdapter implements IChannelAdapter {
  readonly name = 'sms' as const;

  constructor(readonly enabled: boolean) {}

  parseInbound(raw: unknown): ChannelMessage | null {
    const body = raw as Record<string, unknown>;
    const from = String(body.From ?? '');
    const text = String(body.Body ?? '').trim();
    if (!from || !text) return null;

    return {
      id: String(body.MessageSid ?? Date.now()),
      channel: 'sms',
      externalUserId: from,
      conversationId: from,
      text,
      timestamp: new Date(),
      isDirect: true,
      isMention: false,
      isCommand: text.startsWith('/'),
      raw,
    };
  }

  async sendMessage(conversationId: string, text: string, _options: SendOptions = {}): Promise<void> {
    if (!this.enabled) return;
    const client = twilio(config.sms.accountSid, config.sms.authToken);
    for (const chunk of this.formatForChannel(text)) {
      await client.messages.create({
        from: config.sms.fromNumber,
        to: conversationId,
        body: chunk,
      });
    }
  }

  formatForChannel(text: string): string[] {
    const available = 160 - SMS_PREFIX.length;
    return splitByLength(stripMarkdown(text), available).map((chunk) => SMS_PREFIX + chunk);
  }

  validateWebhook(input: WebhookValidationInput): boolean {
    if (!config.sms.authToken || !input.url) return false;
    const signature = headerValue(input.headers['x-twilio-signature']);
    return twilio.validateRequest(
      config.sms.authToken,
      signature ?? '',
      input.url,
      input.body as Record<string, string>,
    );
  }
}

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)');
}

function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
