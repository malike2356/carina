import type {
  IChannelAdapter,
  SendOptions,
  WebhookValidationInput,
} from '../channel-adapter.interface.js';
import { formatForChannel } from '../channel-formatter.js';
import { verifyHmacSha256Base64 } from './webhook-signature.js';

type LineEvent = Record<string, unknown>;

export class LineAdapter implements IChannelAdapter {
  readonly name = 'line' as const;

  private readonly pendingReplyTokens = new Map<string, string>();

  constructor(
    readonly enabled: boolean,
    private readonly channelSecret = process.env.LINE_CHANNEL_SECRET ?? '',
    private readonly accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN ?? '',
  ) {}

  parseInbound(raw: unknown) {
    const payload = raw as Record<string, unknown>;
    const events = Array.isArray(payload.events) ? payload.events as LineEvent[] : [];

    for (const event of events) {
      if (event.type !== 'message') continue;
      const message = event.message as Record<string, unknown> | undefined;
      if (!message || message.type !== 'text') continue;

      const source = event.source as Record<string, unknown> | undefined;
      const userId = String(source?.userId ?? '');
      const replyToken = String(event.replyToken ?? '');
      const text = String(message.text ?? '').trim();
      if (!userId || !text) continue;

      if (replyToken) {
        this.pendingReplyTokens.set(userId, replyToken);
      }

      return {
        id: String(message.id ?? Date.now()),
        channel: 'line' as const,
        externalUserId: userId,
        conversationId: userId,
        text,
        timestamp: new Date(),
        isDirect: true,
        isMention: true,
        isCommand: text.startsWith('/'),
        replyTo: replyToken || undefined,
        raw: event,
      };
    }

    return null;
  }

  async sendMessage(conversationId: string, text: string, _options?: SendOptions): Promise<void> {
    if (!this.accessToken) return;

    const replyToken = this.pendingReplyTokens.get(conversationId);
    const chunks = formatForChannel('line', text);

    for (const chunk of chunks) {
      if (replyToken) {
        await this.postLine('https://api.line.me/v2/bot/message/reply', {
          replyToken,
          messages: [{ type: 'text', text: chunk }],
        });
        this.pendingReplyTokens.delete(conversationId);
      } else {
        await this.postLine('https://api.line.me/v2/bot/message/push', {
          to: conversationId,
          messages: [{ type: 'text', text: chunk }],
        });
      }
    }
  }

  formatForChannel(text: string): string[] {
    return formatForChannel('line', text);
  }

  validateWebhook(input: WebhookValidationInput): boolean {
    if (!this.channelSecret) return false;
    const signature = String(input.headers['x-line-signature'] ?? '');
    const body = typeof input.rawBody === 'string'
      ? input.rawBody
      : JSON.stringify(input.body ?? {});
    return verifyHmacSha256Base64(body, this.channelSecret, signature);
  }

  private async postLine(url: string, body: Record<string, unknown>): Promise<void> {
    await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
  }
}
