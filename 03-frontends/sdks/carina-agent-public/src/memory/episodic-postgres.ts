import pgvector from 'pgvector/pg';
import { pool } from './db.js';
import { embed } from './embeddings.js';
import type { Memory, Role } from '../types/index.js';
import { recordMemoryAccess } from './rem/rem-promotion.js';

function rowToMemory(row: Record<string, unknown>): Memory {
  return {
    id: String(row.id),
    sessionId: String(row.session_id),
    role: row.role as Role,
    content: String(row.content),
    createdAt: new Date(String(row.created_at)),
  };
}

export async function saveMemory(
  sessionId: string,
  role: Role,
  content: string,
): Promise<void> {
  const embedding = await embed(content);
  const vectorSql = embedding.length > 0 ? pgvector.toSql(embedding) : null;

  await pool.query(
    `INSERT INTO episodic_memories (session_id, role, content, embedding, memory_tier)
     VALUES ($1, $2, $3, $4, 'short_term')`,
    [sessionId, role, content, vectorSql],
  );
}

export async function searchMemory(query: string, limit: number): Promise<Memory[]> {
  const embedding = await embed(query);

  if (embedding.length > 0) {
    const vectorSql = pgvector.toSql(embedding);
    const result = await pool.query(
      `SELECT id, session_id, role, content, created_at
       FROM episodic_memories
       WHERE embedding IS NOT NULL
       ORDER BY
         CASE memory_tier WHEN 'long_term' THEN 0 ELSE 1 END,
         embedding <=> $1
       LIMIT $2`,
      [vectorSql, limit],
    );
    const memories = result.rows.map(rowToMemory);
    void recordMemoryAccess(memories.map((m) => m.id));
    return memories;
  }

  const fallback = await pool.query(
    `SELECT id, session_id, role, content, created_at
     FROM episodic_memories
     ORDER BY created_at DESC
     LIMIT $1`,
    [limit],
  );
  return fallback.rows.map(rowToMemory);
}

export async function getSessionHistory(
  sessionId: string,
  limit: number,
): Promise<Memory[]> {
  const result = await pool.query(
    `SELECT id, session_id, role, content, created_at
     FROM episodic_memories
     WHERE session_id = $1
     ORDER BY created_at ASC
     LIMIT $2`,
    [sessionId, limit],
  );
  return result.rows.map(rowToMemory);
}

export async function clearSession(sessionId: string): Promise<void> {
  await pool.query('DELETE FROM episodic_memories WHERE session_id = $1', [sessionId]);
}

export async function listRecentMemories(limit: number): Promise<Memory[]> {
  const result = await pool.query(
    `SELECT id, session_id, role, content, created_at
     FROM episodic_memories
     ORDER BY created_at DESC
     LIMIT $1`,
    [limit],
  );
  return result.rows.map(rowToMemory);
}

export async function deleteMemory(id: string): Promise<boolean> {
  const result = await pool.query('DELETE FROM episodic_memories WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
}
