import crypto from 'crypto';
import { config } from '../../../config/index.js';
import { getRouter } from '../../router.js';
import { formatForChannel } from '../channel-formatter.js';
import { shouldAcceptGroupInbound } from '../channel-group-policy.js';
import {
  getChannelIngestionService,
  isSlackAmbientEnabled,
  isChannelAllowedForPassiveReading,
  type AmbientChannelMessage,
} from '../../../agents/ambient/index.js';
import { getAmbientChannelSettings } from '../../../agents/ambient/ambient-channel-settings.js';
import {
  handleAmbientSlashCommand,
  handleCarinaChannelConfigCommand,
} from '../../../agents/ambient/ambient-slack-commands.js';
import { fetchSlackThreadContext } from '../../../agents/ambient/slack-thread-context.js';
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
    reactions?: {
      add: (payload: Record<string, unknown>) => Promise<unknown>;
    };
    conversations?: {
      replies: (payload: { channel: string; ts: string; limit?: number }) => Promise<{
        messages?: Array<{ user?: string; text?: string; ts?: string }>;
      }>;
    };
  };
};

type SlackEventRecord = Record<string, unknown>;

export class SlackAdapter implements IChannelAdapter {
  readonly name = 'slack' as const;
  private botUserId?: string;

  constructor(
    readonly enabled: boolean,
    private app?: SlackApp,
  ) {}

  parseInbound(raw: unknown): ChannelMessage | null {
    return this.parseSlackEvent(raw, 'respond');
  }

  async parsePassiveInbound(raw: unknown): Promise<AmbientChannelMessage | null> {
    const payload = raw as Record<string, unknown>;
    const event = (payload.event ?? payload) as SlackEventRecord;
    if (event.subtype === 'bot_message' || event.bot_id) return null;

    const text = String(event.text ?? '').trim();
    const channelId = String(event.channel ?? '');
    const userId = String(event.user ?? '');
    if (!text || !channelId || !userId) return null;

    const channelType = String(event.channel_type ?? '');
    const isDirect = channelType === 'im' || channelId.startsWith('D');
    const isMention = this.isBotMention(text);
    if (isDirect || isMention) return null;

    const channelName = String(event.channel_name ?? channelId);
    if (!(await isChannelAllowedForPassiveReading(channelId, channelName))) return null;

    return {
      channelId,
      channelName,
      userId,
      userName: String(event.username ?? userId),
      text: cleanSlackText(text),
      timestamp: event.ts
        ? new Date(Number(event.ts) * 1000).toISOString()
        : new Date().toISOString(),
      threadTs: event.thread_ts ? String(event.thread_ts) : undefined,
      isPinned: Boolean(event.pinned_to),
      hasFiles: Array.isArray(event.files) && event.files.length > 0,
      reactions: [],
      permalink: buildSlackPermalink(channelId, String(event.ts ?? '')),
    };
  }

  private parseSlackEvent(raw: unknown, mode: 'respond' | 'passive'): ChannelMessage | null {
    const payload = raw as Record<string, unknown>;
    const event = (payload.event ?? payload) as SlackEventRecord;
    const text = String(event.text ?? payload.text ?? '').trim();
    const channel = String(event.channel ?? payload.channel_id ?? payload.channel ?? '');
    const user = String(event.user ?? payload.user_id ?? payload.user ?? '');
    if (!text || !channel || !user || event.bot_id) return null;

    const channelType = String(event.channel_type ?? '');
    const isDirect = channelType === 'im' || channel.startsWith('D');
    const isMention = this.isBotMention(text);
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
      chatTitle: String(event.channel_name ?? ''),
      raw,
    };

