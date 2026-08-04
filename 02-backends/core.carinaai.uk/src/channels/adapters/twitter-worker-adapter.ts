import type { ChannelAdapter, InboundMessage, OutboundMessage } from '../types.js';
import {
  parseTwitterInbound,
} from '../../gateway/channels/adapters/twitter-adapter.js';
import {
  buildTwitterCrcResponse,
  formatOAuth1AuthorizationHeader,
  signOAuth1Request,
  verifyTwitterWebhookSignature,
} from '../../gateway/channels/adapters/twitter-oauth.js';
import { splitByLength } from '../../gateway/channels/channel-formatter.js';

const DM_API_BASE = 'https://api.twitter.com/2/dm_conversations/with';
const MAX_MESSAGE_LENGTH = 10_000;

export function resolveTwitterApiKey(credentials: Record<string, string>): string {
  return process.env.TWITTER_API_KEY?.trim()
    ?? process.env.TWITTER_CONSUMER_KEY?.trim()
    ?? credentials.api_key?.trim()
    ?? '';
}

export function resolveTwitterApiSecret(credentials: Record<string, string>): string {
  return process.env.TWITTER_API_SECRET?.trim()
    ?? process.env.TWITTER_CONSUMER_SECRET?.trim()
    ?? credentials.api_secret?.trim()
    ?? '';
}

export function resolveTwitterConsumerSecret(credentials: Record<string, string>): string {
  return process.env.TWITTER_CONSUMER_SECRET?.trim()
    ?? process.env.TWITTER_API_SECRET?.trim()
    ?? credentials.api_secret?.trim()
    ?? '';
}

export const twitterWorkerAdapter: ChannelAdapter = {
  channel: 'twitter',

  verify(headers, rawBody, credentials = {}) {
    const consumerSecret = resolveTwitterConsumerSecret(credentials);
    const signature = headers['x-twitter-webhooks-signature'] ?? '';
    if (!consumerSecret) return process.env.NODE_ENV !== 'production';
    return verifyTwitterWebhookSignature(rawBody, consumerSecret, signature);
  },

  parse(payload, workerId, workspaceId): InboundMessage | null {
    const parsed = parseTwitterInbound(payload, '');
    if (!parsed) return null;
    return {
      channel: 'twitter',
      workerId,
      workspaceId,
      contactId: parsed.externalUserId,
      conversationId: parsed.conversationId,
      content: parsed.text,
      rawPayload: payload,
      timestamp: parsed.timestamp,
      threadId: parsed.threadId,
    };
  },

  async send(message: OutboundMessage, credentials: Record<string, string>): Promise<void> {
    const apiKey = resolveTwitterApiKey(credentials);
    const apiSecret = resolveTwitterApiSecret(credentials);
    const accessToken = credentials.access_token?.trim();
    const accessTokenSecret = credentials.access_token_secret?.trim();
    if (!apiKey || !apiSecret || !accessToken || !accessTokenSecret) {
      throw new Error('Twitter credentials missing OAuth tokens');
    }

    const recipient = message.metadata?.conversationId ?? message.contactId;
    const url = `${DM_API_BASE}/${encodeURIComponent(recipient)}/messages`;
    for (const chunk of splitByLength(message.content, MAX_MESSAGE_LENGTH)) {
      const oauthParams = signOAuth1Request({
        method: 'POST',
        url,
        consumerKey: apiKey,
        consumerSecret: apiSecret,
        accessToken,
        accessTokenSecret,
      });
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: formatOAuth1AuthorizationHeader(oauthParams),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: chunk }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) {
        const error = await response.text().catch(() => '');
        throw new Error(`Twitter send failed: ${error || response.status}`);
      }
    }
  },
};

function credentialsUserId(credentials: Record<string, string>): string {
  return credentials.user_id?.trim() ?? '';
}

export function parseTwitterWorkerInbound(
  payload: unknown,
  workerId: string,
  workspaceId: string,
  credentials: Record<string, string>,
): InboundMessage | null {
  const parsed = parseTwitterInbound(payload, credentialsUserId(credentials));
  if (!parsed) return null;
  return {
    channel: 'twitter',
    workerId,
    workspaceId,
    contactId: parsed.externalUserId,
    conversationId: parsed.conversationId,
    content: parsed.text,
    rawPayload: payload,
    timestamp: parsed.timestamp,
    threadId: parsed.threadId,
  };
}

export function buildTwitterWorkerCrcResponse(
  crcToken: string,
  credentials: Record<string, string>,
): { response_token: string } | null {
  const consumerSecret = resolveTwitterConsumerSecret(credentials);
  if (!consumerSecret) return null;
  return buildTwitterCrcResponse(crcToken, consumerSecret);
}
