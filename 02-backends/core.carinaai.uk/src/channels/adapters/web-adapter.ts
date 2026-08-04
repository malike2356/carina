import type { ChannelAdapter, InboundMessage, OutboundMessage } from '../types.js';
import { normalizeWebContactIdInput } from '../../memory/aiva/contact-normalizer.js';

const pendingReplies = new Map<string, string[]>();

export const webAdapter: ChannelAdapter = {
  channel: 'web',

  verify() {
    return true;
  },

  parse(payload, workerId, workspaceId): InboundMessage | null {
    const body = payload as {
      contactId?: string;
      content?: string;
      sessionToken?: string;
      authenticatedUserId?: string;
      email?: string;
    };
    const rawContactId = String(body.contactId ?? body.sessionToken ?? '').trim();
    const content = String(body.content ?? '').trim();
    if (!rawContactId || !content) return null;

    const sessionToken = String(body.sessionToken ?? '').trim() || undefined;
    const authenticatedUserId = String(body.authenticatedUserId ?? '').trim() || undefined;
    const contactId = normalizeWebContactIdInput({
      rawContactId,
      sessionToken,
      authenticatedUserId,
    });

    return {
      channel: 'web',
      workerId,
      workspaceId,
      contactId,
      content,
      rawPayload: payload,
      timestamp: new Date(),
      threadId: sessionToken ?? body.sessionToken,
      metadata: {
        ...(sessionToken ? { sessionToken } : {}),
        ...(authenticatedUserId ? { authenticatedUserId } : {}),
        ...(body.email ? { email: String(body.email) } : {}),
        rawContactId,
      },
    };
  },

  async send(message: OutboundMessage): Promise<void> {
    const key = message.metadata?.sessionToken ?? message.contactId;
    const queue = pendingReplies.get(key) ?? [];
    queue.push(message.content);
    pendingReplies.set(key, queue);
  },
};

export function drainWebReplies(sessionToken: string): string[] {
  const queue = pendingReplies.get(sessionToken) ?? [];
  pendingReplies.delete(sessionToken);
  return queue;
}

export function queueWebReply(sessionToken: string, content: string): void {
  const queue = pendingReplies.get(sessionToken) ?? [];
  queue.push(content);
  pendingReplies.set(sessionToken, queue);
}

export type { InboundMessage, OutboundMessage };
