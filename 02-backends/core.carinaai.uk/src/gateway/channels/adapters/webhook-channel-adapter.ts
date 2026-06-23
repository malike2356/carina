import type { IChannelAdapter, SendOptions, WebhookValidationInput } from '../channel-adapter.interface.js';
import { parseGenericWebhook } from './rest-channel-helpers.js';
import { formatForChannel } from '../channel-formatter.js';

const callbackUrls = new Map<string, string>();

export class WebhookChannelAdapter implements IChannelAdapter {
  readonly name = 'webhooks' as const;

  constructor(
    readonly enabled: boolean,
    private readonly secret = process.env.WEBHOOK_CHANNEL_SECRET ?? '',
  ) {}

  parseInbound(raw: unknown) {
    const payload = raw as Record<string, unknown>;
    const parsed = parseGenericWebhook(raw, 'webhooks', (p) => ({
      text: String(p.message ?? p.text ?? p.content ?? ''),
      userId: String(p.user_id ?? p.userId ?? p.from ?? 'webhook'),
      conversationId: String(p.conversation_id ?? p.conversationId ?? p.user_id ?? 'webhook-default'),
      messageId: String(p.message_id ?? p.id ?? ''),
      isDirect: true,
    }));
    if (!parsed) return null;

    const callback = String(
      payload.callback_url ?? payload.reply_url ?? payload.webhook_url ?? '',
    ).trim();
    if (callback) {
      callbackUrls.set(parsed.conversationId, callback);
    }
    return parsed;
  }

  async sendMessage(conversationId: string, text: string, _options?: SendOptions): Promise<void> {
    const callback = callbackUrls.get(conversationId) ?? process.env.WEBHOOK_CHANNEL_DEFAULT_CALLBACK_URL;
    if (!callback) return;

    for (const chunk of formatForChannel('web', text)) {
      await fetch(callback, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.secret ? { 'X-Webhook-Secret': this.secret } : {}),
        },
        body: JSON.stringify({
          conversation_id: conversationId,
          message: chunk,
          text: chunk,
          source: 'carina',
        }),
        signal: AbortSignal.timeout(15_000),
      });
    }
  }

  formatForChannel(text: string): string[] {
    return formatForChannel('web', text);
  }

  validateWebhook(input: WebhookValidationInput): boolean {
    if (!this.secret) return true;
    const sig = String(input.headers['x-webhook-secret'] ?? input.headers['x-carina-webhook-secret'] ?? '');
    return sig === this.secret;
  }

  setCallback(conversationId: string, url: string): void {
    callbackUrls.set(conversationId, url);
  }
}
