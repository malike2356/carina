import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import type { Memory, Role } from '../../types/index.js';
import type { MemoryBackend } from './types.js';

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (db) return db;
  const file = process.env.CARINA_SQLITE_MEMORY_PATH
    ?? path.join(process.env.CARINA_HOME ?? path.join(os.homedir(), '.carina'), 'memory.sqlite');
  db = new Database(file);
  db.exec(`
    CREATE TABLE IF NOT EXISTS episodic_memories (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_session ON episodic_memories(session_id, created_at);
  `);
  return db;
}

function rowToMemory(row: Record<string, unknown>): Memory {
  return {
    id: String(row.id),
    sessionId: String(row.session_id),
    role: row.role as Role,
    content: String(row.content),
    createdAt: new Date(String(row.created_at)),
  };
}

export const sqliteBackend: MemoryBackend = {
  name: 'sqlite',
  displayName: 'SQLite',
  description: 'Local file-backed episodic memory (no Postgres required)',
  isConfigured() {
    return true;
  },
  requiredEnv() {
    return [];
  },
  async saveMemory(sessionId, role, content) {
    getDb().prepare(
      'INSERT INTO episodic_memories (id, session_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)',
    ).run(uuidv4(), sessionId, role, content, new Date().toISOString());
  },
  async searchMemory(query, limit) {
    const rows = getDb().prepare(
      `SELECT * FROM episodic_memories WHERE content LIKE ? ORDER BY created_at DESC LIMIT ?`,
    ).all(`%${query}%`, limit) as Record<string, unknown>[];
    return rows.map(rowToMemory);
  },
  async getSessionHistory(sessionId, limit, before?) {
    let sql = 'SELECT * FROM episodic_memories WHERE session_id = ?';
    const params: unknown[] = [sessionId];
    if (before) {
      sql += ' AND created_at < ?';
      params.push(before.toISOString());
    }
    sql += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);
    const rows = getDb().prepare(sql).all(...params) as Record<string, unknown>[];
    return rows.map(rowToMemory).reverse();
  },
  async clearSession(sessionId) {
    getDb().prepare('DELETE FROM episodic_memories WHERE session_id = ?').run(sessionId);
  },
  async listRecentMemories(limit) {
    const rows = getDb().prepare(
      'SELECT * FROM episodic_memories ORDER BY created_at DESC LIMIT ?',
    ).all(limit) as Record<string, unknown>[];
    return rows.map(rowToMemory);
  },
};
