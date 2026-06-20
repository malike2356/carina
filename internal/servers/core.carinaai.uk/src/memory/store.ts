import pgvector from 'pgvector/pg';
import { pool } from './db.js';
import { embed } from './embeddings.js';
import type { Memory, Role } from '../types/index.js';
import {
  backendClearSession,
  backendGetSessionHistory,
  backendListRecentMemories,
  backendSaveMemory,
  backendSearchMemory,
  getMemoryBackend,
} from './backends/index.js';
import * as postgresEpisodic from './episodic-postgres.js';

export async function saveMemory(
  sessionId: string,
  role: Role,
  content: string,
): Promise<void> {
  return backendSaveMemory(sessionId, role, content);
}

export async function searchMemory(query: string, limit: number): Promise<Memory[]> {
  return backendSearchMemory(query, limit);
}

export async function getSessionHistory(
  sessionId: string,
  limit: number,
): Promise<Memory[]> {
  return backendGetSessionHistory(sessionId, limit);
}

export async function clearSession(sessionId: string): Promise<void> {
  return backendClearSession(sessionId);
}

export async function listRecentMemories(limit: number): Promise<Memory[]> {
  return backendListRecentMemories(limit);
}

export async function deleteMemory(id: string): Promise<boolean> {
  if (getMemoryBackend().name === 'postgres') {
    return postgresEpisodic.deleteMemory(id);
  }
  return false;
}

export interface RagChunk {
  id: string;
  source: string;
  pack: string;
  content: string;
}

export async function searchRag(query: string, limit: number): Promise<RagChunk[]> {
  const embedding = await embed(query);
  if (embedding.length === 0) return [];

  const vectorSql = pgvector.toSql(embedding);
  const result = await pool.query(
    `SELECT id, source, pack, content
     FROM rag_chunks
     WHERE embedding IS NOT NULL
     ORDER BY embedding <=> $1
     LIMIT $2`,
    [vectorSql, limit],
  );

  return result.rows.map((row) => ({
    id: String(row.id),
    source: String(row.source),
    pack: String(row.pack),
    content: String(row.content),
  }));
}

export async function isSourceIngested(source: string): Promise<boolean> {
  const result = await pool.query(
    'SELECT 1 FROM rag_chunks WHERE source = $1 LIMIT 1',
    [source],
  );
  return result.rowCount !== null && result.rowCount > 0;
}

export async function insertRagChunk(
  source: string,
  pack: string,
  content: string,
  embedding: number[],
  metadata: Record<string, unknown> = {},
): Promise<void> {
  const vectorSql = embedding.length > 0 ? pgvector.toSql(embedding) : null;
  await pool.query(
    `INSERT INTO rag_chunks (source, pack, content, embedding, metadata)
     VALUES ($1, $2, $3, $4, $5)`,
    [source, pack, content, vectorSql, JSON.stringify(metadata)],
  );
}
