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

const MAX_MESSAGE_LENGTH = 1000;

type RequestWithRawBody = Request & { rawBody?: Buffer };

function headerValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

export function verifyKakaoTalkWebhook(
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

export function parseKakaoTalkInbound(raw: unknown): ChannelMessage | null {
  const payload = raw as Record<string, unknown>;
  const userRequest = payload.userRequest as Record<string, unknown> | undefined;
  if (!userRequest) return null;

  const user = userRequest.user as Record<string, unknown> | undefined;
  const userId = String(user?.id ?? '');
  const text = String(userRequest.utterance ?? '').trim();
  if (!userId || !text) return null;

  const properties = user?.properties as Record<string, unknown> | undefined;

  return {
    id: String(userRequest.callbackId ?? userRequest.requestId ?? Date.now()),
    channel: 'kakaotalk',
    externalUserId: userId,
    conversationId: userId,
    text,
    timestamp: new Date(),
    isDirect: true,
    isMention: false,
    isCommand: text.startsWith('/'),
    senderName: properties?.nickname ? String(properties.nickname) : undefined,
    raw,
  };
}

export function buildKakaoTalkResponse(text: string): {
  version: string;
  template: { outputs: Array<{ simpleText: { text: string } }> };
} {
  const chunks = splitByLength(text, MAX_MESSAGE_LENGTH);
  return {
    version: '2.0',
    template: {
      outputs: (chunks.length ? chunks : ['']).map((chunk) => ({ simpleText: { text: chunk } })),
    },
  };
}

export class KakaoTalkAdapter implements IChannelAdapter {
  readonly name = 'kakaotalk' as const;

  private readonly pendingReplies = new Map<string, string>();

  constructor(
    readonly enabled: boolean,
    private readonly apiKey = config.kakaotalk.apiKey,
    private readonly botId = config.kakaotalk.botId,
    private readonly webhookSecret = config.kakaotalk.webhookSecret,
  ) {}

  parseInbound(raw: unknown): ChannelMessage | null {
    return parseKakaoTalkInbound(raw);
  }

  async sendMessage(conversationId: string, text: string, _options?: SendOptions): Promise<void> {
    const existing = this.pendingReplies.get(conversationId) ?? '';
    this.pendingReplies.set(conversationId, existing ? `${existing}\n${text}` : text);
  }

  formatForChannel(text: string): string[] {
    return splitByLength(text, MAX_MESSAGE_LENGTH);
  }

  drainReply(conversationId: string): string {
    const reply = this.pendingReplies.get(conversationId) ?? '';
    this.pendingReplies.delete(conversationId);
    return reply;
  }

  validateWebhook(input: WebhookValidationInput): boolean {
    if (!this.webhookSecret) return true;
    const signature = headerValue(input.headers['x-kakaotalk-signature']);
    const rawBody = input.rawBody ?? JSON.stringify(input.body ?? {});
    return verifyKakaoTalkWebhook(rawBody, this.webhookSecret, signature);
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
        const inbound = this.parseInbound(req.body);
        if (inbound) {
          this.pendingReplies.delete(inbound.conversationId);
        }

        const gateway = getRouter();
        const chunks: string[] = [];
        for await (const chunk of gateway.handleInbound('kakaotalk', req.body)) {
          chunks.push(chunk);
        }

        const reply = chunks.join('');
        if (reply && inbound) {
          await this.sendMessage(inbound.conversationId, reply);
        }

        const buffered = inbound ? this.drainReply(inbound.conversationId) : '';
        res.json(buildKakaoTalkResponse(buffered || reply));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        res.status(500).json({ error: msg });
      }
    });

    return router;
  }

  checkConfigured(): boolean {
    return Boolean(this.apiKey?.trim() && this.botId?.trim());
  }
}
