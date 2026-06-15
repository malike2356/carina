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
import {
  buildTwitterCrcResponse,
  formatOAuth1AuthorizationHeader,
  signOAuth1Request,
  verifyTwitterWebhookSignature,
} from './twitter-oauth.js';

const DM_API_BASE = 'https://api.twitter.com/2/dm_conversations/with';
const MAX_MESSAGE_LENGTH = 10_000;

type RequestWithRawBody = Request & { rawBody?: Buffer };

function headerValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

export function parseTwitterInbound(raw: unknown, botUserId = ''): ChannelMessage | null {
  const payload = raw as Record<string, unknown>;
  const events = Array.isArray(payload.direct_message_events)
    ? payload.direct_message_events
    : [];
  const dmEvent = events[0] as Record<string, unknown> | undefined;
  if (!dmEvent) return null;

  const messageCreate = dmEvent.message_create as Record<string, unknown> | undefined;
  if (!messageCreate) return null;

  const senderId = String(messageCreate.sender_id ?? '');
  if (!senderId || (botUserId && senderId === botUserId)) return null;

  const messageData = messageCreate.message_data as Record<string, unknown> | undefined;
  const text = String(messageData?.text ?? '').trim();
  if (!text) return null;

  return {
    id: String(dmEvent.id ?? Date.now()),
    channel: 'twitter',
    externalUserId: senderId,
    conversationId: senderId,
    text,
    timestamp: new Date(Number(dmEvent.created_timestamp ?? Date.now())),
    isDirect: true,
    isMention: false,
    isCommand: text.startsWith('/'),
    raw,
  };
}

export class TwitterAdapter implements IChannelAdapter {
  readonly name = 'twitter' as const;

  constructor(
    readonly enabled: boolean,
    private readonly apiKey = config.twitter.apiKey,
    private readonly apiSecret = config.twitter.apiSecret,
    private readonly accessToken = config.twitter.accessToken,
    private readonly accessTokenSecret = config.twitter.accessTokenSecret,
    private readonly consumerSecret = config.twitter.consumerSecret,
    private readonly botUserId = config.twitter.botUserId,
  ) {}

  parseInbound(raw: unknown): ChannelMessage | null {
    return parseTwitterInbound(raw, this.botUserId);
  }

  async sendMessage(conversationId: string, text: string, _options?: SendOptions): Promise<void> {
    if (!this.checkConfigured()) return;

    const url = `${DM_API_BASE}/${encodeURIComponent(conversationId)}/messages`;
    for (const chunk of this.formatForChannel(text)) {
      const oauthParams = signOAuth1Request({
        method: 'POST',
        url,
        consumerKey: this.apiKey,
        consumerSecret: this.apiSecret,
        accessToken: this.accessToken,
        accessTokenSecret: this.accessTokenSecret,
      });

      await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: formatOAuth1AuthorizationHeader(oauthParams),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: chunk }),
        signal: AbortSignal.timeout(15_000),
      });
    }
  }

  formatForChannel(text: string): string[] {
    return splitByLength(text, MAX_MESSAGE_LENGTH);
  }

  validateWebhook(input: WebhookValidationInput): boolean {
    const signature = headerValue(input.headers['x-twitter-webhooks-signature']);
    const rawBody = input.rawBody ?? JSON.stringify(input.body ?? {});
    return verifyTwitterWebhookSignature(rawBody, this.consumerSecret, signature);
  }

  createRouter(): Router {
    const router = express.Router();
    const jsonParser = express.json({
      verify: (req, _res, buf) => {
        (req as RequestWithRawBody).rawBody = buf;
      },
    });

    router.get('/', (req: Request, res: Response) => {
      const crcToken = String(req.query.crc_token ?? '');
      if (!crcToken || !this.consumerSecret) {
        res.sendStatus(403);
        return;
      }
      res.status(200).json(buildTwitterCrcResponse(crcToken, this.consumerSecret));
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

      try {
        const gateway = getRouter();
        const chunks: string[] = [];
        for await (const chunk of gateway.handleInbound('twitter', req.body)) {
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
      this.apiKey?.trim()
      && this.apiSecret?.trim()
      && this.accessToken?.trim()
      && this.accessTokenSecret?.trim()
      && this.consumerSecret?.trim(),
    );
  }
}
