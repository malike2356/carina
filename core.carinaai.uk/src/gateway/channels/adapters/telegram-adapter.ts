import type TelegramBot from 'node-telegram-bot-api';
import { formatForChannel } from '../channel-formatter.js';
import type {
  ChannelMessage,
  IChannelAdapter,
  SendOptions,
} from '../channel-adapter.interface.js';

type TelegramRawMessage = TelegramBot.Message;

export class TelegramAdapter implements IChannelAdapter {
  readonly name = 'telegram' as const;

  constructor(
    readonly enabled: boolean,
    private readonly bot?: Pick<TelegramBot, 'sendMessage'>,
  ) {}

  parseInbound(raw: unknown): ChannelMessage | null {
    const msg = raw as Partial<TelegramRawMessage>;
    if (!msg.text || !msg.from || !msg.chat || typeof msg.message_id !== 'number') {
      return null;
    }

    const text = msg.text.trim();
    return {
      id: String(msg.message_id),
      channel: 'telegram',
      externalUserId: String(msg.from.id),
      conversationId: String(msg.chat.id),
      text,
      timestamp: new Date((msg.date ?? Math.floor(Date.now() / 1000)) * 1000),
      isDirect: msg.chat.type === 'private',
      isMention: /@carina\b/i.test(text),
      isCommand: text.startsWith('/'),
      raw,
    };
  }

  async sendMessage(conversationId: string, text: string, _options: SendOptions = {}): Promise<void> {
    if (!this.bot) return;
    for (const chunk of this.formatForChannel(text)) {
      await this.bot.sendMessage(Number(conversationId), chunk);
    }
  }

  formatForChannel(text: string): string[] {
    return formatForChannel('telegram', text);
  }

  validateWebhook(): boolean {
    return this.enabled;
  }
}
