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
import { guardMemoryWrite } from './memory-write-guard.js';
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
  const guard = await guardMemoryWrite(content, 'tool_result', `rag:${source}`);
  if (!guard.allowed) return;

  const vectorSql = embedding.length > 0 ? pgvector.toSql(embedding) : null;
  await pool.query(
    `INSERT INTO rag_chunks (source, pack, content, embedding, metadata)
     VALUES ($1, $2, $3, $4, $5)`,
    [source, pack, content, vectorSql, JSON.stringify(metadata)],
  );
}

export async function insertRagChunkWithWorkspace(
  source: string,
  pack: string,
  content: string,
  embedding: number[],
  workspaceId: string | null,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  const guard = await guardMemoryWrite(content, 'tool_result', `rag:${source}`);
  if (!guard.allowed) return;

  const vectorSql = embedding.length > 0 ? pgvector.toSql(embedding) : null;
  await pool.query(
    `INSERT INTO rag_chunks (source, pack, content, embedding, workspace_id, metadata)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [source, pack, content, vectorSql, workspaceId, JSON.stringify(metadata)],
  );
}

export interface RagSource {
  source: string;
  pack: string;
  ingestedAt: string;
  chunkCount: number;
}

export async function listRagSources(
  workspaceId: string | null,
  pack: string | null,
  limit: number,
  offset: number,
): Promise<{ sources: RagSource[]; total: number }> {
  const rows = await pool.query(
    `SELECT source, pack,
            MIN(created_at) AS ingested_at,
            COUNT(*)::int AS chunk_count
     FROM rag_chunks
     WHERE ($1::uuid IS NULL OR workspace_id = $1)
       AND ($2::text IS NULL OR pack = $2)
     GROUP BY source, pack
     ORDER BY MIN(created_at) DESC
     LIMIT $3 OFFSET $4`,
    [workspaceId, pack, limit, offset],
  );

  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS total
     FROM (
       SELECT 1 FROM rag_chunks
       WHERE ($1::uuid IS NULL OR workspace_id = $1)
         AND ($2::text IS NULL OR pack = $2)
       GROUP BY source, pack
     ) sub`,
    [workspaceId, pack],
  );

  return {
    sources: rows.rows.map((r) => ({
      source: String(r.source),
      pack: String(r.pack),
      ingestedAt: String(r.ingested_at),
      chunkCount: Number(r.chunk_count),
    })),
    total: Number((countResult.rows[0] as { total: number }).total),
  };
}

export async function deleteRagSource(
  source: string,
  workspaceId: string | null,
): Promise<number> {
  const result = await pool.query(
    `DELETE FROM rag_chunks
     WHERE source = $1
       AND ($2::uuid IS NULL OR workspace_id = $2)`,
    [source, workspaceId],
  );
  return result.rowCount ?? 0;
}

export async function getRagStatus(): Promise<{ totalChunks: number }> {
  const r = await pool.query('SELECT COUNT(*)::int AS total FROM rag_chunks');
  return { totalChunks: Number((r.rows[0] as { total: number }).total) };
}
