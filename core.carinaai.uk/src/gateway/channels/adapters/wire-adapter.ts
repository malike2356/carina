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

const DEFAULT_WIRE_API_BASE = 'https://prod-nginz-https.wire.com';
const MAX_MESSAGE_LENGTH = 8000;

type RequestWithRawBody = Request & { rawBody?: Buffer };

const WIRE_MESSAGE_TYPES = new Set([
  'conversation.otr-message-add',
  'conversation.message-add',
]);

function headerValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

export function parseWireInbound(raw: unknown): ChannelMessage | null {
  const payload = raw as Record<string, unknown>;
  const type = String(payload.type ?? '');
  if (!WIRE_MESSAGE_TYPES.has(type)) return null;

  const data = payload.data as Record<string, unknown> | undefined;
  const text = String(data?.content ?? data?.text ?? '').trim();
  const from = String(payload.from ?? '');
  const conversation = String(payload.conversation ?? '');
  if (!text || !from || !conversation) return null;

  return {
    id: String(payload.id ?? data?.id ?? Date.now()),
    channel: 'wire',
    externalUserId: from,
    conversationId: conversation,
    text,
    timestamp: new Date(),
    isDirect: data?.recipient_mode === 'direct',
    isMention: /@carina\b/i.test(text),
    isCommand: text.startsWith('/'),
    raw,
  };
}

export class WireAdapter implements IChannelAdapter {
  readonly name = 'wire' as const;

  constructor(
    readonly enabled: boolean,
    private readonly botClientId = config.wire.botClientId,
    private readonly botToken = config.wire.botToken,
    private readonly botSecret = config.wire.botSecret,
    private readonly apiBase = config.wire.apiBase || DEFAULT_WIRE_API_BASE,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  parseInbound(raw: unknown): ChannelMessage | null {
    return parseWireInbound(raw);
  }

  async sendMessage(conversationId: string, text: string, _options?: SendOptions): Promise<void> {
    if (!this.botToken || !this.botClientId) return;

    const url = `${this.apiBase.replace(/\/$/, '')}/bot/messages`;
    for (const chunk of this.formatForChannel(text)) {
      await this.fetchImpl(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.botToken}`,
          'Client-Id': this.botClientId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'conversation.message-add',
          conversation: conversationId,
          text: chunk,
        }),
        signal: AbortSignal.timeout(15_000),
      });
    }
  }

  formatForChannel(text: string): string[] {
    return splitByLength(text, MAX_MESSAGE_LENGTH);
  }

  validateWebhook(input: WebhookValidationInput): boolean {
    if (!this.botSecret) return true;
    const auth = headerValue(input.headers.authorization);
    return auth === this.botSecret || auth === `Bearer ${this.botSecret}`;
  }

  createRouter(): Router {
    const router = express.Router();
    const jsonParser = express.json({
      verify: (req, _res, buf) => {
        (req as RequestWithRawBody).rawBody = buf;
      },
    });

    router.post('/', jsonParser, async (req: Request, res: Response) => {
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
        for await (const chunk of gateway.handleInbound('wire', req.body)) {
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
      this.botClientId?.trim()
      && this.botToken?.trim(),
    );
  }
}
