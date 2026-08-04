import crypto from 'crypto';
import express, { type Request, type Response, type Router } from 'express';
import { config } from '../../../config/index.js';
import { getRouter } from '../../router.js';
import { splitByLength } from '../channel-formatter.js';
import type {
  ChannelMessage,
  IChannelAdapter,
  SendOptions,
  WebhookValidationInput,
} from '../channel-adapter.interface.js';

const TWITCH_CHAT_URL = 'https://api.twitch.tv/helix/chat/messages';
const TWITCH_TOKEN_URL = 'https://id.twitch.tv/oauth2/token';
const TWITCH_USERS_URL = 'https://api.twitch.tv/helix/users';
const MAX_MESSAGE_LENGTH = 500;

type RequestWithRawBody = Request & { rawBody?: Buffer };

function headerValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

export function verifyTwitchEventSubSignature(
  messageId: string,
  timestamp: string,
  rawBody: string | Buffer,
  secret: string,
  signatureHeader: string,
): boolean {
  if (!messageId || !timestamp || !secret || !signatureHeader) return false;
  const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody);
  const payload = messageId + timestamp + body.toString('utf8');
  const expected = `sha256=${crypto.createHmac('sha256', secret).update(payload).digest('hex')}`;
  try {
    const expectedBuf = Buffer.from(expected);
    const signatureBuf = Buffer.from(signatureHeader);
    return expectedBuf.length === signatureBuf.length
      && crypto.timingSafeEqual(expectedBuf, signatureBuf);
  } catch {
    return false;
  }
}

export function parseTwitchInbound(raw: unknown, botUsername = ''): ChannelMessage | null {
  const payload = raw as Record<string, unknown>;
  const subscription = payload.subscription as Record<string, unknown> | undefined;
  if (String(subscription?.type ?? '') !== 'channel.chat.message') return null;

  const event = payload.event as Record<string, unknown> | undefined;
  if (!event) return null;

  const chatterLogin = String(event.chatter_user_login ?? '');
  if (botUsername && chatterLogin.toLowerCase() === botUsername.toLowerCase()) return null;

  const message = event.message as Record<string, unknown> | undefined;
  const text = String(message?.text ?? '').trim();
  if (!text) return null;

  const botMention = botUsername
    ? `@${botUsername.toLowerCase()}`
    : '';

  return {
    id: String(event.message_id ?? Date.now()),
    channel: 'twitch',
    externalUserId: String(event.chatter_user_id ?? ''),
    conversationId: String(event.broadcaster_user_id ?? ''),
    text,
    timestamp: new Date(),
    isDirect: false,
    isMention: botMention ? text.toLowerCase().includes(botMention) : false,
    isCommand: text.startsWith('!'),
    senderName: chatterLogin || undefined,
    raw,
  };
}

export class TwitchAdapter implements IChannelAdapter {
  readonly name = 'twitch' as const;

  private cachedAppToken: { value: string; expiresAt: number } | null = null;
  private botUserIdCache: string | null = null;

