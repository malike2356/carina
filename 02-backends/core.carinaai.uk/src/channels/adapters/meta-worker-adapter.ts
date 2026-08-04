import type { ChannelAdapter, InboundMessage, OutboundMessage } from '../types.js';
import {
  handleMetaWebhookChallenge,
  parseMetaInbound,
  sendMetaGraphMessage,
  verifyMetaHubSignature,
} from '../../gateway/channels/adapters/meta-graph-base.js';

type MetaWorkerChannel = 'instagram' | 'messenger';

function resolveMetaAppSecret(credentials: Record<string, string>): string {
  return process.env.META_APP_SECRET?.trim()
    ?? process.env.FACEBOOK_APP_SECRET?.trim()
    ?? credentials.app_secret?.trim()
    ?? '';
}

function createMetaWorkerAdapter(channel: MetaWorkerChannel): ChannelAdapter {
  return {
    channel,

    verify(headers, rawBody, credentials = {}) {
      const appSecret = resolveMetaAppSecret(credentials);
      const signature = headers['x-hub-signature-256'] ?? '';
      if (!appSecret) return process.env.NODE_ENV !== 'production';
      return verifyMetaHubSignature(rawBody, appSecret, signature);
    },

    parse(payload, workerId, workspaceId): InboundMessage | null {
      const parsed = parseMetaInbound(payload, channel);
      if (!parsed) return null;
      return {
        channel,
        workerId,
        workspaceId,
        contactId: parsed.externalUserId,
        conversationId: parsed.conversationId,
        content: parsed.text,
        rawPayload: payload,
        timestamp: parsed.timestamp,
        threadId: parsed.threadId,
        attachments: parsed.attachments?.map((item) => ({
          type: item.contentType || 'file',
          url: item.url ?? '',
        })),
      };
    },

    async send(message: OutboundMessage, credentials: Record<string, string>): Promise<void> {
      const accessToken = credentials.page_access_token?.trim();
      if (!accessToken) {
        throw new Error('Meta credentials missing page_access_token');
      }
      const recipient = message.metadata?.conversationId ?? message.contactId;
      await sendMetaGraphMessage(accessToken, recipient, message.content);
    },
  };
}

export const instagramWorkerAdapter = createMetaWorkerAdapter('instagram');
export const messengerWorkerAdapter = createMetaWorkerAdapter('messenger');

export function resolveMetaVerifyToken(credentials: Record<string, string>): string {
  return credentials.verify_token?.trim() ?? '';
}

export function handleMetaWorkerWebhookChallenge(
  query: Record<string, unknown>,
  credentials: Record<string, string>,
): string | null {
  return handleMetaWebhookChallenge(query, resolveMetaVerifyToken(credentials));
}
