import type { ChatMessage } from '../store/chat.js';

export interface SessionInfo {
  sessionId: string;
  agentId: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  title?: string;
}

const SESSIONS_KEY = 'carina_desktop_sessions';
const MESSAGES_KEY = 'carina_desktop_messages';

type StoredSession = {
  id: string;
  preview: string;
  at: number;
};

type MessagesStore = Record<string, ChatMessage[]>;

function readSessions(): StoredSession[] {
  try {
    return JSON.parse(localStorage.getItem(SESSIONS_KEY) || '[]') as StoredSession[];
  } catch {
    return [];
  }
}

function writeSessions(sessions: StoredSession[]): void {
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions.slice(0, 50)));
}

function readMessagesStore(): MessagesStore {
  try {
    return JSON.parse(localStorage.getItem(MESSAGES_KEY) || '{}') as MessagesStore;
  } catch {
    return {};
  }
}

function writeMessagesStore(store: MessagesStore): void {
  localStorage.setItem(MESSAGES_KEY, JSON.stringify(store));
}

export function toSessionInfo(entry: StoredSession, messageCount = 0): SessionInfo {
  return {
    sessionId: entry.id,
    agentId: 'main',
    createdAt: new Date(entry.at).toISOString(),
    updatedAt: new Date(entry.at).toISOString(),
    messageCount,
    title: entry.preview || 'New session',
  };
}

export function listLocalSessions(): SessionInfo[] {
  const store = readMessagesStore();
  return readSessions().map((entry) => toSessionInfo(entry, store[entry.id]?.length ?? 0));
}

export function createLocalSession(): SessionInfo {
  const id = crypto.randomUUID();
  const entry: StoredSession = { id, preview: 'New session', at: Date.now() };
  writeSessions([entry, ...readSessions()]);
  return toSessionInfo(entry, 0);
}

export function touchLocalSession(sessionId: string, preview: string): void {
  const sessions = readSessions().filter((s) => s.id !== sessionId);
  sessions.unshift({
    id: sessionId,
    preview: preview.slice(0, 60) || 'New session',
    at: Date.now(),
  });
  writeSessions(sessions);
}

export function loadLocalMessages(sessionId: string): ChatMessage[] {
  return readMessagesStore()[sessionId] ?? [];
}

export function saveLocalMessages(sessionId: string, messages: ChatMessage[]): void {
  const store = readMessagesStore();
  store[sessionId] = messages;
  writeMessagesStore(store);
  const preview = messages.find((m) => m.role === 'user')?.content
    ?? messages.find((m) => m.role === 'assistant')?.content
    ?? 'New session';
  touchLocalSession(sessionId, preview);
}

export function renameLocalSession(sessionId: string, title: string): void {
  const sessions = readSessions();
  const next = sessions.map((entry) =>
    entry.id === sessionId ? { ...entry, preview: title.slice(0, 60) || 'New session' } : entry,
  );
  writeSessions(next);
}

export function deleteLocalSession(sessionId: string): void {
  writeSessions(readSessions().filter((entry) => entry.id !== sessionId));
  const store = readMessagesStore();
  delete store[sessionId];
  writeMessagesStore(store);
}
