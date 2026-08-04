import pgvector from 'pgvector/pg';
import { pool } from './db.js';
import { embed } from './embeddings.js';
import type { Memory, Role } from '../types/index.js';
import type { EpisodicSearchScope } from './backends/types.js';
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

function applySessionScope(
  where: string[],
  params: unknown[],
  scope?: EpisodicSearchScope,
): void {
  if (scope?.sessionId) {
    params.push(scope.sessionId);
    where.push(`session_id = $${params.length}`);
  }
  if (scope?.sessionIdPrefix) {
    params.push(`${scope.sessionIdPrefix}%`);
    where.push(`session_id LIKE $${params.length}`);
  }
}

function conversationIdFromSession(sessionId: string): string | null {
  const match = /conv-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.exec(
    sessionId.trim(),
  );
  return match?.[1] ?? null;
}

export async function saveMemory(
  sessionId: string,
  role: Role,
  content: string,
): Promise<void> {
  const embedding = await embed(content);
  const vectorSql = embedding.length > 0 ? pgvector.toSql(embedding) : null;
  const conversationId = conversationIdFromSession(sessionId);

  let nextTurn = 1;
  try {
    if (conversationId) {
      const turnResult = await pool.query<{ n: string }>(
        `SELECT COALESCE(MAX(turn_number), 0) + 1 AS n
         FROM episodic_memories
         WHERE conversation_id = $1::uuid`,
        [conversationId],
      );
      nextTurn = Number(turnResult.rows[0]?.n ?? 1);
    } else {
      const turnResult = await pool.query<{ n: string }>(
        `SELECT COALESCE(MAX(turn_number), 0) + 1 AS n
         FROM episodic_memories
         WHERE session_id = $1`,
        [sessionId],
      );
      nextTurn = Number(turnResult.rows[0]?.n ?? 1);
    }
  } catch {
    nextTurn = 1;
  }

  try {
    await pool.query(
      `INSERT INTO episodic_memories
         (session_id, role, content, embedding, memory_tier, conversation_id, turn_number)
       VALUES ($1, $2, $3, $4, 'short_term', $5::uuid, $6)`,
      [sessionId, role, content, vectorSql, conversationId, nextTurn],
    );
  } catch {
    try {
      await pool.query(
        `INSERT INTO episodic_memories (session_id, role, content, embedding, memory_tier, conversation_id)
         VALUES ($1, $2, $3, $4, 'short_term', $5::uuid)`,
        [sessionId, role, content, vectorSql, conversationId],
      );
    } catch {
      // conversation_id column may not exist yet on older schemas
      await pool.query(
        `INSERT INTO episodic_memories (session_id, role, content, embedding, memory_tier)
         VALUES ($1, $2, $3, $4, 'short_term')`,
        [sessionId, role, content, vectorSql],
      );
    }
  }
}

export async function searchMemory(
  query: string,
  limit: number,
  scope?: EpisodicSearchScope,
): Promise<Memory[]> {
  const embedding = await embed(query);
  const where: string[] = [];
  const params: unknown[] = [];

  if (embedding.length > 0) {
    const vectorSql = pgvector.toSql(embedding);
    params.push(vectorSql);
    where.push('embedding IS NOT NULL');
    applySessionScope(where, params, scope);
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    params.push(limit);
    const result = await pool.query(
      `SELECT id, session_id, role, content, created_at
       FROM episodic_memories
       ${whereSql}
       ORDER BY
         CASE memory_tier WHEN 'long_term' THEN 0 ELSE 1 END,
         embedding <=> $1
       LIMIT $${params.length}`,
      params,
    );
    const memories = result.rows.map(rowToMemory);
    void recordMemoryAccess(memories.map((m) => m.id));
    return memories;
  }

  applySessionScope(where, params, scope);
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  params.push(limit);
  const fallback = await pool.query(
    `SELECT id, session_id, role, content, created_at
     FROM episodic_memories
     ${whereSql}
     ORDER BY created_at DESC
     LIMIT $${params.length}`,
    params,
  );
  return fallback.rows.map(rowToMemory);
}

export async function getSessionHistory(
  sessionId: string,
  limit: number,
  before?: Date,
): Promise<Memory[]> {
  let query = `SELECT id, session_id, role, content, created_at
     FROM episodic_memories
     WHERE session_id = $1`;
  const params: unknown[] = [sessionId];

  if (before) {
    query += ' AND created_at < $2';
    params.push(before.toISOString());
  }

  query += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
  params.push(limit);

  const result = await pool.query(query, params);
  return result.rows.map(rowToMemory).reverse();
}

export async function clearSession(sessionId: string): Promise<void> {
  await pool.query('DELETE FROM episodic_memories WHERE session_id = $1', [sessionId]);
}

export async function listRecentMemories(
  limit: number,
  scope?: EpisodicSearchScope,
): Promise<Memory[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  applySessionScope(where, params, scope);
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  params.push(limit);
  const result = await pool.query(
    `SELECT id, session_id, role, content, created_at
     FROM episodic_memories
     ${whereSql}
     ORDER BY created_at DESC
     LIMIT $${params.length}`,
    params,
  );
  return result.rows.map(rowToMemory);
}

export async function deleteMemory(id: string): Promise<boolean> {
  const result = await pool.query('DELETE FROM episodic_memories WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
}