  constructor(
    readonly enabled: boolean,
    private readonly clientId = config.twitch.clientId,
    private readonly clientSecret = config.twitch.clientSecret,
    private readonly eventsubSecret = config.twitch.eventsubSecret,
    private readonly botUsername = config.twitch.botUsername,
    private readonly channelId = config.twitch.channelId,
    private readonly botUserId = config.twitch.botUserId,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  parseInbound(raw: unknown): ChannelMessage | null {
    return parseTwitchInbound(raw, this.botUsername);
  }

  async sendMessage(conversationId: string, text: string, _options?: SendOptions): Promise<void> {
    if (!this.checkConfigured()) return;

    const token = await this.getAppAccessToken();
    if (!token) return;
    const senderId = await this.resolveBotUserId(token);
    if (!senderId) return;

    for (const chunk of this.formatForChannel(text)) {
      await this.fetchImpl(TWITCH_CHAT_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Client-Id': this.clientId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          broadcaster_id: conversationId,
          sender_id: senderId,
          message: chunk,
        }),
        signal: AbortSignal.timeout(15_000),
      });
    }
  }

  formatForChannel(text: string): string[] {
    return splitByLength(text, MAX_MESSAGE_LENGTH);
  }

  validateWebhook(input: WebhookValidationInput): boolean {
    const messageId = headerValue(input.headers['twitch-eventsub-message-id']);
    const timestamp = headerValue(input.headers['twitch-eventsub-message-timestamp']);
    const signature = headerValue(input.headers['twitch-eventsub-message-signature']);
    const rawBody = input.rawBody ?? JSON.stringify(input.body ?? {});
    return verifyTwitchEventSubSignature(
      messageId,
      timestamp,
      rawBody,
      this.eventsubSecret,
      signature,
    );
  }

  createRouter(): Router {
    const router = express.Router();
    const jsonParser = express.json({
      verify: (req, _res, buf) => {
        (req as RequestWithRawBody).rawBody = buf;
      },
    });

    router.post('/', jsonParser, async (req: Request, res: Response) => {
      const rawBody = (req as RequestWithRawBody).rawBody;
      const valid = this.validateWebhook({
        headers: req.headers as Record<string, string | string[] | undefined>,
        body: req.body,
        rawBody,
        url: req.url,
        method: req.method,
      });
      if (!valid) {
        res.status(401).json({ error: 'invalid webhook' });
        return;
      }

      const messageType = headerValue(req.headers['twitch-eventsub-message-type']);
      if (messageType === 'webhook_callback_verification') {
        const challenge = String((req.body as Record<string, unknown>).challenge ?? '');
        res.status(200).send(challenge);
        return;
      }

      if (messageType !== 'notification') {
        res.status(204).end();
        return;
      }

      try {
        const gateway = getRouter();
        const chunks: string[] = [];
        for await (const chunk of gateway.handleInbound('twitch', req.body)) {
          chunks.push(chunk);
        }

        const inbound = this.parseInbound(req.body);
        const reply = chunks.join('');
        if (reply && inbound) {
          await this.sendMessage(inbound.conversationId, reply, { threadId: inbound.threadId });
        }

        res.json({ ok: true, replied: Boolean(reply), reply: reply || undefined });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        res.status(500).json({ error: msg });
      }
    });

    return router;
  }

  checkConfigured(): boolean {
    return Boolean(
      this.clientId?.trim()
      && this.clientSecret?.trim()
      && this.eventsubSecret?.trim()
      && this.channelId?.trim(),
    );
  }

  private async getAppAccessToken(): Promise<string | null> {
    if (this.cachedAppToken && this.cachedAppToken.expiresAt > Date.now() + 60_000) {
      return this.cachedAppToken.value;
    }

    const url = new URL(TWITCH_TOKEN_URL);
    url.searchParams.set('client_id', this.clientId);
    url.searchParams.set('client_secret', this.clientSecret);
    url.searchParams.set('grant_type', 'client_credentials');

    const res = await this.fetchImpl(url.toString(), {
      method: 'POST',
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;

    const data = await res.json() as { access_token?: string; expires_in?: number };
    if (!data.access_token) return null;

    this.cachedAppToken = {
      value: data.access_token,
      expiresAt: Date.now() + (Number(data.expires_in ?? 3600) * 1000),
    };
    return data.access_token;
  }

  private async resolveBotUserId(token: string): Promise<string | null> {
    if (this.botUserId) return this.botUserId;
    if (this.botUserIdCache) return this.botUserIdCache;
    if (!this.botUsername) return null;

    const url = new URL(TWITCH_USERS_URL);
    url.searchParams.set('login', this.botUsername);
    const res = await this.fetchImpl(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
        'Client-Id': this.clientId,
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;

    const data = await res.json() as { data?: Array<{ id?: string }> };
    const id = data.data?.[0]?.id;
    if (!id) return null;
    this.botUserIdCache = id;
    return id;
  }
}
