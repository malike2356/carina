import type TelegramBot from 'node-telegram-bot-api';
import type { Message as TelegramMessage } from 'node-telegram-bot-api';

type TelegramSendOptions = NonNullable<Parameters<TelegramBot['sendMessage']>[2]>;
import { wasMentioned } from '../../group-chat.js';
import { formatForChannel } from '../channel-formatter.js';
import {
  chunkTelegramOutbound,
  markdownToTelegramReadable,
} from '../../telegram-format.js';
import type {
  ChannelMessage,
  IChannelAdapter,
  SendOptions,
} from '../channel-adapter.interface.js';

type TelegramRawMessage = TelegramMessage;

export type TelegramForumContext = {
  chatId: string;
  topicId: string;
  topicName?: string;
};

export function topicId(msg: Partial<TelegramRawMessage>): string | undefined {
  if (msg.chat?.is_forum !== true || msg.message_thread_id === undefined) {
    return undefined;
  }
  return String(msg.message_thread_id);
}

function extractForumTopicName(msg: Partial<TelegramRawMessage>): string | undefined {
  const created = (msg as { forum_topic_created?: { name?: string } }).forum_topic_created
    ?? msg.reply_to_message?.forum_topic_created;
  return created?.name ? String(created.name) : undefined;
}

export function parseTelegramForumContext(raw: unknown): TelegramForumContext | null {
  const msg = raw as Partial<TelegramRawMessage>;
  const thread = topicId(msg);
  if (!msg.chat || !thread) return null;

  return {
    chatId: String(msg.chat.id),
    topicId: thread,
    topicName: extractForumTopicName(msg),
  };
}

function isTelegramForumMention(msg: Partial<TelegramRawMessage>, botUsername: string): boolean {
  const username = botUsername.replace(/^@/, '').toLowerCase();
  const text = msg.text ?? '';

  for (const entity of msg.entities ?? []) {
    if (entity.type !== 'mention') continue;
    const mention = text
      .slice(entity.offset, entity.offset + entity.length)
      .replace(/^@/, '')
      .toLowerCase();
    if (mention === username) return true;
  }

  return false;
}

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
    const privateChat = msg.chat.type === 'private';
    const baseChatType = privateChat ? 'private' : 'group';
    const isForumTopic = msg.chat.is_forum === true && msg.message_thread_id !== undefined;
    const chatType = isForumTopic ? 'group' : baseChatType;
    const firstName = msg.from.first_name ?? '';
    const lastName = msg.from.last_name ?? '';
    const forumThreadId = topicId(msg);

    return {
      id: String(msg.message_id),
      channel: 'telegram',
      externalUserId: String(msg.from.id),
      conversationId: String(msg.chat.id),
      text,
      timestamp: new Date((msg.date ?? Math.floor(Date.now() / 1000)) * 1000),
      isDirect: privateChat,
      isMention: isForumTopic
        ? isTelegramForumMention(msg, this.botUsername)
        : wasMentioned(msg as TelegramRawMessage, this.botUsername),
      isCommand: text.startsWith('/'),
      chatType,
      chatTitle: 'title' in msg.chat ? msg.chat.title : undefined,
      senderName: [firstName, lastName].filter(Boolean).join(' ') || msg.from.username,
      threadId: forumThreadId,
      replyTo: msg.reply_to_message?.message_id !== undefined
        ? String(msg.reply_to_message.message_id)
        : undefined,
      raw,
    };
  }

  async sendMessage(conversationId: string, text: string, options: SendOptions = {}): Promise<void> {
    if (!this.bot) return;
    const sendOptions: TelegramSendOptions = {
      link_preview_options: { is_disabled: true },
    };
    if (options.threadId) {
      sendOptions.message_thread_id = Number(options.threadId);
    }
    if (options.replyMarkup) {
      sendOptions.reply_markup = options.replyMarkup as TelegramSendOptions['reply_markup'];
    }

    const chunks = chunkTelegramOutbound(text);
    for (const chunk of chunks) {
      try {
        await this.bot.sendMessage(Number(conversationId), chunk.text || ' ', {
          ...sendOptions,
          parse_mode: chunk.parseMode,
        });
      } catch {
        await this.bot.sendMessage(
          Number(conversationId),
          (chunk.plain ?? markdownToTelegramReadable(text)) || ' ',
          sendOptions,
        );
      }
    }
  }

  formatForChannel(text: string): string[] {
    return formatForChannel('telegram', text);
  }

  validateWebhook(): boolean {
    return this.enabled;
  }
}
