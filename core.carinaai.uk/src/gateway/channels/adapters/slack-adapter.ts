import crypto from 'crypto';
import { config } from '../../../config/index.js';
import { getRouter } from '../../router.js';
import { formatForChannel } from '../channel-formatter.js';
import { shouldAcceptGroupInbound } from '../channel-group-policy.js';
import type {
  ChannelMessage,
  IChannelAdapter,
  SendOptions,
  WebhookValidationInput,
} from '../channel-adapter.interface.js';

type SlackApp = {
  start?: (port?: number) => Promise<void>;
  client?: {
    chat?: {
      postMessage: (payload: Record<string, unknown>) => Promise<unknown>;
    };
  };
};

export class SlackAdapter implements IChannelAdapter {
  readonly name = 'slack' as const;

  constructor(
    readonly enabled: boolean,
    private app?: SlackApp,
  ) {}

  parseInbound(raw: unknown): ChannelMessage | null {
    const payload = raw as Record<string, unknown>;
    const event = (payload.event ?? payload) as Record<string, unknown>;
    const text = String(event.text ?? payload.text ?? '').trim();
    const channel = String(event.channel ?? payload.channel_id ?? payload.channel ?? '');
    const user = String(event.user ?? payload.user_id ?? payload.user ?? '');
    if (!text || !channel || !user || event.bot_id) return null;

    const channelType = String(event.channel_type ?? '');
    const isDirect = channelType === 'im' || channel.startsWith('D');
    const isMention = /^<@[^>]+>/.test(text) || /@carina\b/i.test(text);
    const isCommand = String(payload.command ?? '').startsWith('/carina') || text.startsWith('/carina');

    const message: ChannelMessage = {
      id: String(event.client_msg_id ?? event.ts ?? payload.trigger_id ?? Date.now()),
      channel: 'slack',
      externalUserId: user,
      conversationId: channel,
      teamId: String(payload.team_id ?? event.team ?? '') || undefined,
      text: cleanSlackText(text),
      timestamp: event.ts ? new Date(Number(event.ts) * 1000) : new Date(),
      isDirect,
      isMention,
      isCommand,
      threadId: String(event.thread_ts ?? event.ts ?? ''),
      raw,
    };

    if (!shouldAcceptGroupInbound(message).accept) {
      return null;
    }

    return message;
  }

  async sendMessage(conversationId: string, text: string, options: SendOptions = {}): Promise<void> {
    if (!this.app?.client?.chat?.postMessage) return;
    for (const chunk of this.formatForChannel(text)) {
      await this.app.client.chat.postMessage({
        channel: conversationId,
        text: chunk,
        thread_ts: options.threadId,
        ...(options.blocks ? { blocks: options.blocks } : {}),
      });
    }
  }

  formatForChannel(text: string): string[] {
    return formatForChannel('slack', text);
  }

  validateWebhook(input: WebhookValidationInput): boolean {
    if (!config.slack.signingSecret || !input.rawBody) return false;
    const timestamp = headerValue(input.headers['x-slack-request-timestamp']);
    const signature = headerValue(input.headers['x-slack-signature']);
    if (!timestamp || !signature) return false;

    const base = `v0:${timestamp}:${Buffer.isBuffer(input.rawBody) ? input.rawBody.toString('utf8') : input.rawBody}`;
    const expected = 'v0=' + crypto
      .createHmac('sha256', config.slack.signingSecret)
      .update(base)
      .digest('hex');
    const expectedBuffer = Buffer.from(expected);
    const signatureBuffer = Buffer.from(signature);
    return expectedBuffer.length === signatureBuffer.length &&
      crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
  }

  async start(): Promise<void> {
    if (!this.enabled || this.app) return;
    const slack = await import('@slack/bolt');
    const app = new slack.App({
      token: config.slack.botToken,
      signingSecret: config.slack.signingSecret,
      socketMode: config.slack.socketMode,
      appToken: config.slack.appToken || undefined,
    }) as unknown as SlackApp;
    const boltApp = app as SlackApp & {
      message?: (handler: (args: Record<string, unknown>) => Promise<void>) => void;
      command?: (name: string, handler: (args: Record<string, unknown>) => Promise<void>) => void;
    };
    boltApp.message?.(async ({ message, say }) => {
      const inbound = this.parseInbound({ event: message });
      if (!inbound) return;
      const reply = await collectResponse(getRouter().handleInbound('slack', { event: message }));
      await (say as (payload: Record<string, unknown>) => Promise<unknown>)({
        text: reply || '(no response)',
        thread_ts: inbound.threadId || undefined,
      });
    });
    boltApp.command?.('/carina', async ({ command, ack, respond }) => {
      await (ack as () => Promise<void>)();
      const inbound = this.parseInbound(command);
      if (!inbound) return;
      const reply = await collectResponse(getRouter().handleInbound('slack', command));
      await (respond as (payload: Record<string, unknown>) => Promise<unknown>)({
        text: reply || '(no response)',
        response_type: 'in_channel',
        thread_ts: inbound.threadId || undefined,
      });
    });
    this.app = app;
    await app.start?.(config.slack.port);
  }
}

export function buildBriefingBlocks(text: string): unknown[] {
  return [
    { type: 'section', text: { type: 'mrkdwn', text } },
  ];
}

function cleanSlackText(text: string): string {
  return text
    .replace(/^<@[^>]+>\s*/, '')
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
