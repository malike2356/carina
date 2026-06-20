import Database from 'better-sqlite3';
import path from 'path';
import { CARINA_HOME } from '../config/paths.js';
import { getActiveProfileName } from '../profiles/manager.js';

export const SESSION_FTS_MIGRATION = `
CREATE TABLE IF NOT EXISTS session_index_meta (
  session_id   TEXT PRIMARY KEY,
  title        TEXT,
  summary      TEXT,
  full_text    TEXT,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL,
  profile_id   TEXT NOT NULL DEFAULT 'default'
);

CREATE VIRTUAL TABLE IF NOT EXISTS session_fts USING fts5(
  session_id UNINDEXED,
  title,
  summary,
  full_text,
  profile_id UNINDEXED,
  created_at UNINDEXED,
  tokenize='porter unicode61 remove_diacritics 1'
);
`;

let db: Database.Database | null = null;
let overridePath: string | null = null;

export function sessionFtsDbPath(): string {
  return overridePath
    ?? process.env.CARINA_SESSION_FTS_PATH
    ?? path.join(CARINA_HOME, 'session-fts.sqlite');
}

export function runSessionFtsMigration(database: Database.Database): void {
  database.exec(SESSION_FTS_MIGRATION);
}

export function getSessionFtsDb(): Database.Database {
  if (db) return db;
  const file = sessionFtsDbPath();
  db = new Database(file);
  db.pragma('journal_mode = WAL');
  runSessionFtsMigration(db);
  return db;
}

export function isSessionFtsAvailable(): boolean {
  try {
    getSessionFtsDb();
    return true;
  } catch {
    return false;
  }
}

export function currentProfileId(): string {
  return process.env.CARINA_PROFILE ?? getActiveProfileName() ?? 'default';
}

export function openSessionFtsDbForTests(dbPath = ':memory:'): Database.Database {
  if (db) {
    db.close();
    db = null;
  }
  overridePath = dbPath;
  return getSessionFtsDb();
}

export function closeSessionFtsDbForTests(): void {
  if (db) {
    db.close();
    db = null;
  }
  overridePath = null;
}
