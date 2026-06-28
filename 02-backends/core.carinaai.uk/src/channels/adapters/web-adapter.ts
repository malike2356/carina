import type { ChannelAdapter, InboundMessage, OutboundMessage } from '../types.js';

const pendingReplies = new Map<string, string[]>();

export const webAdapter: ChannelAdapter = {
  channel: 'web',

  verify() {
    return true;
  },

  parse(payload, workerId, workspaceId): InboundMessage | null {
    const body = payload as { contactId?: string; content?: string; sessionToken?: string };
    const contactId = body.contactId ?? body.sessionToken;
    const content = String(body.content ?? '').trim();
    if (!contactId || !content) return null;

    return {
      channel: 'web',
      workerId,
      workspaceId,
      contactId,
      content,
      rawPayload: payload,
      timestamp: new Date(),
      threadId: body.sessionToken,
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
