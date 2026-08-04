import path from 'path';
import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { CARINA_HOME } from '../../config/paths.js';

export type LocalDatabase = Database.Database;

export const LOCAL_DB_PATH = path.join(CARINA_HOME, 'carina.db');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS episodic_memories (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  embedding TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS skill_documents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  trigger_keywords TEXT NOT NULL,
  steps TEXT NOT NULL,
  tools_used TEXT DEFAULT '[]',
  usage_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rag_chunks (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  pack TEXT NOT NULL DEFAULT 'general',
  content TEXT NOT NULL,
  embedding TEXT,
  metadata TEXT DEFAULT '{}',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inbound_emails (
  id TEXT PRIMARY KEY,
  from_address TEXT NOT NULL,
  to_address TEXT NOT NULL,
  subject TEXT,
  body_text TEXT,
  body_html TEXT,
  message_id TEXT UNIQUE,
  read INTEGER DEFAULT 0,
  received_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS episodic_memories_session_idx ON episodic_memories (session_id, created_at);
CREATE INDEX IF NOT EXISTS rag_chunks_pack_idx ON rag_chunks (pack, source);
`;

export function openLocalDb(dbPath = LOCAL_DB_PATH): LocalDatabase {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(SCHEMA);
  return db;
}

export function insertLocalMemory(
  db: LocalDatabase,
  input: { sessionId: string; role: 'user' | 'assistant'; content: string; embedding?: number[] },
): string {
  const id = uuidv4();
  db.prepare(
    `INSERT INTO episodic_memories (id, session_id, role, content, embedding)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(id, input.sessionId, input.role, input.content, input.embedding ? JSON.stringify(input.embedding) : null);
  return id;
}

export function getLocalMemories(db: LocalDatabase, sessionId: string): Array<{ id: string; content: string }> {
  return db.prepare('SELECT id, content FROM episodic_memories WHERE session_id = ? ORDER BY created_at ASC')
    .all(sessionId) as Array<{ id: string; content: string }>;
}
