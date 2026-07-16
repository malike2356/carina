import {
  cacheSessionFromInfo,
  dequeueOutbox,
  enqueueOutbox,
  getCachedSessionMessages,
  getSyncMeta,
  initOfflineCache,
  listCachedMemories,
  listOutbox,
  listSessionMeta,
  markSessionPending,
  markSessionSynced,
  recalcPendingChanges,
  setSyncMeta,
  upsertCachedMemory,
} from './cache.js';
import type { OutboxEntry } from './types.js';
import { mergeSessionMessages, scrollToChatMessages } from './merge.js';
import type { CachedMemory, MemoryRecordPayload, MemorySessionPayload } from './types.js';
import {
  fetchMemoryRecords,
  fetchMemorySessions,
  scrollSessionMessages,
  toSessionInfoFromMemory,
} from '../gateway-client.js';
import { listLocalSessions, saveLocalMessages, type SessionInfo } from '../session-store.js';
import { $streamRequest } from '../../store/chat.js';
import { $sessions } from '../../store/session.js';
import { refreshSyncMeta, setSyncRunning, $syncError } from '../../store/sync.js';

const SYNC_INTERVAL_MS = 5 * 60 * 1000;

let syncTimer: ReturnType<typeof setInterval> | null = null;
let syncing = false;

function memoryToCached(record: MemoryRecordPayload): CachedMemory {
  const title = record.content.split('\n')[0]?.slice(0, 80) || record.category || 'Memory';
  return {
    id: record.id,
    title,
    content: record.content,
    tags: record.category ? [record.category] : [],
    updatedAt: record.updated_at,
    syncedAt: new Date().toISOString(),
  };
}

function mergeSessions(remote: SessionInfo[], local: SessionInfo[]): SessionInfo[] {
  const byId = new Map<string, SessionInfo>();
  for (const session of remote) byId.set(session.sessionId, session);
  for (const session of local) {
    const existing = byId.get(session.sessionId);
    if (!existing || session.updatedAt > existing.updatedAt) {
      byId.set(session.sessionId, session);
    }
  }
  return [...byId.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

async function pullSessions(since: string): Promise<void> {
  const remoteSessions = await fetchMemorySessions();
  const localSessions = listLocalSessions();
  const merged = mergeSessions(
    remoteSessions.map(toSessionInfoFromMemory),
    localSessions,
  );

  for (const session of merged) {
    const remoteAt = new Date(session.updatedAt).getTime();
    const sinceAt = new Date(since).getTime();
    const localMessages = getCachedSessionMessages(session.sessionId);
    if (remoteAt >= sinceAt || localMessages.length === 0) {
      try {
        const page = await scrollSessionMessages(session.sessionId, { limit: 100 });
        const serverMessages = scrollToChatMessages(page.messages);
        const mergedMessages = mergeSessionMessages(localMessages, serverMessages);
        saveLocalMessages(session.sessionId, mergedMessages);
        cacheSessionFromInfo(session, mergedMessages);
      } catch {
        if (localMessages.length > 0) {
          cacheSessionFromInfo(session, localMessages);
        }
      }
    }
  }

  $sessions.set(merged);
}

async function pullMemories(since: string): Promise<void> {
  const sinceAt = new Date(since).getTime();
  const records = await fetchMemoryRecords();
  const localById = new Map(listCachedMemories().map((m) => [m.id, m]));

  for (const record of records) {
    const updatedAt = new Date(record.updated_at).getTime();
    if (updatedAt < sinceAt) continue;
    const server = memoryToCached(record);
    const local = localById.get(record.id);
    if (!local || local.content !== server.content) {
      upsertCachedMemory(server);
    }
  }
}

async function pushPendingSessions(): Promise<void> {
  const pending = listSessionMeta().filter((s) => s.pendingPush);
  for (const session of pending) {
    markSessionSynced(session.sessionId);
  }
}

function flushOutboxEntry(entry: OutboxEntry): void {
  $streamRequest.set({
    sessionId: entry.sessionId,
    message: entry.content,
    turnId: entry.turnId,
  });
  dequeueOutbox(entry.id);
}

async function pushOutbox(isOnline: boolean): Promise<void> {
  if (!isOnline) return;
  const outbox = listOutbox();
  if (outbox.length === 0) return;
  const next = outbox[0];
  if (!next || $streamRequest.get()) return;
  flushOutboxEntry(next);
}

export async function runSync(isOnline: boolean): Promise<void> {
  if (syncing) return;
  syncing = true;
  $syncError.set(null);
  try {
    await initOfflineCache();
    const meta = getSyncMeta();
    const since = meta.lastSyncAt ?? '1970-01-01T00:00:00.000Z';

    if (isOnline) {
      setSyncRunning('pull');
      try {
        await pullSessions(since);
        await pullMemories(since);
      } catch (err) {
        $syncError.set(err instanceof Error ? err.message : 'Pull failed');
      }
      setSyncRunning('push');
      await pushPendingSessions();
      await pushOutbox(isOnline);
      setSyncMeta({
        lastSyncAt: new Date().toISOString(),
        pendingChanges: getSyncMeta().pendingChanges,
      });
    }

    recalcPendingChanges();
    refreshSyncMeta();
  } catch (err) {
    $syncError.set(err instanceof Error ? err.message : 'Sync failed');
    recalcPendingChanges();
    refreshSyncMeta();
  } finally {
    setSyncRunning('idle');
    syncing = false;
  }
}

export function noteOfflineSession(session: SessionInfo): void {
  markSessionPending(session.sessionId, session.title);
  refreshSyncMeta();
}

export function noteOfflineMessage(sessionId: string, content: string, turnId: string): void {
  enqueueOutbox({
    id: `outbox-${turnId}`,
    sessionId,
    content,
    turnId,
    createdAt: new Date().toISOString(),
  });
  markSessionPending(sessionId);
  refreshSyncMeta();
}

export function startBackgroundSync(isOnline: () => boolean): () => void {
  void runSync(isOnline());

  syncTimer = setInterval(() => {
    if (isOnline()) void runSync(true);
  }, SYNC_INTERVAL_MS);

  const onOnline = () => void runSync(true);
  window.addEventListener('online', onOnline);

  return () => {
    if (syncTimer) clearInterval(syncTimer);
    syncTimer = null;
    window.removeEventListener('online', onOnline);
  };
}

export function mergeRemoteSessions(payload: MemorySessionPayload[]): SessionInfo[] {
  return mergeSessions(payload.map(toSessionInfoFromMemory), listLocalSessions());
}
