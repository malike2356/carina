import type { ChatMessage } from '@/components/chat/types';

type DeletedMessageSnapshot = ChatMessage;

function key(sessionId: string): string {
  return `carina.chat.deleted:${sessionId.trim() || 'default'}`;
}

function readRaw(sessionId: string): DeletedMessageSnapshot[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(key(sessionId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DeletedMessageSnapshot[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item && typeof item.id === 'string');
  } catch {
    return [];
  }
}

function writeRaw(sessionId: string, snapshots: DeletedMessageSnapshot[]): void {
  if (typeof window === 'undefined') return;
  if (snapshots.length === 0) {
    window.localStorage.removeItem(key(sessionId));
    return;
  }
  window.localStorage.setItem(key(sessionId), JSON.stringify(snapshots));
}

export function loadDeletedMessageSnapshots(sessionId: string): Map<string, DeletedMessageSnapshot> {
  return new Map(readRaw(sessionId).map((snapshot) => [snapshot.id, snapshot]));
}

export function saveDeletedMessageSnapshot(sessionId: string, message: ChatMessage): void {
  const snapshots = readRaw(sessionId);
  if (snapshots.some((item) => item.id === message.id)) return;
  snapshots.push(message);
  writeRaw(sessionId, snapshots);
}

export function removeDeletedMessageSnapshot(sessionId: string, messageId: string): void {
  const snapshots = readRaw(sessionId).filter((item) => item.id !== messageId);
  writeRaw(sessionId, snapshots);
}
