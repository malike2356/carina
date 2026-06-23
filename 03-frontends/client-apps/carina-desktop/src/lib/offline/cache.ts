import type { ChatMessage } from '../../store/chat.js';
import {
  loadLocalMessages,
  saveLocalMessages,
  listLocalSessions,
  type SessionInfo,
} from '../session-store.js';
import type { CachedMemory, CachedSessionMeta, OutboxEntry, SyncMeta } from './types.js';

const META_KEY = 'carina_offline_sync_meta';
const MEMORIES_KEY = 'carina_offline_memories';
const SESSION_META_KEY = 'carina_offline_session_meta';
const OUTBOX_KEY = 'carina_offline_outbox';

type SqlDb = {
  execute: (query: string, bindValues?: unknown[]) => Promise<{ rowsAffected: number }>;
  select: <T>(query: string, bindValues?: unknown[]) => Promise<T[]>;
};

let sqlDb: SqlDb | null = null;
let sqlReady = false;

function readJson<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

async function ensureSql(): Promise<SqlDb | null> {
  if (sqlReady) return sqlDb;
  sqlReady = true;
  if (!isTauriRuntime()) return null;
  try {
    const Database = (await import('@tauri-apps/plugin-sql')).default;
    sqlDb = await Database.load('sqlite:carina-cache.db');
    await sqlDb.execute(`CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      title TEXT,
      messages TEXT,
      updated_at TEXT,
      synced_at TEXT,
      pending_push INTEGER DEFAULT 0
    )`);
    await sqlDb.execute(`CREATE TABLE IF NOT EXISTS memories (
      id TEXT PRIMARY KEY,
      title TEXT,
      content TEXT,
      tags TEXT,
      project_id TEXT,
      updated_at TEXT,
      synced_at TEXT
    )`);
    await sqlDb.execute(`CREATE TABLE IF NOT EXISTS sync_meta (
      key TEXT PRIMARY KEY,
      value TEXT
    )`);
    await sqlDb.execute(`CREATE TABLE IF NOT EXISTS outbox (
      id TEXT PRIMARY KEY,
      session_id TEXT,
      content TEXT,
      turn_id TEXT,
      created_at TEXT
    )`);
    await migrateLocalStorageToSql(sqlDb);
  } catch {
    sqlDb = null;
  }
  return sqlDb;
}

async function migrateLocalStorageToSql(db: SqlDb): Promise<void> {
  const existing = await db.select<{ count: number }>('SELECT COUNT(*) as count FROM sessions');
  if ((existing[0]?.count ?? 0) > 0) return;

  for (const session of listLocalSessions()) {
    const messages = loadLocalMessages(session.sessionId);
    await db.execute(
      'INSERT OR REPLACE INTO sessions VALUES (?, ?, ?, ?, ?, ?)',
      [
        session.sessionId,
        session.title ?? 'New session',
        JSON.stringify(messages),
        session.updatedAt,
        null,
        0,
      ],
    );
  }

  const memories = readJson<CachedMemory[]>(MEMORIES_KEY, []);
  for (const memory of memories) {
    await db.execute(
      'INSERT OR REPLACE INTO memories VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        memory.id,
        memory.title,
        memory.content,
        JSON.stringify(memory.tags),
        memory.projectId ?? null,
        memory.updatedAt,
        memory.syncedAt,
      ],
    );
  }
}

export async function initOfflineCache(): Promise<void> {
  await ensureSql();
}

export function getSyncMeta(): SyncMeta {
  return readJson<SyncMeta>(META_KEY, { lastSyncAt: null, pendingChanges: 0 });
}

export function setSyncMeta(meta: SyncMeta): void {
  writeJson(META_KEY, meta);
  void persistSyncMeta(meta);
}

async function persistSyncMeta(meta: SyncMeta): Promise<void> {
  const db = await ensureSql();
  if (!db) return;
  await db.execute(
    'INSERT OR REPLACE INTO sync_meta VALUES (?, ?)',
    ['last_sync', JSON.stringify(meta)],
  );
}

export function listSessionMeta(): CachedSessionMeta[] {
  const stored = readJson<Record<string, CachedSessionMeta>>(SESSION_META_KEY, {});
  return Object.values(stored);
}

export function upsertSessionMeta(meta: CachedSessionMeta): void {
  const stored = readJson<Record<string, CachedSessionMeta>>(SESSION_META_KEY, {});
  stored[meta.sessionId] = meta;
  writeJson(SESSION_META_KEY, stored);
  void persistSessionMeta(meta);
}

