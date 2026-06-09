import type { IChannelAdapter, SendOptions, WebhookValidationInput } from '../channel-adapter.interface.js';
import { parseGenericWebhook, restSend } from './rest-channel-helpers.js';
import { formatForChannel } from '../channel-formatter.js';

export class SignalAdapter implements IChannelAdapter {
  readonly name = 'signal' as const;

  constructor(
    readonly enabled: boolean,
    private readonly apiUrl = process.env.SIGNAL_API_URL ?? '',
    private readonly apiKey = process.env.SIGNAL_API_KEY ?? '',
    private readonly number = process.env.SIGNAL_PHONE_NUMBER ?? '',
  ) {}

  parseInbound(raw: unknown) {
    return parseGenericWebhook(raw, 'signal', (p) => {
      const envelope = p.envelope as Record<string, unknown> | undefined;
      const from = String(p.source ?? p.from ?? envelope?.sourceNumber ?? '');
      return {
        text: String(p.message ?? p.body ?? p.text ?? ''),
        userId: from,
        conversationId: from,
        messageId: String(p.id ?? p.timestamp ?? ''),
        isDirect: true,
      };
    });
  }

  async sendMessage(conversationId: string, text: string): Promise<void> {
    if (!this.apiUrl || !this.number) return;
    const url = `${this.apiUrl.replace(/\/$/, '')}/v2/send`;
    for (const chunk of formatForChannel('web', text)) {
      await restSend(url, chunk, {
        ...(this.apiKey ? { 'X-Api-Key': this.apiKey } : {}),
      }, (c) => ({
        message: c,
        number: this.number,
        recipients: [conversationId],
      }));
    }
  }

  formatForChannel(text: string): string[] {
    return formatForChannel('web', text);
  }

  validateWebhook(input: WebhookValidationInput): boolean {
    if (!this.apiKey) return true;
    const key = String(input.headers['x-api-key'] ?? input.headers['authorization'] ?? '');
    return key === this.apiKey || key === `Bearer ${this.apiKey}`;
  }
}
