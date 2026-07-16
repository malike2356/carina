import type { ChannelAdapter, InboundMessage, OutboundMessage } from '../types.js';
import {
  parseLinkedInInbound,
  verifyLinkedInSignature,
} from '../../gateway/channels/adapters/linkedin-adapter.js';
import { splitByLength } from '../../gateway/channels/channel-formatter.js';

const LINKEDIN_MESSAGES_URL = 'https://api.linkedin.com/v2/messages';
const MAX_MESSAGE_LENGTH = 8000;

export const linkedinWorkerAdapter: ChannelAdapter = {
  channel: 'linkedin',

  verify(headers, rawBody, credentials = {}) {
    const secret = credentials.webhook_secret?.trim() ?? '';
    const signature = headers['x-li-signature'] ?? '';
    if (!secret) return process.env.NODE_ENV !== 'production';
    return verifyLinkedInSignature(rawBody, secret, signature);
  },

  parse(payload, workerId, workspaceId): InboundMessage | null {
    const parsed = parseLinkedInInbound(payload);
    if (!parsed) return null;
    return {
      channel: 'linkedin',
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
    const accessToken = credentials.access_token?.trim();
    if (!accessToken) {
      throw new Error('LinkedIn credentials missing access_token');
    }

    const recipient = message.metadata?.conversationId ?? message.contactId;
    for (const chunk of splitByLength(message.content, MAX_MESSAGE_LENGTH)) {
      const response = await fetch(LINKEDIN_MESSAGES_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipients: [{ person: recipient }],
          subject: '',
          body: chunk,
        }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) {
        const error = await response.text().catch(() => '');
        throw new Error(`LinkedIn send failed: ${error || response.status}`);
      }
    }
  },
};
