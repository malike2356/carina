import type pg from 'pg';
import { pool } from '../db.js';
import { fetchCarinaMemorySessions, type MemorySessionRow } from './carina.js';

interface SessionRow {
  session_id: string;
  turn_count: string;
  last_active: string;
}

const SESSIONS_SQL = `SELECT session_id,
                             COUNT(*)::text         AS turn_count,
                             MAX(created_at)::text  AS last_active
                      FROM episodic_memories
                      GROUP BY session_id
                      ORDER BY MAX(created_at) DESC
                      LIMIT 50`;

export function isMissingEpisodicTable(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const code = (err as { code?: string }).code;
  return code === '42P01';
}

export async function episodicTableExists(client?: pg.Pool | pg.PoolClient): Promise<boolean> {
  const db = client ?? pool;
  const result = await db.query<{ exists: boolean }>(
    `SELECT to_regclass('public.episodic_memories') IS NOT NULL AS exists`,
  );
  return Boolean(result.rows[0]?.exists);
}

export async function listEpisodicSessions(): Promise<{
  sessions: MemorySessionRow[];
  source: 'local' | 'carina' | 'unavailable';
  message?: string;
}> {
  try {
    const exists = await episodicTableExists();
    if (!exists) {
      const remote = await fetchCarinaMemorySessions();
      if (remote) {
        return { sessions: remote, source: 'carina' };
      }
      return {
        sessions: [],
        source: 'unavailable',
        message:
          'episodic_memories is not in this Scout database. Point SCOUT_DATABASE_URL at the Carina DB or set CARINA_API_URL + CARINA_OPS_TOKEN.',
      };
    }

    const result = await pool.query<SessionRow>(SESSIONS_SQL);
    const sessions = result.rows.map((r) => ({
      session_id: r.session_id,
      turn_count: parseInt(r.turn_count, 10),
      last_active: r.last_active,
    }));
    return { sessions, source: 'local' };
  } catch (err) {
    if (isMissingEpisodicTable(err)) {
      const remote = await fetchCarinaMemorySessions();
      if (remote) {
        return { sessions: remote, source: 'carina' };
      }
      return {
        sessions: [],
        source: 'unavailable',
        message:
          'episodic_memories table missing. Share Carina Postgres with Scout or configure CARINA_API_URL + CARINA_OPS_TOKEN.',
      };
    }
    throw err;
  }
}
