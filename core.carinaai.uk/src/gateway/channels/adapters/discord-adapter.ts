import { config } from '../../../config/index.js';
import { getRouter } from '../../router.js';
import { formatForChannel } from '../channel-formatter.js';
import type {
  ChannelMessage,
  IChannelAdapter,
  SendOptions,
  WebhookValidationInput,
} from '../channel-adapter.interface.js';

type DiscordClient = {
  login?: (token: string) => Promise<string>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  channels?: { fetch: (id: string) => Promise<unknown> };
  application?: { commands?: { set: (commands: unknown[]) => Promise<unknown> } };
};

const SLASH_COMMANDS = [
  { name: 'chat', description: 'Ask Carina a question' },
  { name: 'summary', description: 'Ask Carina for a summary' },
  { name: 'briefing', description: 'Ask Carina for a briefing' },
  { name: 'help', description: 'Show Carina commands' },
];

export class DiscordAdapter implements IChannelAdapter {
  readonly name = 'discord' as const;

  constructor(
    readonly enabled: boolean,
    private client?: DiscordClient,
  ) {}

  parseInbound(raw: unknown): ChannelMessage | null {
    const payload = raw as Record<string, unknown>;
    const isInteraction = typeof payload.commandName === 'string';
    const text = isInteraction
      ? slashCommandText(payload)
      : String(payload.content ?? '').trim();
    const channelId = String(payload.channelId ?? payload.channel_id ?? '');
    const author = (payload.author ?? payload.user ?? {}) as Record<string, unknown>;
    const userId = String(author.id ?? payload.userId ?? '');
    if (author.bot === true) return null;
    if (!text || !channelId || !userId) return null;

    const isDirect = !payload.guildId && !payload.guild_id;
    const isMention = isDiscordMention(text, String(config.discord.applicationId ?? ''));
    const isCommand = isInteraction || text.startsWith('/carina') || text.startsWith('/chat');
    if (!shouldRespond(isDirect, isMention, isCommand, channelId, config.discord.allowedChannelIds)) {
      return null;
    }

    return {
      id: String(payload.id ?? Date.now()),
      channel: 'discord',
      externalUserId: userId,
      conversationId: channelId,
      guildId: String(payload.guildId ?? payload.guild_id ?? '') || undefined,
      text: cleanDiscordText(text),
      timestamp: payload.createdTimestamp
        ? new Date(Number(payload.createdTimestamp))
        : new Date(),
      isDirect,
      isMention,
      isCommand,
      threadId: String(payload.threadId ?? payload.channelId ?? channelId),
      raw,
    };
  }

  async sendMessage(conversationId: string, text: string, options: SendOptions = {}): Promise<void> {
    if (!this.client?.channels) return;
    const channel = await this.client.channels.fetch(conversationId) as {
      send?: (payload: string | Record<string, unknown>) => Promise<unknown>;
    } | null;
    if (!channel?.send) return;
    for (const chunk of this.formatForChannel(text)) {
      await channel.send(options.embeds ? { content: chunk, embeds: options.embeds } : chunk);
    }
  }

  formatForChannel(text: string): string[] {
    return formatForChannel('discord', text);
  }

  validateWebhook(input: WebhookValidationInput): boolean {
    return Boolean(
      headerValue(input.headers['x-signature-ed25519']) &&
      headerValue(input.headers['x-signature-timestamp']) &&
      config.discord.publicKey,
    );
  }

  async start(): Promise<void> {
    if (!this.enabled || this.client) return;
    const discord = await import('discord.js');
    const client = new discord.Client({
      intents: [
        discord.GatewayIntentBits.Guilds,
        discord.GatewayIntentBits.GuildMessages,
        discord.GatewayIntentBits.DirectMessages,
        discord.GatewayIntentBits.MessageContent,
      ],
    }) as DiscordClient;
    client.on?.('ready', () => {
      void client.application?.commands?.set(SLASH_COMMANDS);
    });
    client.on?.('messageCreate', (message) => {
      void this.respondToInbound(message);
    });
    client.on?.('interactionCreate', (interaction) => {
      void this.respondToInteraction(interaction);
    });
    this.client = client;
    await client.login?.(config.discord.botToken);
  }

  private async respondToInbound(raw: unknown): Promise<void> {
    const inbound = this.parseInbound(raw);
    if (!inbound) return;
    const reply = await collectResponse(getRouter().handleInbound('discord', raw));
    await this.sendMessage(inbound.conversationId, reply || '(no response)', {
      threadId: inbound.threadId,
    });
  }

  private async respondToInteraction(raw: unknown): Promise<void> {
    const interaction = raw as {
      isChatInputCommand?: () => boolean;
      deferReply?: () => Promise<void>;
      editReply?: (text: string) => Promise<unknown>;
    };
    if (!interaction.isChatInputCommand?.()) return;
    const inbound = this.parseInbound(raw);
    if (!inbound) return;
    await interaction.deferReply?.();
    const reply = await collectResponse(getRouter().handleInbound('discord', raw));
    const chunks = this.formatForChannel(reply || '(no response)');
    await interaction.editReply?.(chunks[0] ?? '(no response)');
    for (const chunk of chunks.slice(1)) {
      await this.sendMessage(inbound.conversationId, chunk);
    }
  }
}

function slashCommandText(payload: Record<string, unknown>): string {
  const command = String(payload.commandName ?? '');
  const options = payload.options as { getString?: (name: string) => string | null } | undefined;
  const text = options?.getString?.('message') ?? options?.getString?.('text') ?? '';
  return `/carina ${command}${text ? ` ${text}` : ''}`.trim();
}

function isDiscordMention(text: string, applicationId: string): boolean {
  return /@carina\b/i.test(text) || (applicationId ? text.includes(`<@${applicationId}>`) : false);
}

function shouldRespond(
  isDirect: boolean,
  isMention: boolean,
  isCommand: boolean,
  channelId: string,
  allowedChannelIds: string[],
): boolean {
  return isDirect || isMention || isCommand || allowedChannelIds.includes(channelId);
}

function cleanDiscordText(text: string): string {
  return text
    .replace(/<@!?\d+>/g, '')
    .replace(/^\/carina\s*/i, '')
    .trim();
}

function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

async function collectResponse(generator: AsyncGenerator<string>): Promise<string> {
  let full = '';
  for await (const chunk of generator) {
    full += chunk;
  }
  return full;
}
