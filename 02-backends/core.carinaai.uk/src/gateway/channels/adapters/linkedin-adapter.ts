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

const LINKEDIN_MESSAGES_URL = 'https://api.linkedin.com/v2/messages';
const MAX_MESSAGE_LENGTH = 8000;

type RequestWithRawBody = Request & { rawBody?: Buffer };

type LinkedInInbound = {
  message?: {
    id?: string;
    from?: { person?: string };
    content?: { text?: string };
    conversation?: { id?: string };
  };
};

function headerValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

export function verifyLinkedInSignature(
  rawBody: string | Buffer,
  secret: string,
  signatureHeader: string,
): boolean {
  if (!secret || !signatureHeader) return false;
  const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody);
  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
  const normalized = signatureHeader.startsWith('sha256=')
    ? signatureHeader.slice('sha256='.length)
    : signatureHeader;
  try {
    const expectedBuf = Buffer.from(expected);
    const signatureBuf = Buffer.from(normalized);
    return expectedBuf.length === signatureBuf.length
      && crypto.timingSafeEqual(expectedBuf, signatureBuf);
  } catch {
    return false;
  }
}

export function parseLinkedInInbound(raw: unknown): ChannelMessage | null {
  const payload = raw as LinkedInInbound;
  const message = payload.message;
  const text = String(message?.content?.text ?? '').trim();
  const person = String(message?.from?.person ?? '');
  const conversationId = String(message?.conversation?.id ?? '');
  const messageId = String(message?.id ?? '');
  if (!text || !person || !conversationId || !messageId) return null;

  return {
    id: messageId,
    channel: 'linkedin',
    externalUserId: person,
    conversationId,
    text,
    timestamp: new Date(),
    isDirect: true,
    isMention: false,
    isCommand: text.startsWith('/'),
    chatType: 'private',
    raw,
  };
}

export class LinkedInAdapter implements IChannelAdapter {
  readonly name = 'linkedin' as const;

  constructor(
    readonly enabled: boolean,
    private readonly accessToken = config.linkedin.accessToken,
    private readonly webhookSecret = config.linkedin.webhookSecret || config.linkedin.clientSecret,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  parseInbound(raw: unknown): ChannelMessage | null {
    return parseLinkedInInbound(raw);
  }

  async sendMessage(conversationId: string, text: string, _options?: SendOptions): Promise<void> {
    if (!this.accessToken) return;

    for (const chunk of this.formatForChannel(text)) {
      await this.fetchImpl(LINKEDIN_MESSAGES_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipients: [{ person: conversationId }],
          subject: '',
          body: chunk,
        }),
        signal: AbortSignal.timeout(15_000),
      });
    }
  }

  formatForChannel(text: string): string[] {
    return splitByLength(text, MAX_MESSAGE_LENGTH);
  }

  validateWebhook(input: WebhookValidationInput): boolean {
    if (!this.webhookSecret) return false;
    const signature = headerValue(input.headers['x-li-signature']);
    const rawBody = input.rawBody ?? JSON.stringify(input.body ?? {});
    return verifyLinkedInSignature(rawBody, this.webhookSecret, signature);
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
        for await (const chunk of gateway.handleInbound('linkedin', req.body)) {
          chunks.push(chunk);
        }

        const inbound = this.parseInbound(req.body);
        const reply = chunks.join('');
        if (reply && inbound) {
          await this.sendMessage(inbound.conversationId, reply);
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
    return Boolean(this.accessToken?.trim());
  }
}
