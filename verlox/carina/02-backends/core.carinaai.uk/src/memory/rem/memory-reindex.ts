import pgvector from 'pgvector/pg';
import { pool } from '../db.js';
import { embed } from '../embeddings.js';

export interface ReindexResult {
  episodicUpdated: number;
  episodicSkipped: number;
  factsUpdated: number;
}

export async function reindexEpisodicMemories(options: {
  batchSize?: number;
  force?: boolean;
} = {}): Promise<{ updated: number; skipped: number }> {
  const batchSize = options.batchSize ?? 50;
  const force = options.force === true;

  const where = force ? '' : 'WHERE embedding IS NULL';
  const result = await pool.query<{ id: string; content: string }>(
    `SELECT id, content FROM episodic_memories ${where} ORDER BY created_at ASC LIMIT $1`,
    [batchSize],
  );

  let updated = 0;
  let skipped = 0;

  for (const row of result.rows) {
    const content = row.content.trim();
    if (!content) {
      skipped++;
      continue;
    }
    const embedding = await embed(content);
    if (embedding.length === 0) {
      skipped++;
      continue;
    }
    await pool.query(
      'UPDATE episodic_memories SET embedding = $1, updated_at = NOW() WHERE id = $2',
      [pgvector.toSql(embedding), row.id],
    );
    updated++;
  }

  return { updated, skipped };
}

export async function reindexPersistentFacts(batchSize = 50): Promise<number> {
  const result = await pool.query<{ id: string; content: string }>(
    `SELECT id, content FROM persistent_facts
     WHERE embedding IS NULL
     ORDER BY created_at ASC
     LIMIT $1`,
    [batchSize],
  );

  let updated = 0;
  for (const row of result.rows) {
    const embedding = await embed(row.content);
    if (embedding.length === 0) continue;
    await pool.query(
      'UPDATE persistent_facts SET embedding = $1, updated_at = NOW() WHERE id = $2',
      [pgvector.toSql(embedding), row.id],
    );
    updated++;
  }
  return updated;
}

export async function reindexAllMemory(options: {
  batchSize?: number;
  force?: boolean;
} = {}): Promise<ReindexResult> {
  const episodic = await reindexEpisodicMemories(options);
  const factsUpdated = await reindexPersistentFacts(options.batchSize ?? 50);
  return {
    episodicUpdated: episodic.updated,
    episodicSkipped: episodic.skipped,
    factsUpdated,
  };
}
