import type { ChatHistoryMessage } from '@/api/chat-history-client';
import type { ChatMessage } from '@/api/types';

export function mergeMessages(
  local: ChatMessage[],
  server: ChatHistoryMessage[],
): ChatMessage[] {
  const localIds = new Set(local.map((m) => m.id));
  const localContent = new Set(local.map((m) => m.content.slice(0, 40)));

  const merged = [...local];

  for (const srv of server) {
    if (localIds.has(srv.id)) continue;
    const prefix = srv.content.slice(0, 40);
    if (localContent.has(prefix)) continue;

    merged.push({
      id: srv.id,
      role: srv.role,
      content: srv.content,
      createdAt: srv.createdAt,
      status: 'done',
      source: srv.source,
    });
    localContent.add(prefix);
  }

  merged.sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  return merged;
}
