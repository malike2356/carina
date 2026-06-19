import crypto from 'crypto';
import express, { type Request, type Response, type Router } from 'express';
import { getRouter } from '../../router.js';
import { splitByLength } from '../channel-formatter.js';
import type {
  ChannelMessage,
  ChannelName,
  IChannelAdapter,
  SendOptions,
  WebhookValidationInput,
} from '../channel-adapter.interface.js';

export type CatalogWebhookSendContext = {
  conversationId: string;
  text: string;
  options?: SendOptions;
  inbound?: ChannelMessage | null;
};

export type CatalogWebhookOptions = {
  name: ChannelName;
  transport: string;
  maxLength?: number;
  checkConfigured: () => boolean;
  parseInbound: (raw: unknown) => ChannelMessage | null;
  sendMessage: (ctx: CatalogWebhookSendContext) => Promise<void>;
  validateWebhook?: (input: WebhookValidationInput) => boolean | Promise<boolean>;
  /** Store reply_url / callback_url from inbound for outbound delivery. */
  useCallbackUrls?: boolean;
};

type RequestWithRawBody = Request & { rawBody?: Buffer };

const callbackUrlsByChannel = new Map<ChannelName, Map<string, string>>();

export function setCallbackUrl(channel: ChannelName, conversationId: string, url: string): void {
  let map = callbackUrlsByChannel.get(channel);
  if (!map) {
    map = new Map();
    callbackUrlsByChannel.set(channel, map);
  }
  map.set(conversationId, url);
}

export function getCallbackUrl(channel: ChannelName, conversationId: string): string | undefined {
  return callbackUrlsByChannel.get(channel)?.get(conversationId);
}

export function clearCallbackUrls(channel?: ChannelName): void {
  if (channel) callbackUrlsByChannel.delete(channel);
  else callbackUrlsByChannel.clear();
}

export function headerValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

export function verifyHmacSha256(
  rawBody: string | Buffer,
  secret: string,
  signatureHeader: string,
  prefix = '',
): boolean {
  if (!secret || !signatureHeader) return false;
  const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody);
  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
  const normalized = prefix && signatureHeader.startsWith(prefix)
    ? signatureHeader.slice(prefix.length)
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

export function verifySharedSecret(
  input: WebhookValidationInput,
  secret: string,
  headerNames: string[] = ['x-webhook-secret', 'x-carina-webhook-secret', 'authorization'],
): boolean {
  if (!secret) return true;
  for (const name of headerNames) {
    const value = headerValue(input.headers[name]);
    if (!value) continue;
    if (name === 'authorization' && value.startsWith('Bearer ')) {
      if (value.slice('Bearer '.length) === secret) return true;
    }
    if (value === secret) return true;
  }
  const body = input.body as Record<string, unknown> | undefined;
  if (body && String(body.secret ?? '') === secret) return true;
  return false;
}

export function extractCallbackUrl(payload: Record<string, unknown>): string {
  return String(
    payload.callback_url
    ?? payload.reply_url
    ?? payload.webhook_url
    ?? payload.response_url
    ?? '',
  ).trim();
}

export class CatalogWebhookAdapter implements IChannelAdapter {
  readonly name: ChannelName;
  readonly transport: string;

  constructor(
    readonly enabled: boolean,
    private readonly options: CatalogWebhookOptions,
  ) {
    this.name = options.name;
    this.transport = options.transport;
  }

  parseInbound(raw: unknown): ChannelMessage | null {
    const message = this.options.parseInbound(raw);
    if (message && this.options.useCallbackUrls !== false) {
      const payload = raw as Record<string, unknown>;
      const callback = extractCallbackUrl(payload);
      if (callback) {
        setCallbackUrl(this.name, message.conversationId, callback);
      }
    }
    return message;
  }

  async sendMessage(conversationId: string, text: string, options?: SendOptions): Promise<void> {
    if (!this.enabled) return;
    await this.options.sendMessage({ conversationId, text, options });
  }

  formatForChannel(text: string): string[] {
    return splitByLength(text, this.options.maxLength ?? 4000);
  }

  validateWebhook(input: WebhookValidationInput): boolean | Promise<boolean> {
    if (this.options.validateWebhook) {
      return this.options.validateWebhook(input);
    }
    return true;
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
      const valid = await this.validateWebhook({
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
        for await (const chunk of gateway.handleInbound(this.name, req.body)) {
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
    return this.options.checkConfigured();
  }
}

export function createCatalogWebhookAdapter(
  enabled: boolean,
  options: CatalogWebhookOptions,
): CatalogWebhookAdapter {
  return new CatalogWebhookAdapter(enabled, options);
}
