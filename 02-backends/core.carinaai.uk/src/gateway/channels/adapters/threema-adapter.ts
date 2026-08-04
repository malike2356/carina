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

const THREEMA_SEND_URL = 'https://msgapi.threema.ch/send_simple';
const MAX_MESSAGE_LENGTH = 3500;

type RequestWithRawBody = Request & { rawBody?: Buffer };

function headerValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

export function computeThreemaMac(
  from: string,
  to: string,
  nonce: string,
  gatewaySecret: string,
): string {
  return crypto
    .createHmac('sha256', gatewaySecret)
    .update(`${from}${to}${nonce}${gatewaySecret}`)
    .digest('hex');
}

export function verifyThreemaMac(
  from: string,
  to: string,
  nonce: string,
  gatewaySecret: string,
  macHeader: string,
): boolean {
  if (!gatewaySecret || !macHeader) return false;
  const expected = computeThreemaMac(from, to, nonce, gatewaySecret);
  try {
    const expectedBuf = Buffer.from(expected);
    const macBuf = Buffer.from(macHeader);
    return expectedBuf.length === macBuf.length && crypto.timingSafeEqual(expectedBuf, macBuf);
  } catch {
    return false;
  }
}

export function parseThreemaInbound(raw: unknown): ChannelMessage | null {
  const payload = raw as Record<string, unknown>;
  const from = String(payload.from ?? '');
  const text = String(payload.text ?? '').trim();
  if (!from || !text) return null;

  return {
    id: String(payload.msgid ?? payload.nonce ?? Date.now()),
    channel: 'threema',
    externalUserId: from,
    conversationId: from,
    text,
    timestamp: new Date(),
    isDirect: true,
    isMention: false,
    isCommand: text.startsWith('/'),
    raw,
  };
}

export class ThreemaAdapter implements IChannelAdapter {
  readonly name = 'threema' as const;

  constructor(
    readonly enabled: boolean,
    private readonly gatewayId = config.threema.gatewayId,
    private readonly gatewaySecret = config.threema.gatewaySecret,
  ) {}

  parseInbound(raw: unknown): ChannelMessage | null {
    return parseThreemaInbound(raw);
  }

  async sendMessage(conversationId: string, text: string, _options?: SendOptions): Promise<void> {
    if (!this.checkConfigured()) return;

    for (const chunk of this.formatForChannel(text)) {
      await fetch(THREEMA_SEND_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          from: this.gatewayId,
          secret: this.gatewaySecret,
          to: conversationId,
          text: chunk,
        }).toString(),
        signal: AbortSignal.timeout(15_000),
      });
    }
  }

  formatForChannel(text: string): string[] {
    return splitByLength(text, MAX_MESSAGE_LENGTH);
  }

  validateWebhook(input: WebhookValidationInput): boolean {
    if (!this.gatewaySecret) return true;

    const body = input.body as Record<string, unknown>;
    const from = String(body.from ?? '');
    const to = String(body.to ?? '');
    const nonce = String(body.nonce ?? '');
    const mac = String(body.mac ?? headerValue(input.headers['x-threema-mac']));
    return verifyThreemaMac(from, to, nonce, this.gatewaySecret, mac);
  }

  createRouter(): Router {
    const router = express.Router();
    const formParser = express.urlencoded({
      extended: false,
      verify: (req, _res, buf) => {
        (req as RequestWithRawBody).rawBody = buf;
      },
    });

    router.post('/', formParser, async (req: Request, res: Response) => {
      const valid = this.validateWebhook({
        headers: req.headers as Record<string, string | string[] | undefined>,
        body: req.body,
        rawBody: (req as RequestWithRawBody).rawBody,
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
        for await (const chunk of gateway.handleInbound('threema', req.body)) {
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
    return Boolean(this.gatewayId?.trim() && this.gatewaySecret?.trim());
  }
}
