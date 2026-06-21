import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ChatMessage, ChatSessionMeta, SessionPrefs } from '@/api/types';
import { listStoredSessionIds, loadChatMessages } from './chat-session';
import { loadAllSessionPrefs, loadSessionPrefs, removeSessionPrefs } from './session-prefs';

const INDEX_KEY = 'carina.chat.sessions.index';

export function deriveSessionTitle(messages: ChatMessage[]): string {
  const firstUser = messages.find((msg) => msg.role === 'user' && msg.content.trim());
  if (!firstUser) return 'New chat';
  const text = firstUser.content.trim();
  if (text.length <= 56) return text;
  return `${text.slice(0, 55)}…`;
}

export function deriveSessionPreview(messages: ChatMessage[]): string {
  const reversed = [...messages].reverse();
  const last = reversed.find((msg) => msg.content.trim() && msg.status !== 'streaming');
  if (!last) return 'No messages yet';
  const text = last.content.trim();
  if (text.length <= 72) return text;
  return `${text.slice(0, 71)}…`;
}

export function displaySessionTitle(meta: ChatSessionMeta): string {
  return meta.customTitle?.trim() || meta.title;
}

export function applySessionPrefs(
  meta: ChatSessionMeta,
  prefs: SessionPrefs,
): ChatSessionMeta {
  return {
    ...meta,
    customTitle: prefs.customTitle,
    pinned: prefs.pinned,
    pinnedAt: prefs.pinnedAt,
  };
}

export function sortSessionList(items: ChatSessionMeta[]): ChatSessionMeta[] {
  return [...items].sort((a, b) => {
    const aPinned = Boolean(a.pinned);
    const bPinned = Boolean(b.pinned);
    if (aPinned !== bPinned) return aPinned ? -1 : 1;
    if (aPinned && bPinned) {
      const pinDiff =
        new Date(b.pinnedAt ?? b.updatedAt).getTime() -
        new Date(a.pinnedAt ?? a.updatedAt).getTime();
      if (pinDiff !== 0) return pinDiff;
    }
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}

export function deriveSessionMeta(sessionId: string, messages: ChatMessage[]): ChatSessionMeta {
  const dated = messages
    .map((msg) => msg.createdAt)
    .filter(Boolean)
    .sort()
    .at(-1);

  return {
    id: sessionId,
    title: deriveSessionTitle(messages),
    preview: deriveSessionPreview(messages),
    updatedAt: dated ?? new Date().toISOString(),
    messageCount: messages.length,
  };
}

export async function loadSessionIndex(): Promise<ChatSessionMeta[]> {
  const raw = await AsyncStorage.getItem(INDEX_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as ChatSessionMeta[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveSessionIndex(items: ChatSessionMeta[]): Promise<void> {
  const sorted = sortSessionList(items);
  await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(sorted));
}

export async function upsertSessionMeta(meta: ChatSessionMeta): Promise<ChatSessionMeta[]> {
  const prefs = await loadSessionPrefs(meta.id);
  const enriched = applySessionPrefs(meta, prefs);
  const items = await loadSessionIndex();
  const next = items.filter((item) => item.id !== enriched.id);
  next.push(enriched);
  await saveSessionIndex(next);
  return sortSessionList(next);
}

export async function removeSessionMeta(sessionId: string): Promise<ChatSessionMeta[]> {
  const items = await loadSessionIndex();
  const next = items.filter((item) => item.id !== sessionId);
  await saveSessionIndex(next);
  await removeSessionPrefs(sessionId);
  return next;
}

export async function updateSessionPrefs(
  sessionId: string,
  prefs: SessionPrefs,
): Promise<ChatSessionMeta[]> {
  const messages = await loadChatMessages(sessionId);
  const base = messages.length > 0
    ? deriveSessionMeta(sessionId, messages)
    : (await loadSessionIndex()).find((item) => item.id === sessionId) ?? {
        id: sessionId,
        title: 'New chat',
        preview: 'No messages yet',
        updatedAt: new Date().toISOString(),
        messageCount: 0,
      };
  const enriched = applySessionPrefs(base, prefs);
  const items = await loadSessionIndex();
  const next = items.filter((item) => item.id !== sessionId);
  if (enriched.messageCount > 0 || prefs.customTitle || prefs.pinned) {
    next.push(enriched);
  }
  await saveSessionIndex(next);
  return sortSessionList(next);
}

export async function reconcileSessionIndex(): Promise<ChatSessionMeta[]> {
  const storedIds = await listStoredSessionIds();
  const index = await loadSessionIndex();
  const prefsMap = await loadAllSessionPrefs();
  const byId = new Map(index.map((item) => [item.id, item]));

  for (const sessionId of storedIds) {
    const messages = await loadChatMessages(sessionId);
    if (messages.length === 0) continue;
    const meta = applySessionPrefs(deriveSessionMeta(sessionId, messages), prefsMap[sessionId] ?? {});
    byId.set(sessionId, meta);
  }

  for (const [sessionId, prefs] of Object.entries(prefsMap)) {
    if (byId.has(sessionId)) continue;
    if (!prefs.customTitle && !prefs.pinned) continue;
    byId.set(sessionId, {
      id: sessionId,
      title: prefs.customTitle ?? 'New chat',
      preview: 'No messages yet',
      updatedAt: prefs.pinnedAt ?? new Date().toISOString(),
      messageCount: 0,
      ...prefs,
    });
  }

  const merged = [...byId.values()].filter(
    (item) => item.messageCount > 0 || item.customTitle || item.pinned,
  );
  await saveSessionIndex(merged);
  return merged;
}
