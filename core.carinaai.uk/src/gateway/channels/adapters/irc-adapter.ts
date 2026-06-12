import type { ChannelMessage, IChannelAdapter, SendOptions } from '../channel-adapter.interface.js';
import { parseGenericWebhook } from './rest-channel-helpers.js';

/**
 * IRC integration stub. Carina does not ship a live IRC client in core.
 * Enable with IRC_ENABLED=true for sidecar bots posting to POST /webhooks/irc.
 */
export class IrcAdapter implements IChannelAdapter {
  readonly name = 'irc' as const;

  constructor(readonly enabled: boolean) {}

  parseInbound(raw: unknown): ChannelMessage | null {
    return parseGenericWebhook(raw, 'irc', (p) => ({
      text: String(p.text ?? p.message ?? ''),
      userId: String(p.user ?? p.nick ?? ''),
      conversationId: String(p.channel ?? p.room ?? ''),
      messageId: String(p.id ?? ''),
      isDirect: false,
      threadId: String(p.thread_id ?? 'root'),
      senderName: String(p.nick ?? p.user ?? ''),
    }));
  }

  async sendMessage(_conversationId: string, _text: string, _options?: SendOptions): Promise<void> {
    throw new Error('IRC adapter is a stub; configure a sidecar to consume outbound hooks or extend this adapter');
  }

  formatForChannel(text: string): string[] {
    return [text];
  }
}
