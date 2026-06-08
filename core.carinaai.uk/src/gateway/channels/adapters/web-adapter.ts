import { formatForChannel } from '../channel-formatter.js';
import type {
  ChannelMessage,
  IChannelAdapter,
  SendOptions,
} from '../channel-adapter.interface.js';

export class WebAdapter implements IChannelAdapter {
  readonly name = 'web' as const;

  constructor(readonly enabled: boolean) {}

  parseInbound(raw: unknown): ChannelMessage | null {
    const payload = raw as Record<string, unknown>;
    const text = String(payload.message ?? payload.text ?? '').trim();
    const externalUserId = String(payload.sessionId ?? payload.userId ?? 'anonymous');
    if (!text) return null;
    return {
      id: String(payload.id ?? Date.now()),
      channel: 'web',
      externalUserId,
      conversationId: externalUserId,
      text,
      timestamp: new Date(),
      isDirect: true,
      isMention: false,
      isCommand: text.startsWith('/'),
      raw,
    };
  }

  async sendMessage(_conversationId: string, _text: string, _options: SendOptions = {}): Promise<void> {
    return;
  }

  formatForChannel(text: string): string[] {
    return formatForChannel('web', text);
  }

  validateWebhook(): boolean {
    return true;
  }
}
