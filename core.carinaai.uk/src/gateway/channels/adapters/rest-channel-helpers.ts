import { formatForChannel } from '../channel-formatter.js';
import type { ChannelMessage, ChannelName, SendOptions } from '../channel-adapter.interface.js';

export interface RestInbound {
  text: string;
  userId: string;
  conversationId: string;
  messageId?: string;
  isDirect?: boolean;
  threadId?: string;
  guildId?: string;
  teamId?: string;
  chatType?: 'private' | 'group';
  chatTitle?: string;
  senderName?: string;
  replyTo?: string;
}

export function parseGenericWebhook(
  raw: unknown,
  channel: ChannelName,
  extract: (payload: Record<string, unknown>) => RestInbound | null,
): ChannelMessage | null {
  const payload = raw as Record<string, unknown>;
  const parsed = extract(payload);
  if (!parsed?.text || !parsed.userId || !parsed.conversationId) return null;

  return {
    id: parsed.messageId ?? String(Date.now()),
    channel,
    externalUserId: parsed.userId,
    conversationId: parsed.conversationId,
    text: parsed.text.trim(),
    timestamp: new Date(),
    isDirect: parsed.isDirect ?? true,
    isMention: true,
    isCommand: parsed.text.trim().startsWith('/'),
    threadId: parsed.threadId,
    guildId: parsed.guildId,
    teamId: parsed.teamId,
    chatType: parsed.chatType ?? (parsed.isDirect ? 'private' : 'group'),
    chatTitle: parsed.chatTitle,
    senderName: parsed.senderName,
    replyTo: parsed.replyTo,
    raw,
  };
}

export async function restSend(
  url: string,
  text: string,
  headers: Record<string, string> = {},
  bodyBuilder?: (chunk: string) => Record<string, unknown>,
): Promise<void> {
  const chunks = formatForChannel('web', text);
  for (const chunk of chunks) {
    const body = bodyBuilder ? bodyBuilder(chunk) : { text: chunk };
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
  }
}

export function formatChunks(text: string, channel: ChannelName): string[] {
  return formatForChannel(channel, text);
}

export async function sendWithOptions(
  sendFn: (text: string, options?: SendOptions) => Promise<void>,
  text: string,
  options: SendOptions = {},
): Promise<void> {
  for (const chunk of formatForChannel('web', text)) {
    await sendFn(chunk, options);
  }
}
