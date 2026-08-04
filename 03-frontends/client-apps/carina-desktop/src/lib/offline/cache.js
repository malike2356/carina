import { loadLocalMessages, saveLocalMessages, listLocalSessions, } from '../session-store.js';
const META_KEY = 'carina_offline_sync_meta';
const MEMORIES_KEY = 'carina_offline_memories';
const SESSION_META_KEY = 'carina_offline_session_meta';
const OUTBOX_KEY = 'carina_offline_outbox';
let sqlDb = null;
let sqlReady = false;
function readJson(key, fallback) {
    try {
        return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
    }
    catch {
        return fallback;
    }
}
function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}
export function isTauriRuntime() {
    return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}
async function ensureSql() {
    if (sqlReady)
        return sqlDb;
    sqlReady = true;
    if (!isTauriRuntime())
        return null;
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
    }
    catch {
        sqlDb = null;
    }
    return sqlDb;
}
async function migrateLocalStorageToSql(db) {
    const existing = await db.select('SELECT COUNT(*) as count FROM sessions');
    if ((existing[0]?.count ?? 0) > 0)
        return;
    for (const session of listLocalSessions()) {
        const messages = loadLocalMessages(session.sessionId);
        await db.execute('INSERT OR REPLACE INTO sessions VALUES (?, ?, ?, ?, ?, ?)', [
            session.sessionId,
            session.title ?? 'New session',
            JSON.stringify(messages),
            session.updatedAt,
            null,
            0,
        ]);
    }
    const memories = readJson(MEMORIES_KEY, []);
    for (const memory of memories) {
        await db.execute('INSERT OR REPLACE INTO memories VALUES (?, ?, ?, ?, ?, ?, ?)', [
            memory.id,
            memory.title,
            memory.content,
            JSON.stringify(memory.tags),
            memory.projectId ?? null,
            memory.updatedAt,
            memory.syncedAt,
        ]);
    }
}
export async function initOfflineCache() {
    await ensureSql();
}
export function getSyncMeta() {
    return readJson(META_KEY, { lastSyncAt: null, pendingChanges: 0 });
}
export function setSyncMeta(meta) {
    writeJson(META_KEY, meta);
    void persistSyncMeta(meta);
}
async function persistSyncMeta(meta) {
    const db = await ensureSql();
    if (!db)
        return;
    await db.execute('INSERT OR REPLACE INTO sync_meta VALUES (?, ?)', ['last_sync', JSON.stringify(meta)]);
}
export function listSessionMeta() {
    const stored = readJson(SESSION_META_KEY, {});
    return Object.values(stored);
}
export function upsertSessionMeta(meta) {
    const stored = readJson(SESSION_META_KEY, {});
    stored[meta.sessionId] = meta;
    writeJson(SESSION_META_KEY, stored);
    void persistSessionMeta(meta);
}
async function persistSessionMeta(meta) {
    const db = await ensureSql();
    if (!db)
        return;
    const messages = loadLocalMessages(meta.sessionId);
    await db.execute('INSERT OR REPLACE INTO sessions VALUES (?, ?, ?, ?, ?, ?)', [
        meta.sessionId,
        meta.title,
        JSON.stringify(messages),
        meta.updatedAt,
        meta.syncedAt,
        meta.pendingPush ? 1 : 0,
    ]);
}
export function markSessionPending(sessionId, title) {
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
export function markSessionSynced(sessionId) {
    const existing = listSessionMeta().find((s) => s.sessionId === sessionId);
    if (!existing)
        return;
    upsertSessionMeta({
        ...existing,
        syncedAt: new Date().toISOString(),
        pendingPush: false,
    });
    recalcPendingChanges();
}
export function listCachedMemories() {
    return readJson(MEMORIES_KEY, []);
}
export function upsertCachedMemory(memory) {
    const memories = listCachedMemories().filter((m) => m.id !== memory.id);
    memories.unshift(memory);
    writeJson(MEMORIES_KEY, memories.slice(0, 500));
    void persistMemory(memory);
}
async function persistMemory(memory) {
    const db = await ensureSql();
    if (!db)
        return;
    await db.execute('INSERT OR REPLACE INTO memories VALUES (?, ?, ?, ?, ?, ?, ?)', [
        memory.id,
        memory.title,
        memory.content,
        JSON.stringify(memory.tags),
        memory.projectId ?? null,
        memory.updatedAt,
        memory.syncedAt,
    ]);
}
export function listOutbox() {
    return readJson(OUTBOX_KEY, []);
}
export function enqueueOutbox(entry) {
    const outbox = listOutbox().filter((item) => item.id !== entry.id);
    outbox.push(entry);
    writeJson(OUTBOX_KEY, outbox);
    bumpPendingChanges(1);
    void persistOutbox(entry);
}
async function persistOutbox(entry) {
    const db = await ensureSql();
    if (!db)
        return;
    await db.execute('INSERT OR REPLACE INTO outbox VALUES (?, ?, ?, ?, ?)', [entry.id, entry.sessionId, entry.content, entry.turnId, entry.createdAt]);
}
export function dequeueOutbox(id) {
    writeJson(OUTBOX_KEY, listOutbox().filter((item) => item.id !== id));
    void removeOutbox(id);
    recalcPendingChanges();
}
async function removeOutbox(id) {
    const db = await ensureSql();
    if (!db)
        return;
    await db.execute('DELETE FROM outbox WHERE id = ?', [id]);
}
export function bumpPendingChanges(delta) {
    const meta = getSyncMeta();
    setSyncMeta({ ...meta, pendingChanges: Math.max(0, meta.pendingChanges + delta) });
}
export function recalcPendingChanges() {
    const pendingSessions = listSessionMeta().filter((s) => s.pendingPush).length;
    const outboxCount = listOutbox().length;
    const meta = getSyncMeta();
    setSyncMeta({ ...meta, pendingChanges: pendingSessions + outboxCount });
}
export function cacheSessionFromInfo(session, messages) {
    saveLocalMessages(session.sessionId, messages);
    upsertSessionMeta({
        sessionId: session.sessionId,
        title: session.title ?? 'New session',
        updatedAt: session.updatedAt,
        syncedAt: new Date().toISOString(),
        pendingPush: false,
    });
}
export function getCachedSessionMessages(sessionId) {
    return loadLocalMessages(sessionId);
}
