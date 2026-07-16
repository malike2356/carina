import crypto from 'crypto';
import type { ChannelAdapter, InboundMessage, OutboundMessage } from '../types.js';

interface SlackEventPayload {
  type?: string;
  challenge?: string;
  team_id?: string;
  event?: {
    type?: string;
    user?: string;
    text?: string;
    ts?: string;
    thread_ts?: string;
    channel?: string;
    channel_type?: string;
    bot_id?: string;
    subtype?: string;
  };
}

export const slackAdapter: ChannelAdapter = {
  channel: 'slack',

  verify(headers, rawBody) {
    const timestamp = headers['x-slack-request-timestamp'];
    const sig = headers['x-slack-signature'];
    const signingSecret = process.env.SLACK_SIGNING_SECRET?.trim();
    if (!timestamp || !sig || !signingSecret) return process.env.NODE_ENV !== 'production';
    if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
    const base = `v0:${timestamp}:${rawBody.toString()}`;
    const expected = `v0=${crypto.createHmac('sha256', signingSecret).update(base).digest('hex')}`;
    try {
      return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
    } catch {
      return false;
    }
  },

  parse(payload, workerId, workspaceId): InboundMessage | null {
    const body = payload as SlackEventPayload;
    if (body.type === 'url_verification') return null;
    const event = body.event;
    if (!event || event.type !== 'message') return null;
    if (event.bot_id || event.subtype) return null;
    const text = String(event.text ?? '').trim();
    if (!text || !event.user) return null;

    const dmChannel = event.channel_type === 'im' ? event.user : (event.channel ?? event.user);

    return {
      channel: 'slack',
      workerId,
      workspaceId,
      contactId: dmChannel,
      content: text,
      rawPayload: payload,
      timestamp: event.ts ? new Date(Number(event.ts) * 1000) : new Date(),
      threadId: event.thread_ts ?? event.ts,
    };
  },

  async send(message: OutboundMessage, credentials: Record<string, string>): Promise<void> {
    const botToken = credentials.bot_token ?? credentials.token;
    if (!botToken) throw new Error('Slack credentials missing bot_token');

    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel: message.contactId,
        text: message.content,
        ...(message.replyToThreadId ? { thread_ts: message.replyToThreadId } : {}),
      }),
    });

    const result = await response.json() as { ok?: boolean; error?: string };
    if (!result.ok) throw new Error(`Slack send failed: ${result.error ?? 'unknown'}`);
  },
};

export function extractSlackTeamId(payload: unknown): string | null {
  const body = payload as SlackEventPayload;
  return body.team_id ?? null;
}
