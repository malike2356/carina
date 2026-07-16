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

const GROUPME_POST_URL = 'https://api.groupme.com/v3/bots/post';
const MAX_MESSAGE_LENGTH = 450;
const RATE_LIMIT_MAX = 120;
const RATE_LIMIT_WINDOW_MS = 60_000;

type GroupMeAttachment = {
  type?: string;
  user_ids?: string[];
};

type GroupMeInbound = {
  id?: string | number;
  name?: string;
  user_id?: string;
  group_id?: string;
  text?: string;
  sender_type?: string;
  attachments?: GroupMeAttachment[];
};

const rateLimitByIp = new Map<string, { count: number; resetAt: number }>();

export function checkGroupMeRateLimit(ip: string, now = Date.now()): boolean {
  const entry = rateLimitByIp.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitByIp.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count += 1;
  return true;
}

export function resetGroupMeRateLimit(): void {
  rateLimitByIp.clear();
}

export function parseGroupMeInbound(
  raw: unknown,
  botUserId = '',
): ChannelMessage | null {
  const payload = raw as GroupMeInbound;
  if (payload.sender_type === 'bot') return null;

  const text = String(payload.text ?? '').trim();
  const userId = String(payload.user_id ?? '');
  const groupId = String(payload.group_id ?? '');
  if (!text || !userId || !groupId) return null;

  const mentionUserId = botUserId.trim();
  const isMention = mentionUserId
    ? (payload.attachments ?? []).some(
      (attachment) => attachment.type === 'mentions'
        && (attachment.user_ids ?? []).includes(mentionUserId),
    )
    : false;

  return {
    id: String(payload.id ?? Date.now()),
    channel: 'groupme',
    externalUserId: userId,
    conversationId: groupId,
    text,
    timestamp: new Date(),
    isDirect: false,
    isMention,
    isCommand: text.startsWith('!'),
    chatType: 'group',
    senderName: payload.name ? String(payload.name) : undefined,
    raw,
  };
}

export class GroupMeAdapter implements IChannelAdapter {
  readonly name = 'groupme' as const;

  constructor(
    readonly enabled: boolean,
    private readonly botId = config.groupme.botId,
    private readonly botUserId = config.groupme.botUserId || config.groupme.botId,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  parseInbound(raw: unknown): ChannelMessage | null {
    return parseGroupMeInbound(raw, this.botUserId);
  }

  async sendMessage(_conversationId: string, text: string, _options?: SendOptions): Promise<void> {
    if (!this.botId) return;

    for (const chunk of this.formatForChannel(text)) {
      await this.fetchImpl(GROUPME_POST_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bot_id: this.botId, text: chunk }),
        signal: AbortSignal.timeout(15_000),
      });
    }
  }

  formatForChannel(text: string): string[] {
    return splitByLength(text, MAX_MESSAGE_LENGTH);
  }

  validateWebhook(_input: WebhookValidationInput): boolean {
    return this.enabled;
  }

  createRouter(): Router {
    const router = express.Router();

    router.post('/', express.json(), async (req: Request, res: Response) => {
      const ip = req.ip || req.socket.remoteAddress || 'unknown';
      if (!checkGroupMeRateLimit(ip)) {
        res.status(429).json({ error: 'rate limit exceeded' });
        return;
      }

      if (!this.validateWebhook({
        headers: req.headers as Record<string, string | string[] | undefined>,
        body: req.body,
        url: req.url,
        method: req.method,
      })) {
        res.status(401).json({ error: 'invalid webhook' });
        return;
      }

      try {
        const gateway = getRouter();
        const chunks: string[] = [];
        for await (const chunk of gateway.handleInbound('groupme', req.body)) {
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
    return Boolean(this.botId?.trim());
  }
}