    if (mode === 'passive') return null;
    if (!shouldAcceptGroupInbound(message).accept) return null;
    return message;
  }

  private isBotMention(text: string): boolean {
    if (this.botUserId && text.includes(`<@${this.botUserId}>`)) return true;
    return /^<@[^>]+>/.test(text) || /@carina\b/i.test(text);
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
      event?: (name: string, handler: (args: Record<string, unknown>) => Promise<void>) => void;
      command?: (name: string, handler: (args: Record<string, unknown>) => Promise<void>) => void;
    };

    try {
      const auth = await (app as { client?: { auth?: { test: () => Promise<{ user_id?: string }> } } })
        .client?.auth?.test();
      this.botUserId = auth?.user_id;
    } catch {
      this.botUserId = undefined;
    }

    const handleRespond = async (payload: Record<string, unknown>, say: unknown) => {
      const inbound = this.parseInbound(payload);
      if (!inbound) return;

      const event = (payload.event ?? payload) as SlackEventRecord;
      const channelSettings = await getAmbientChannelSettings(
        inbound.conversationId,
        inbound.chatTitle ?? inbound.conversationId,
      );

      if (!inbound.isDirect && channelSettings.mentionRequired && !inbound.isMention && !inbound.isCommand) {
        return;
      }

      await this.markWorking(inbound.conversationId, inbound.threadId);

      if (!inbound.isDirect && event.thread_ts) {
        const threadContext = await fetchSlackThreadContext(
          this.app?.client?.conversations,
          inbound.conversationId,
          String(event.thread_ts),
        );
        if (threadContext) {
          payload._carinaThreadContext = threadContext;
        }
      }

      const reply = await collectResponse(getRouter().handleInbound('slack', payload));
      const sayFn = say as (p: Record<string, unknown>) => Promise<unknown>;

      if (inbound.isDirect || channelSettings.responseMode === 'channel') {
        await sayFn({ text: reply || '(no response)' });
        return;
      }

      if (channelSettings.responseMode === 'ephemeral') {
        await sayFn({
          text: reply || '(no response)',
          thread_ts: inbound.threadId,
          response_type: 'ephemeral',
        });
        return;
      }

      await sayFn({
        text: reply || '(no response)',
        thread_ts: inbound.threadId,
        reply_broadcast: channelSettings.broadcastOnComplete || undefined,
      });
    };

    boltApp.message?.(async ({ message, say, event }) => {
      const envelope = { event: message ?? event };
      if (isSlackAmbientEnabled()) {
        const passive = await this.parsePassiveInbound(envelope);
        if (passive) {
          getChannelIngestionService().ingest(passive);
          return;
        }
      }
      await handleRespond(envelope, say);
    });

    boltApp.event?.('app_mention', async ({ event, say }) => {
      await handleRespond({ event }, say);
    });

    boltApp.command?.('/ambient', async ({ command, ack, respond }) => {
      await (ack as () => Promise<void>)();
      const reply = await handleAmbientSlashCommand({
        channelId: String((command as Record<string, unknown>).channel_id ?? ''),
        channelName: String((command as Record<string, unknown>).channel_name ?? ''),
        text: String((command as Record<string, unknown>).text ?? ''),
        userId: String((command as Record<string, unknown>).user_id ?? ''),
      });
      await (respond as (payload: Record<string, unknown>) => Promise<unknown>)({
        text: reply,
        response_type: 'ephemeral',
      });
    });

    boltApp.command?.('/carina', async ({ command, ack, respond }) => {
      await (ack as () => Promise<void>)();
      const cmd = command as Record<string, unknown>;
      const text = String(cmd.text ?? '');

      if (text.startsWith('channel-config')) {
        const reply = await handleCarinaChannelConfigCommand({
          channelId: String(cmd.channel_id ?? ''),
          channelName: String(cmd.channel_name ?? ''),
          text,
        });
        await (respond as (payload: Record<string, unknown>) => Promise<unknown>)({
          text: reply,
          response_type: 'ephemeral',
        });
        return;
      }

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

  private async markWorking(channelId: string, threadTs?: string): Promise<void> {
    if (!threadTs || !this.app?.client?.reactions?.add) return;
    try {
      await this.app.client.reactions.add({
        channel: channelId,
        timestamp: threadTs,
        name: 'eyes',
      });
    } catch {
      // reaction failures should not block the response
    }
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

function buildSlackPermalink(channelId: string, ts: string): string {
  const normalized = ts.replace('.', '');
  return `https://slack.com/archives/${channelId}/p${normalized}`;
}

async function collectResponse(generator: AsyncGenerator<string>): Promise<string> {
  let full = '';
  for await (const chunk of generator) {
    full += chunk;
  }
  return full;
}
