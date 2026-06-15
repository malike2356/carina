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

const MAX_MESSAGE_LENGTH = 40_000;

type RequestWithRawBody = Request & { rawBody?: Buffer };

function headerValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

export function verifyRocketChatSignature(
  rawBody: string | Buffer,
  secret: string,
  signatureHeader: string,
): boolean {
  if (!secret || !signatureHeader) return false;
  const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody);
  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
  try {
    const expectedBuf = Buffer.from(expected);
    const signatureBuf = Buffer.from(signatureHeader);
    return expectedBuf.length === signatureBuf.length
      && crypto.timingSafeEqual(expectedBuf, signatureBuf);
  } catch {
    return false;
  }
}

export function parseRocketChatInbound(raw: unknown): ChannelMessage | null {
  const payload = raw as Record<string, unknown>;
  if (payload.bot === true) return null;

  const text = String(payload.text ?? '').trim();
  const userId = String(payload.user_id ?? '');
  const channelId = String(payload.channel_id ?? '');
  if (!text || !userId || !channelId) return null;

  return {
    id: String(payload._id ?? payload.message_id ?? Date.now()),
    channel: 'rocketchat',
    externalUserId: userId,
    conversationId: channelId,
    text,
    timestamp: new Date(),
    isDirect: String(payload.channel_name ?? '') === 'direct',
    isMention: /@carina\b/i.test(text),
    isCommand: text.startsWith('/'),
    senderName: String(payload.user_name ?? '') || undefined,
    raw,
  };
}

export class RocketChatAdapter implements IChannelAdapter {
  readonly name = 'rocketchat' as const;

  constructor(
    readonly enabled: boolean,
    private readonly baseUrl = config.rocketchat.url,
    private readonly botUserId = config.rocketchat.botUserId,
    private readonly botAuthToken = config.rocketchat.botAuthToken,
    private readonly webhookSecret = config.rocketchat.webhookSecret,
  ) {}

  parseInbound(raw: unknown): ChannelMessage | null {
    return parseRocketChatInbound(raw);
  }

  async sendMessage(conversationId: string, text: string, _options?: SendOptions): Promise<void> {
    if (!this.checkConfigured()) return;

    const url = `${this.baseUrl.replace(/\/$/, '')}/api/v1/chat.postMessage`;
    for (const chunk of this.formatForChannel(text)) {
      await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': this.botAuthToken,
          'X-User-Id': this.botUserId,
        },
        body: JSON.stringify({ channel: conversationId, text: chunk }),
        signal: AbortSignal.timeout(15_000),
      });
    }
  }

  formatForChannel(text: string): string[] {
    return splitByLength(text, MAX_MESSAGE_LENGTH);
  }

  validateWebhook(input: WebhookValidationInput): boolean {
    if (!this.webhookSecret) return true;
    const signature = headerValue(input.headers['x-rocketchat-signature']);
    const rawBody = input.rawBody ?? JSON.stringify(input.body ?? {});
    return verifyRocketChatSignature(rawBody, this.webhookSecret, signature);
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
        for await (const chunk of gateway.handleInbound('rocketchat', req.body)) {
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
      this.baseUrl?.trim()
      && this.botUserId?.trim()
      && this.botAuthToken?.trim(),
    );
  }
}
