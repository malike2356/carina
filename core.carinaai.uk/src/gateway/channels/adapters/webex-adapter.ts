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

const WEBEX_MESSAGES_URL = 'https://webexapis.com/v1/messages';
const WEBEX_PEOPLE_ME_URL = 'https://webexapis.com/v1/people/me';
const MAX_MESSAGE_LENGTH = 7439;

type RequestWithRawBody = Request & { rawBody?: Buffer };

type WebexPerson = {
  id: string;
  displayName: string;
};

type WebexMessage = {
  id: string;
  roomId: string;
  roomType?: string;
  text?: string;
  personId: string;
  mentionedPeople?: string[];
};

type WebexWebhookEvent = {
  id?: string;
  resource?: string;
  event?: string;
  data?: { id?: string };
};

function headerValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

export function verifyWebexSignature(
  rawBody: string | Buffer,
  secret: string,
  signatureHeader: string,
): boolean {
  if (!secret || !signatureHeader) return false;
  const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody);
  const expected = crypto.createHmac('sha1', secret).update(body).digest('base64');
  try {
    const expectedBuf = Buffer.from(expected);
    const signatureBuf = Buffer.from(signatureHeader);
    return expectedBuf.length === signatureBuf.length
      && crypto.timingSafeEqual(expectedBuf, signatureBuf);
  } catch {
    return false;
  }
}

export function stripBotMention(text: string, botName: string): string {
  if (!botName) return text.trim();
  const escaped = botName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(new RegExp(`^@${escaped}\\s*`, 'i'), '').trim();
}

export function parseWebexMessage(
  message: WebexMessage,
  botPersonId: string,
  botDisplayName = '',
): ChannelMessage | null {
  if (!message.personId || (botPersonId && message.personId === botPersonId)) {
    return null;
  }

  const text = stripBotMention(String(message.text ?? ''), botDisplayName);
  if (!text) return null;

  const mentionedPeople = Array.isArray(message.mentionedPeople) ? message.mentionedPeople : [];

  return {
    id: message.id,
    channel: 'webex',
    externalUserId: message.personId,
    conversationId: message.roomId,
    text,
    timestamp: new Date(),
    isDirect: message.roomType === 'direct',
    isMention: botPersonId ? mentionedPeople.includes(botPersonId) : false,
    isCommand: text.startsWith('/'),
    raw: message,
  };
}

export class WebexAdapter implements IChannelAdapter {
  readonly name = 'webex' as const;

  private botPerson: WebexPerson | null = null;

  constructor(
    readonly enabled: boolean,
    private readonly botToken = config.webex.botToken,
    private readonly webhookSecret = config.webex.webhookSecret,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  parseInbound(raw: unknown): Promise<ChannelMessage | null> {
    return this.parseWebhookEvent(raw);
  }

  async parseWebhookEvent(raw: unknown): Promise<ChannelMessage | null> {
    const event = raw as WebexWebhookEvent;
    if (event.resource !== 'messages' || event.event !== 'created') return null;

    const messageId = String(event.data?.id ?? '');
    if (!messageId || !this.botToken) return null;

    const message = await this.fetchMessage(messageId);
    if (!message) return null;

    const bot = await this.resolveBotPerson();
    return parseWebexMessage(message, bot?.id ?? '', bot?.displayName ?? '');
  }

  async sendMessage(conversationId: string, text: string, _options?: SendOptions): Promise<void> {
    if (!this.botToken) return;

    for (const chunk of this.formatForChannel(text)) {
      await this.fetchImpl(WEBEX_MESSAGES_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.botToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ roomId: conversationId, text: chunk }),
        signal: AbortSignal.timeout(15_000),
      });
    }
  }

  formatForChannel(text: string): string[] {
    return splitByLength(text, MAX_MESSAGE_LENGTH);
  }

  validateWebhook(input: WebhookValidationInput): boolean {
    if (!this.webhookSecret) return true;
    const signature = headerValue(input.headers['x-spark-signature']);
    const rawBody = input.rawBody ?? JSON.stringify(input.body ?? {});
    return verifyWebexSignature(rawBody, this.webhookSecret, signature);
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
        for await (const chunk of gateway.handleInbound('webex', req.body)) {
          chunks.push(chunk);
        }

        const inbound = await this.parseWebhookEvent(req.body);
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
    return Boolean(this.botToken?.trim());
  }

  private async fetchMessage(messageId: string): Promise<WebexMessage | null> {
    const res = await this.fetchImpl(`${WEBEX_MESSAGES_URL}/${encodeURIComponent(messageId)}`, {
      headers: { Authorization: `Bearer ${this.botToken}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    return res.json() as Promise<WebexMessage>;
  }

  private async resolveBotPerson(): Promise<WebexPerson | null> {
    if (this.botPerson) return this.botPerson;
    if (!this.botToken) return null;

    const res = await this.fetchImpl(WEBEX_PEOPLE_ME_URL, {
      headers: { Authorization: `Bearer ${this.botToken}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;

    const data = await res.json() as { id?: string; displayName?: string; nickName?: string };
    if (!data.id) return null;

    this.botPerson = {
      id: data.id,
      displayName: String(data.displayName ?? data.nickName ?? ''),
    };
    return this.botPerson;
  }
}
