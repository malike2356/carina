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

const MAX_MESSAGE_LENGTH = 32_000;

type RequestWithRawBody = Request & { rawBody?: Buffer };

type NextcloudTalkInbound = {
  type?: string;
  actor?: { id?: string; name?: string };
  object?: { id?: string; content?: string };
  target?: { id?: string };
};

function headerValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

export function stripNextcloudHtml(text: string): string {
  return text.replace(/<[^>]*>/g, '').trim();
}

export function verifyNextcloudTalkSignature(
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

export function parseNextcloudTalkInbound(raw: unknown): ChannelMessage | null {
  const payload = raw as NextcloudTalkInbound;
  if (payload.type !== 'Create') return null;

  const actorId = String(payload.actor?.id ?? '');
  const conversationId = String(payload.target?.id ?? '');
  const objectId = String(payload.object?.id ?? '');
  const text = stripNextcloudHtml(String(payload.object?.content ?? ''));
  if (!actorId || !conversationId || !objectId || !text) return null;

  return {
    id: objectId,
    channel: 'nextcloud-talk',
    externalUserId: actorId,
    conversationId,
    text,
    timestamp: new Date(),
    isDirect: false,
    isMention: /@carina\b/i.test(text),
    isCommand: text.startsWith('/'),
    chatType: 'group',
    senderName: payload.actor?.name ? String(payload.actor.name) : undefined,
    raw,
  };
}

export class NextcloudTalkAdapter implements IChannelAdapter {
  readonly name = 'nextcloud-talk' as const;

  constructor(
    readonly enabled: boolean,
    private readonly baseUrl = config.nextcloudTalk.url,
    private readonly botSecret = config.nextcloudTalk.botSecret,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  parseInbound(raw: unknown): ChannelMessage | null {
    return parseNextcloudTalkInbound(raw);
  }

  async sendMessage(conversationId: string, text: string, _options?: SendOptions): Promise<void> {
    if (!this.checkConfigured()) return;

    const url = `${this.baseUrl.replace(/\/$/, '')}/ocs/v2.php/apps/spreed/api/v1/chat/${conversationId}`;
    for (const chunk of this.formatForChannel(text)) {
      await this.fetchImpl(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.botSecret}`,
          'OCS-APIRequest': 'true',
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: chunk, replyTo: 0 }),
        signal: AbortSignal.timeout(15_000),
      });
    }
  }

  formatForChannel(text: string): string[] {
    return splitByLength(text, MAX_MESSAGE_LENGTH);
  }

  validateWebhook(input: WebhookValidationInput): boolean {
    if (!this.botSecret) return false;
    const signature = headerValue(input.headers['x-nextcloud-talk-signature']);
    const rawBody = input.rawBody ?? JSON.stringify(input.body ?? {});
    return verifyNextcloudTalkSignature(rawBody, this.botSecret, signature);
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
        for await (const chunk of gateway.handleInbound('nextcloud-talk', req.body)) {
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
    return Boolean(this.baseUrl?.trim() && this.botSecret?.trim());
  }
}
