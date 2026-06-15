import crypto from 'crypto';
import express, { type Request, type Response, type Router } from 'express';
import { getRouter } from '../../router.js';
import { splitByLength } from '../channel-formatter.js';
import type {
  Attachment,
  ChannelMessage,
  ChannelName,
  IChannelAdapter,
  SendOptions,
  WebhookValidationInput,
} from '../channel-adapter.interface.js';

const GRAPH_API_VERSION = 'v20.0';
const GRAPH_MESSAGES_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}/me/messages`;
const MAX_MESSAGE_LENGTH = 2000;

type MetaGraphChannel = 'messenger' | 'instagram';

export type MetaGraphCredentials = {
  channel: MetaGraphChannel;
  accessToken: string;
  verifyToken: string;
  appSecret: string;
};

type RequestWithRawBody = Request & { rawBody?: Buffer };

function headerValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

export function verifyMetaHubSignature(
  rawBody: string | Buffer,
  appSecret: string,
  signatureHeader: string,
): boolean {
  if (!appSecret || !signatureHeader) return false;
  const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody);
  const expected = `sha256=${crypto.createHmac('sha256', appSecret).update(body).digest('hex')}`;
  try {
    const expectedBuf = Buffer.from(expected);
    const signatureBuf = Buffer.from(signatureHeader);
    return expectedBuf.length === signatureBuf.length
      && crypto.timingSafeEqual(expectedBuf, signatureBuf);
  } catch {
    return false;
  }
}

export function handleMetaWebhookChallenge(
  query: Record<string, unknown>,
  verifyToken: string,
): string | null {
  const mode = String(query['hub.mode'] ?? '');
  const token = String(query['hub.verify_token'] ?? '');
  const challenge = String(query['hub.challenge'] ?? '');
  if (mode === 'subscribe' && token === verifyToken && challenge) {
    return challenge;
  }
  return null;
}

function mapMetaAttachment(raw: unknown): Attachment {
  const attachment = raw as Record<string, unknown>;
  const payload = attachment.payload as Record<string, unknown> | undefined;
  return {
    contentType: String(attachment.type ?? ''),
    url: payload?.url ? String(payload.url) : undefined,
  };
}

export function parseMetaInbound(raw: unknown, channel: MetaGraphChannel): ChannelMessage | null {
  const payload = raw as Record<string, unknown>;
  const entries = Array.isArray(payload.entry) ? payload.entry : [];
  const entry = entries[0] as Record<string, unknown> | undefined;
  if (!entry) return null;

  const messagingList = Array.isArray(entry.messaging) ? entry.messaging : [];
  const messaging = messagingList[0] as Record<string, unknown> | undefined;
  if (!messaging) return null;

  const message = messaging.message as Record<string, unknown> | undefined;
  if (!message) return null;

  const sender = messaging.sender as Record<string, unknown> | undefined;
  const senderId = String(sender?.id ?? '');
  if (!senderId) return null;

  const text = String(message.text ?? '').trim();
  const rawAttachments = Array.isArray(message.attachments) ? message.attachments : [];
  const attachments = rawAttachments.map(mapMetaAttachment);
  if (!text && attachments.length === 0) return null;

  return {
    id: String(message.mid ?? Date.now()),
    channel,
    externalUserId: senderId,
    conversationId: senderId,
    text,
    timestamp: new Date(Number(messaging.timestamp ?? Date.now())),
    isDirect: true,
    isMention: false,
    isCommand: text.startsWith('/'),
    attachments: attachments.length > 0 ? attachments : undefined,
    raw,
  };
}

export function formatMetaForChannel(text: string): string[] {
  return splitByLength(text, MAX_MESSAGE_LENGTH);
}

export async function sendMetaGraphMessage(
  accessToken: string,
  conversationId: string,
  text: string,
): Promise<void> {
  if (!accessToken) return;

  for (const chunk of formatMetaForChannel(text)) {
    const url = new URL(GRAPH_MESSAGES_URL);
    url.searchParams.set('access_token', accessToken);
    await fetch(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { id: conversationId },
        message: { text: chunk },
      }),
      signal: AbortSignal.timeout(15_000),
    });
  }
}

export class MetaGraphAdapter implements IChannelAdapter {
  readonly name: ChannelName;

  constructor(
    readonly enabled: boolean,
    private readonly credentials: MetaGraphCredentials,
  ) {
    this.name = credentials.channel;
  }

  parseInbound(raw: unknown): ChannelMessage | null {
    return parseMetaInbound(raw, this.credentials.channel);
  }

  async sendMessage(conversationId: string, text: string, _options?: SendOptions): Promise<void> {
    await sendMetaGraphMessage(this.credentials.accessToken, conversationId, text);
  }

  formatForChannel(text: string): string[] {
    return formatMetaForChannel(text);
  }

  validateWebhook(input: WebhookValidationInput): boolean {
    const signature = headerValue(input.headers['x-hub-signature-256']);
    const rawBody = input.rawBody ?? JSON.stringify(input.body ?? {});
    return verifyMetaHubSignature(rawBody, this.credentials.appSecret, signature);
  }

  createRouter(): Router {
    const router = express.Router();
    const jsonParser = express.json({
      verify: (req, _res, buf) => {
        (req as RequestWithRawBody).rawBody = buf;
      },
    });

    router.get('/', (req: Request, res: Response) => {
      const challenge = handleMetaWebhookChallenge(
        req.query as Record<string, unknown>,
        this.credentials.verifyToken,
      );
      if (challenge) {
        res.status(200).send(challenge);
        return;
      }
      res.sendStatus(403);
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
    return Boolean(
      this.credentials.accessToken?.trim()
      && this.credentials.verifyToken?.trim()
      && this.credentials.appSecret?.trim(),
    );
  }
}