async function persistSessionMeta(meta: CachedSessionMeta): Promise<void> {
  const db = await ensureSql();
  if (!db) return;
  const messages = loadLocalMessages(meta.sessionId);
  await db.execute(
    'INSERT OR REPLACE INTO sessions VALUES (?, ?, ?, ?, ?, ?)',
    [
      meta.sessionId,
      meta.title,
      JSON.stringify(messages),
      meta.updatedAt,
      meta.syncedAt,
      meta.pendingPush ? 1 : 0,
    ],
  );
}

export function markSessionPending(sessionId: string, title?: string): void {
  const existing = listSessionMeta().find((s) => s.sessionId === sessionId);
  upsertSessionMeta({
    sessionId,
    title: title ?? existing?.title ?? 'New session',
    updatedAt: new Date().toISOString(),
    syncedAt: existing?.syncedAt ?? null,
    pendingPush: true,
  });
  bumpPendingChanges(1);
}

export function markSessionSynced(sessionId: string): void {
  const existing = listSessionMeta().find((s) => s.sessionId === sessionId);
  if (!existing) return;
  upsertSessionMeta({
    ...existing,
    syncedAt: new Date().toISOString(),
    pendingPush: false,
  });
  recalcPendingChanges();
}

export function listCachedMemories(): CachedMemory[] {
  return readJson<CachedMemory[]>(MEMORIES_KEY, []);
}

export function upsertCachedMemory(memory: CachedMemory): void {
  const memories = listCachedMemories().filter((m) => m.id !== memory.id);
  memories.unshift(memory);
  writeJson(MEMORIES_KEY, memories.slice(0, 500));
  void persistMemory(memory);
}

async function persistMemory(memory: CachedMemory): Promise<void> {
  const db = await ensureSql();
  if (!db) return;
  await db.execute(
    'INSERT OR REPLACE INTO memories VALUES (?, ?, ?, ?, ?, ?, ?)',
    [
      memory.id,
      memory.title,
      memory.content,
      JSON.stringify(memory.tags),
      memory.projectId ?? null,
      memory.updatedAt,
      memory.syncedAt,
    ],
  );
}

export function listOutbox(): OutboxEntry[] {
  return readJson<OutboxEntry[]>(OUTBOX_KEY, []);
}

export function enqueueOutbox(entry: OutboxEntry): void {
  const outbox = listOutbox().filter((item) => item.id !== entry.id);
  outbox.push(entry);
  writeJson(OUTBOX_KEY, outbox);
  bumpPendingChanges(1);
  void persistOutbox(entry);
}

async function persistOutbox(entry: OutboxEntry): Promise<void> {
  const db = await ensureSql();
  if (!db) return;
  await db.execute(
    'INSERT OR REPLACE INTO outbox VALUES (?, ?, ?, ?, ?)',
    [entry.id, entry.sessionId, entry.content, entry.turnId, entry.createdAt],
  );
}

export function dequeueOutbox(id: string): void {
  writeJson(OUTBOX_KEY, listOutbox().filter((item) => item.id !== id));
  void removeOutbox(id);
  recalcPendingChanges();
}

async function removeOutbox(id: string): Promise<void> {
  const db = await ensureSql();
  if (!db) return;
  await db.execute('DELETE FROM outbox WHERE id = ?', [id]);
}

export function bumpPendingChanges(delta: number): void {
  const meta = getSyncMeta();
  setSyncMeta({ ...meta, pendingChanges: Math.max(0, meta.pendingChanges + delta) });
}

export function recalcPendingChanges(): void {
  const pendingSessions = listSessionMeta().filter((s) => s.pendingPush).length;
  const outboxCount = listOutbox().length;
  const meta = getSyncMeta();
  setSyncMeta({ ...meta, pendingChanges: pendingSessions + outboxCount });
}

export function cacheSessionFromInfo(session: SessionInfo, messages: ChatMessage[]): void {
  saveLocalMessages(session.sessionId, messages);
  upsertSessionMeta({
    sessionId: session.sessionId,
    title: session.title ?? 'New session',
    updatedAt: session.updatedAt,
    syncedAt: new Date().toISOString(),
    pendingPush: false,
  });
}

export function getCachedSessionMessages(sessionId: string): ChatMessage[] {
  return loadLocalMessages(sessionId);
}
