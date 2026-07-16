import type { ChannelAdapter, InboundMessage, OutboundMessage } from '../types.js';
import {
  parseTikTokWebhookPayload,
  sendTikTokTextMessage,
  verifyTikTokWebhookSignature,
} from '../../ingestion/social/tiktok-messaging.js';
import { splitByLength } from '../../gateway/channels/channel-formatter.js';

const MAX_MESSAGE_LENGTH = 2000;

function businessOpenId(credentials: Record<string, string>): string {
  return credentials.open_id?.trim() ?? credentials.business_id?.trim() ?? '';
}

export const tiktokWorkerAdapter: ChannelAdapter = {
  channel: 'tiktok',

  verify(headers, rawBody, credentials = {}) {
    return verifyTikTokWebhookSignature(headers, rawBody, credentials);
  },

  parse(payload, workerId, workspaceId): InboundMessage | null {
    return parseTikTokWebhookPayload(payload, workerId, workspaceId, businessOpenId({}));
  },

  async send(message: OutboundMessage, credentials: Record<string, string>): Promise<void> {
    const conversationId = message.metadata?.conversationId ?? message.contactId;
    for (const chunk of splitByLength(message.content, MAX_MESSAGE_LENGTH)) {
      await sendTikTokTextMessage(
        { contactId: message.contactId, conversationId, content: chunk },
        credentials,
      );
    }
  },
};

export function parseTikTokWorkerInbound(
  payload: unknown,
  workerId: string,
  workspaceId: string,
  credentials: Record<string, string>,
): InboundMessage | null {
  return parseTikTokWebhookPayload(payload, workerId, workspaceId, businessOpenId(credentials));
}
