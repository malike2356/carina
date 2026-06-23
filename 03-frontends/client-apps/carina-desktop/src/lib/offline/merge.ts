import type { ChatMessage } from '../../store/chat.js';
import type { CachedMemory } from './types.js';

export function mergeSessionMessages(local: ChatMessage[], server: ChatMessage[]): ChatMessage[] {
  const byId = new Map<string, ChatMessage>();
  for (const message of server) {
    byId.set(message.id, message);
  }
  for (const message of local) {
    if (!byId.has(message.id)) {
      byId.set(message.id, message);
    }
  }
  return [...byId.values()].sort((a, b) => a.timestamp - b.timestamp);
}

export function hasPendingLocalMessages(local: ChatMessage[], server: ChatMessage[]): boolean {
  const serverIds = new Set(server.map((m) => m.id));
  return local.some((m) => !serverIds.has(m.id));
}

export function memoryNeedsConflict(local: CachedMemory, server: CachedMemory): boolean {
  if (local.updatedAt === server.updatedAt) return false;
  if (local.syncedAt && local.updatedAt <= local.syncedAt) return false;
  return local.content.trim() !== server.content.trim();
}

export function pickMemoryWinner(
  local: CachedMemory,
  server: CachedMemory,
  prefer: 'local' | 'server',
): CachedMemory {
  if (prefer === 'local') return { ...local, syncedAt: new Date().toISOString() };
  return { ...server, syncedAt: new Date().toISOString() };
}

export function scrollToChatMessages(messages: Array<{
  id: string;
  role: string;
  content: string;
  createdAt: string;
}>): ChatMessage[] {
  return messages.map((message) => ({
    id: message.id,
    role: message.role === 'assistant' || message.role === 'tool' ? message.role : 'user',
    content: message.content,
    timestamp: new Date(message.createdAt).getTime(),
  }));
}
