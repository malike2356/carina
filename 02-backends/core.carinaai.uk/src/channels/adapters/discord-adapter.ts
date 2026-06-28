import type { ChannelAdapter, InboundMessage, OutboundMessage } from '../types.js';

interface DiscordMessagePayload {
  channel_id?: string;
  channelId?: string;
  content?: string;
  author?: { bot?: boolean; id?: string; username?: string };
}

export const discordAdapter: ChannelAdapter = {
  channel: 'discord',

  verify() {
    return true;
  },

  parse(payload, workerId, workspaceId): InboundMessage | null {
    const body = payload as DiscordMessagePayload;
    if (body.author?.bot) return null;
    const content = String(body.content ?? '').trim();
    const channelId = String(body.channel_id ?? body.channelId ?? '');
    if (!content || !channelId) return null;

    return {
      channel: 'discord',
      workerId,
      workspaceId,
      contactId: channelId,
      contactName: body.author?.username,
      content,
      rawPayload: payload,
      timestamp: new Date(),
    };
  },

  async send(message: OutboundMessage, credentials: Record<string, string>): Promise<void> {
    const botToken = credentials.bot_token?.trim();
    if (!botToken) throw new Error('Discord credentials missing bot_token');

    const response = await fetch(
      `https://discord.com/api/v10/channels/${encodeURIComponent(message.contactId)}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bot ${botToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: message.content,
          ...(message.replyToThreadId ? { message_reference: { message_id: message.replyToThreadId } } : {}),
        }),
        signal: AbortSignal.timeout(15_000),
      },
    );

    if (!response.ok) {
      const error = await response.text().catch(() => '');
      throw new Error(`Discord send failed: ${error || response.status}`);
    }
  },
};
