type SlackConversationsClient = {
  replies: (args: { channel: string; ts: string; limit?: number }) => Promise<{
    messages?: Array<{ user?: string; text?: string; ts?: string }>;
  }>;
};

export async function fetchSlackThreadContext(
  client: SlackConversationsClient | undefined,
  channelId: string,
  threadTs: string,
  limit = 50,
): Promise<string> {
  if (!client?.replies) return '';

  try {
    const result = await client.replies({ channel: channelId, ts: threadTs, limit });
    const messages = result.messages ?? [];
    if (messages.length === 0) return '';

    return messages
      .filter((m) => m.text)
      .map((m) => `[${m.user ?? 'unknown'}] ${String(m.text).trim()}`)
      .join('\n');
  } catch {
    return '';
  }
}

export function buildThreadContextSuffix(threadContext: string): string {
  if (!threadContext.trim()) return '';
  return ['', '## Thread Context', threadContext, ''].join('\n');
}
