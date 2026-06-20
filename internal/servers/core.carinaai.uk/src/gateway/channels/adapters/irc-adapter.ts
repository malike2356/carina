import { config } from '../../../config/index.js';
import { getRouter } from '../../router.js';
import { formatForChannel } from '../channel-formatter.js';
import type { ChannelMessage, IChannelAdapter, SendOptions } from '../channel-adapter.interface.js';
import { parseGenericWebhook } from './rest-channel-helpers.js';
import { IrcClient, type IrcIncomingMessage } from './irc-client.js';
import { isIrcLiveEnabled } from '../../irc.js';

/** Webhook payload shape for sidecar or IRC_LIVE=false deployments. */
export const IRC_WEBHOOK_CONTRACT = {
  transport: 'webhook-inbound' as const,
  inboundWebhook: '/webhooks/irc',
  liveEnv: ['IRC_ENABLED=true', 'IRC_SERVER', 'IRC_NICK'],
  payloadFields: {
    text: 'message body',
    nick: 'sender nick (userId)',
    channel: 'channel or room (conversationId)',
    id: 'optional message id',
    thread_id: 'optional thread id (defaults to root)',
  },
};

export class IrcAdapter implements IChannelAdapter {
  readonly name = 'irc' as const;
  readonly contract = IRC_WEBHOOK_CONTRACT;

  private client: IrcClient | null = null;
  private connected = false;

  constructor(readonly enabled: boolean) {}

  isConnected(): boolean {
    return this.connected && Boolean(this.client?.connected);
  }

  parseInbound(raw: unknown): ChannelMessage | null {
    if (raw && typeof raw === 'object' && 'target' in (raw as Record<string, unknown>)) {
      return this.parseLiveMessage(raw as IrcIncomingMessage);
    }

    return parseGenericWebhook(raw, 'irc', (p) => ({
      text: String(p.text ?? p.message ?? ''),
      userId: String(p.user ?? p.nick ?? ''),
      conversationId: String(p.channel ?? p.room ?? ''),
      messageId: String(p.id ?? ''),
      isDirect: Boolean(p.is_direct ?? p.dm),
      threadId: String(p.thread_id ?? 'root'),
      senderName: String(p.nick ?? p.user ?? ''),
    }));
  }

  parseLiveMessage(message: IrcIncomingMessage): ChannelMessage | null {
    const nick = message.nick.trim();
    const text = message.text.trim();
    const target = message.target.trim();
    if (!nick || !text || !target) return null;
    if (nick.toLowerCase() === config.irc.nick.toLowerCase()) return null;

    const isDirect = !target.startsWith('#') && !target.startsWith('&');
    const conversationId = isDirect ? nick : target;
    const isMention = isIrcMention(text, config.irc.nick);
    const isCommand = /^\/(carina|chat)\b/i.test(text);

    if (!isDirect && config.irc.mentionOnly && !isMention && !isCommand) {
      return null;
    }

    if (config.irc.channels.length && !isDirect) {
      const allowed = config.irc.channels.map((c) => normalizeChannelName(c));
      if (!allowed.includes(normalizeChannelName(conversationId))) {
        return null;
      }
    }

    return {
      id: `${Date.now()}-${nick}`,
      channel: 'irc',
      externalUserId: nick,
      conversationId,
      text: cleanIrcText(text),
      timestamp: new Date(),
      isDirect,
      isMention,
      isCommand,
      threadId: conversationId,
      senderName: nick,
      raw: message,
    };
  }

  async sendMessage(conversationId: string, text: string, _options?: SendOptions): Promise<void> {
    if (!isIrcLiveEnabled()) {
      throw new Error(
        'IRC live outbound is disabled (IRC_LIVE=false). Use a sidecar for outbound delivery or set IRC_LIVE=true.',
      );
    }
    if (!this.client?.connected) {
      throw new Error('IRC client is not connected');
    }

    const target = conversationId.trim();
    for (const chunk of this.formatForChannel(text)) {
      this.client.say(target, chunk);
    }
  }

  formatForChannel(text: string): string[] {
    return formatForChannel('irc', text);
  }

  async start(): Promise<{ stop: () => void } | void> {
    if (!this.enabled || !isIrcLiveEnabled()) return;

    let running = true;

    const connectLoop = async (): Promise<void> => {
      while (running) {
        const client = new IrcClient({
          host: config.irc.server,
          port: config.irc.port,
          tls: config.irc.tls,
          nick: config.irc.nick,
          username: config.irc.username || config.irc.nick,
          realname: config.irc.realname,
          password: config.irc.password || undefined,
          channels: config.irc.channels,
          nickservIdentify: config.irc.nickservIdentify,
        });

        this.client = client;

        client.on('message', (message: IrcIncomingMessage) => {
          void this.handleLiveMessage(message);
        });

        client.on('registered', () => {
          this.connected = true;
        });

        client.on('close', () => {
          this.connected = false;
        });

        try {
          await client.connect();
          await new Promise<void>((resolve) => {
            client.once('close', () => resolve());
          });
        } catch {
          client.stop();
        }

        this.client = null;
        this.connected = false;
        if (running) {
          await sleep(5000);
        }
      }
    };

    void connectLoop();

    return {
      stop: () => {
        running = false;
        this.client?.stop();
        this.client = null;
        this.connected = false;
      },
    };
  }

  private async handleLiveMessage(message: IrcIncomingMessage): Promise<void> {
    const inbound = this.parseLiveMessage(message);
    if (!inbound) return;

    const gateway = getRouter();
    const chunks: string[] = [];
    for await (const chunk of gateway.handleInbound('irc', message)) {
      chunks.push(chunk);
    }
    const reply = chunks.join('');
    if (reply) {
      const replyTarget = inbound.isDirect ? inbound.externalUserId : inbound.conversationId;
      await this.sendMessage(replyTarget, reply);
    }
  }
}

function isIrcMention(text: string, nick: string): boolean {
  const pattern = new RegExp(`@${nick}\\b|${nick}\\b`, 'i');
  return pattern.test(text);
}

function cleanIrcText(text: string): string {
  return text
    .replace(new RegExp(`@${config.irc.nick}\\b`, 'ig'), '')
    .replace(new RegExp(`\\b${config.irc.nick}\\b`, 'ig'), '')
    .replace(/^\/(carina|chat)\s*/i, '')
    .trim();
}

function normalizeChannelName(channel: string): string {
  const trimmed = channel.trim().toLowerCase();
  return trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
