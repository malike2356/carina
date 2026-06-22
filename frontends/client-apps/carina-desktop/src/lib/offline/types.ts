import type { ChatMessage } from '../../store/chat.js';

export type SyncStatus = 'synced' | 'syncing' | 'offline' | 'pending';

export interface CachedMemory {
  id: string;
  title: string;
  content: string;
  tags: string[];
  projectId?: string;
  updatedAt: string;
  syncedAt: string | null;
}

export interface CachedSessionMeta {
  sessionId: string;
  title: string;
  updatedAt: string;
  syncedAt: string | null;
  pendingPush: boolean;
}

export interface SyncMeta {
  lastSyncAt: string | null;
  pendingChanges: number;
}

export interface OutboxEntry {
  id: string;
  sessionId: string;
  content: string;
  turnId: string;
  createdAt: string;
}

export interface MemoryRecordPayload {
  id: string;
  category?: string;
  content: string;
  priority?: number;
  created_at: string;
  updated_at: string;
}

export interface MemorySessionPayload {
  session_id: string;
  title: string;
  last_active: string;
  preview?: string;
}

export interface ScrollMessagePayload {
  id: string;
  role: string;
  content: string;
  createdAt: string;
}

export interface ScrollPagePayload {
  sessionId: string;
  messages: ScrollMessagePayload[];
  hasOlder: boolean;
  hasNewer: boolean;
}

export type { ChatMessage };
