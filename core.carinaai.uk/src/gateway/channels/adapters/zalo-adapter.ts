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

const ZALO_MESSAGE_URL = 'https://openapi.zalo.me/v3.0/oa/message/cs';
const MAX_MESSAGE_LENGTH = 2000;

type RequestWithRawBody = Request & { rawBody?: Buffer };

function headerValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

export function computeZaloMac(appId: string, data: string, appSecret: string): string {
  return crypto.createHmac('sha256', appSecret).update(`${appId}${data}${appSecret}`).digest('hex');
}

export function verifyZaloMac(
  appId: string,
  data: string,
  appSecret: string,
  macHeader: string,
): boolean {
  if (!appId || !appSecret || !macHeader) return false;
  const expected = computeZaloMac(appId, data, appSecret);
  try {
    const expectedBuf = Buffer.from(expected);
    const macBuf = Buffer.from(macHeader);
    return expectedBuf.length === macBuf.length && crypto.timingSafeEqual(expectedBuf, macBuf);
  } catch {
    return false;
  }
}

export function parseZaloInbound(raw: unknown): ChannelMessage | null {
  const payload = raw as Record<string, unknown>;
  if (String(payload.event_name ?? '') !== 'user_send_text') return null;

  const sender = payload.sender as Record<string, unknown> | undefined;
  const message = payload.message as Record<string, unknown> | undefined;
  const senderId = String(sender?.id ?? '');
  const text = String(message?.text ?? '').trim();
  if (!senderId || !text) return null;

  return {
    id: String(message?.msg_id ?? Date.now()),
    channel: 'zalo',
    externalUserId: senderId,
    conversationId: senderId,
    text,
    timestamp: new Date(Number(payload.timestamp ?? Date.now())),
    isDirect: true,
    isMention: false,
    isCommand: text.startsWith('/'),
    raw,
  };
}

export class ZaloAdapter implements IChannelAdapter {
  readonly name = 'zalo' as const;

  constructor(
    readonly enabled: boolean,
    private readonly appId = config.zalo.appId,
    private readonly appSecret = config.zalo.appSecret,
    private readonly oaAccessToken = config.zalo.oaAccessToken,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  parseInbound(raw: unknown): ChannelMessage | null {
    return parseZaloInbound(raw);
  }

  async sendMessage(conversationId: string, text: string, _options?: SendOptions): Promise<void> {
    if (!this.oaAccessToken) return;

    for (const chunk of this.formatForChannel(text)) {
      await this.fetchImpl(ZALO_MESSAGE_URL, {
        method: 'POST',
        headers: {
          access_token: this.oaAccessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipient: { user_id: conversationId },
          message: { text: chunk },
        }),
        signal: AbortSignal.timeout(15_000),
      });
    }
  }

  formatForChannel(text: string): string[] {
    return splitByLength(text, MAX_MESSAGE_LENGTH);
  }

  validateWebhook(input: WebhookValidationInput): boolean {
    if (!this.appSecret) return true;

    const body = input.body as Record<string, unknown>;
    const appId = String(body.app_id ?? this.appId);
    const data = typeof body.data === 'string'
      ? body.data
      : JSON.stringify(body.data ?? body);
    const mac = headerValue(input.headers.mac) || headerValue(input.headers['x-zalo-mac']);
    return verifyZaloMac(appId, data, this.appSecret, mac);
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

      try {
        const gateway = getRouter();
        const chunks: string[] = [];
        for await (const chunk of gateway.handleInbound('zalo', req.body)) {
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
    return Boolean(this.appId?.trim() && this.oaAccessToken?.trim());
  }
}
