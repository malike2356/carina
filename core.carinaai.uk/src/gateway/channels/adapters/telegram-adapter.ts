import type TelegramBot from 'node-telegram-bot-api';
import { wasMentioned } from '../../group-chat.js';
import { formatForPlatform } from '../../formatting.js';
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
    private readonly botUsername = 'carina',
  ) {}

  parseInbound(raw: unknown): ChannelMessage | null {
    const msg = raw as Partial<TelegramRawMessage>;
    if (!msg.text || !msg.from || !msg.chat || typeof msg.message_id !== 'number') {
      return null;
    }

    const text = msg.text.trim();
    const chatType = msg.chat.type === 'private' ? 'private' : 'group';
    const firstName = msg.from.first_name ?? '';
    const lastName = msg.from.last_name ?? '';
    return {
      id: String(msg.message_id),
      channel: 'telegram',
      externalUserId: String(msg.from.id),
      conversationId: String(msg.chat.id),
      text,
      timestamp: new Date((msg.date ?? Math.floor(Date.now() / 1000)) * 1000),
      isDirect: chatType === 'private',
      isMention: wasMentioned(msg as TelegramRawMessage, this.botUsername),
      isCommand: text.startsWith('/'),
      chatType,
      chatTitle: 'title' in msg.chat ? msg.chat.title : undefined,
      senderName: [firstName, lastName].filter(Boolean).join(' ') || msg.from.username,
      replyTo: msg.reply_to_message?.message_id !== undefined
        ? String(msg.reply_to_message.message_id)
        : undefined,
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
    const formatted = formatForPlatform(text, 'telegram');
    return Array.isArray(formatted) ? formatted : [formatted];
  }

  validateWebhook(): boolean {
    return this.enabled;
  }
}
