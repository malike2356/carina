import type { IChannelAdapter, SendOptions } from '../channel-adapter.interface.js';
import { parseGenericWebhook } from './rest-channel-helpers.js';
import { formatForChannel } from '../channel-formatter.js';

const pendingReplies = new Map<string, string[]>();

export class ApiServerAdapter implements IChannelAdapter {
  readonly name = 'api' as const;

  constructor(
    readonly enabled: boolean,
    private readonly apiKey = process.env.API_CHANNEL_API_KEY ?? process.env.CARINA_API_KEY ?? '',
  ) {}

  parseInbound(raw: unknown) {
    return parseGenericWebhook(raw, 'api', (p) => ({
      text: String(p.message ?? p.text ?? p.content ?? ''),
      userId: String(p.user_id ?? p.userId ?? p.from ?? 'api-client'),
      conversationId: String(p.conversation_id ?? p.conversationId ?? p.user_id ?? p.userId ?? 'api-default'),
      messageId: String(p.message_id ?? p.id ?? ''),
      isDirect: true,
    }));
  }

  async sendMessage(conversationId: string, text: string, _options?: SendOptions): Promise<void> {
    const chunks = formatForChannel('web', text);
    const existing = pendingReplies.get(conversationId) ?? [];
    pendingReplies.set(conversationId, [...existing, ...chunks]);
  }

  /** Drain reply queued for a sync HTTP response. */
  drainReply(conversationId: string): string {
    const chunks = pendingReplies.get(conversationId) ?? [];
    pendingReplies.delete(conversationId);
    return chunks.join('');
  }

  formatForChannel(text: string): string[] {
    return formatForChannel('web', text);
  }

  validateApiKey(headers: Record<string, string | string[] | undefined>): boolean {
    if (!this.apiKey) return true;
    const auth = headerValue(headers.authorization);
    const apiHeader = headerValue(headers['x-api-key']);
    return auth === `Bearer ${this.apiKey}` || apiHeader === this.apiKey;
  }
}

function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
