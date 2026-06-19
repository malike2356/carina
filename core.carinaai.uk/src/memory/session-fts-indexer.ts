import type Database from 'better-sqlite3';
import { getSessionFtsDb } from './session-fts-db.js';

export interface SessionFtsEntry {
  sessionId: string;
  title: string;
  summary: string;
  fullText: string;
  createdAt: number;
  updatedAt: number;
  profileId?: string;
}

export function buildFullText(messages: Array<{ role: string; content: string }>): string {
  return messages
    .slice(-50)
    .map((m) => `${m.role}: ${m.content}`)
    .join('\n')
    .slice(0, 50_000);
}

export function indexSession(entry: SessionFtsEntry): void {
  const db = getSessionFtsDb() as Database.Database;
  const profileId = entry.profileId ?? 'default';

  const existing = db
    .prepare('SELECT session_id FROM session_index_meta WHERE session_id = ?')
    .get(entry.sessionId) as { session_id: string } | undefined;

  if (existing) {
    db.prepare(`
      UPDATE session_index_meta
      SET title = ?, summary = ?, full_text = ?, updated_at = ?, profile_id = ?
      WHERE session_id = ?
    `).run(entry.title, entry.summary, entry.fullText, entry.updatedAt, profileId, entry.sessionId);
  } else {
    db.prepare(`
      INSERT INTO session_index_meta
        (session_id, title, summary, full_text, created_at, updated_at, profile_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      entry.sessionId,
      entry.title,
      entry.summary,
      entry.fullText,
      entry.createdAt,
      entry.updatedAt,
      profileId,
    );
  }

  db.prepare('DELETE FROM session_fts WHERE session_id = ?').run(entry.sessionId);
  db.prepare(`
    INSERT INTO session_fts (session_id, title, summary, full_text, profile_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    entry.sessionId,
    entry.title,
    entry.summary,
    entry.fullText,
    profileId,
    entry.createdAt,
  );
}

export function deindexSession(sessionId: string): void {
  const db = getSessionFtsDb() as Database.Database;
  db.prepare('DELETE FROM session_index_meta WHERE session_id = ?').run(sessionId);
  db.prepare('DELETE FROM session_fts WHERE session_id = ?').run(sessionId);
}

export function countIndexedSessions(profileId?: string): number {
  const db = getSessionFtsDb() as Database.Database;
  if (profileId) {
    const row = db.prepare('SELECT COUNT(*) AS count FROM session_index_meta WHERE profile_id = ?')
      .get(profileId) as { count: number };
    return row.count;
  }
  const row = db.prepare('SELECT COUNT(*) AS count FROM session_index_meta').get() as { count: number };
  return row.count;
}
