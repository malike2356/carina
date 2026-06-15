import type {
  IChannelAdapter,
  SendOptions,
  WebhookValidationInput,
} from '../channel-adapter.interface.js';
import { formatForChannel } from '../channel-formatter.js';
import { verifyHmacSha256Base64 } from './webhook-signature.js';

export class ViberAdapter implements IChannelAdapter {
  readonly name = 'viber' as const;

  constructor(
    readonly enabled: boolean,
    private readonly authToken = process.env.VIBER_AUTH_TOKEN ?? '',
  ) {}

  parseInbound(raw: unknown) {
    const payload = raw as Record<string, unknown>;
    if (payload.event !== 'message') return null;

    const message = payload.message as Record<string, unknown> | undefined;
    if (!message || message.type !== 'text') return null;

    const sender = payload.sender as Record<string, unknown> | undefined;
    const userId = String(sender?.id ?? '');
    const text = String(message.text ?? '').trim();
    if (!userId || !text) return null;

    return {
      id: String(message.token ?? payload.timestamp ?? Date.now()),
      channel: 'viber' as const,
      externalUserId: userId,
      conversationId: userId,
      text,
      timestamp: new Date(),
      isDirect: true,
      isMention: true,
      isCommand: text.startsWith('/'),
      senderName: String(sender?.name ?? ''),
      raw: payload,
    };
  }

  async sendMessage(conversationId: string, text: string, _options?: SendOptions): Promise<void> {
    if (!this.authToken) return;

    for (const chunk of formatForChannel('viber', text)) {
      await fetch('https://chatapi.viber.com/pa/send_message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Viber-Auth-Token': this.authToken,
        },
        body: JSON.stringify({
          receiver: conversationId,
          type: 'text',
          text: chunk,
        }),
        signal: AbortSignal.timeout(15_000),
      });
    }
  }

  formatForChannel(text: string): string[] {
    return formatForChannel('viber', text);
  }

  validateWebhook(input: WebhookValidationInput): boolean {
    if (!this.authToken) return false;
    const signature = String(input.headers['x-viber-content-signature'] ?? '');
    const body = typeof input.rawBody === 'string'
      ? input.rawBody
      : JSON.stringify(input.body ?? {});
    return verifyHmacSha256Base64(body, this.authToken, signature);
  }
}
