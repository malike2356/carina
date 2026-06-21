import { config } from '../../../config/index.js';
import { getRouter } from '../../router.js';
import { splitByLength } from '../channel-formatter.js';
import type {
  ChannelMessage,
  IChannelAdapter,
  SendOptions,
} from '../channel-adapter.interface.js';

const MAX_MESSAGE_LENGTH = 10_000;

export type KeybaseBotClient = {
  init: (username: string, paperkey: string) => Promise<void>;
  deinit: () => Promise<void>;
  chat: {
    send: (channel: string, payload: { body: string }) => Promise<unknown>;
    watchAllChannelsForNewMessages: (
      onMessage: (message: unknown) => void,
      onError: (error: Error) => void,
    ) => void;
  };
};

export type KeybaseBotFactory = () => Promise<KeybaseBotClient>;

async function defaultKeybaseBotFactory(): Promise<KeybaseBotClient> {
  const module = await import('keybase-bot');
  const Bot = module.default as new () => KeybaseBotClient;
  return new Bot();
}

export function parseKeybaseInbound(raw: unknown): ChannelMessage | null {
  const message = raw as Record<string, unknown>;
  const content = message.content as Record<string, unknown> | undefined;
  if (!content || content.type !== 'text') return null;

  const textPayload = content.text as Record<string, unknown> | undefined;
  const text = String(textPayload?.body ?? '').trim();
  const sender = message.sender as Record<string, unknown> | undefined;
  const channel = message.channel as Record<string, unknown> | undefined;
  const username = String(sender?.username ?? '');
  if (!username || !text) return null;

  const channelName = String(channel?.name ?? '');
  const topicName = String(channel?.topicName ?? 'general');
  const isDirect = channel?.membersType === 'impteamnative';
  const conversationId = isDirect ? username : `${channelName}#${topicName}`;

  return {
    id: String(message.id ?? Date.now()),
    channel: 'keybase',
    externalUserId: username,
    conversationId,
    text,
    timestamp: new Date(),
    isDirect,
    isMention: /@carina\b/i.test(text),
    isCommand: text.startsWith('!'),
    senderName: username,
    raw,
  };
}

export class KeybaseAdapter implements IChannelAdapter {
  readonly name = 'keybase' as const;

  private bot: KeybaseBotClient | null = null;

  constructor(
    readonly enabled: boolean,
    private readonly username = config.keybase.username,
    private readonly paperkey = config.keybase.paperkey,
    private readonly botFactory: KeybaseBotFactory = defaultKeybaseBotFactory,
  ) {}

  parseInbound(raw: unknown): ChannelMessage | null {
    return parseKeybaseInbound(raw);
  }

  async sendMessage(conversationId: string, text: string, _options?: SendOptions): Promise<void> {
    if (!this.bot) return;

    for (const chunk of this.formatForChannel(text)) {
      await this.bot.chat.send(conversationId, { body: chunk });
    }
  }

  formatForChannel(text: string): string[] {
    return splitByLength(text, MAX_MESSAGE_LENGTH);
  }

  async start(): Promise<{ stop: () => void } | void> {
    if (!this.enabled || !this.checkConfigured() || this.bot) return;

    const bot = await this.botFactory();
    await bot.init(this.username, this.paperkey);
    this.bot = bot;

    bot.chat.watchAllChannelsForNewMessages(async (raw) => {
      const inbound = this.parseInbound(raw);
      if (!inbound) return;

      const gateway = getRouter();
      const chunks: string[] = [];
      for await (const chunk of gateway.handleInbound('keybase', raw)) {
        chunks.push(chunk);
      }

      const reply = chunks.join('');
      if (reply) {
        await this.sendMessage(inbound.conversationId, reply, { threadId: inbound.threadId });
      }
    }, (error) => {
      console.error('[keybase] watch error:', error.message);
    });

    return {
      stop: () => {
        void this.bot?.deinit();
        this.bot = null;
      },
    };
  }

  checkConfigured(): boolean {
    return Boolean(this.username?.trim() && this.paperkey?.trim());
  }
}
