import { pool } from './db.js';
import { embed } from './embeddings.js';
import pgvector from 'pgvector/pg';

export type MemoryTarget = 'user' | 'memory';

export const MEMORY_BUDGETS: Record<MemoryTarget, number> = {
  user: 1375,
  memory: 2200,
};

export interface PersistentFact {
  id: string;
  target: MemoryTarget;
  content: string;
  createdAt: Date;
}

export async function listPersistentFacts(target: MemoryTarget): Promise<PersistentFact[]> {
  const result = await pool.query(
    `SELECT id, target, content, created_at
     FROM persistent_facts
     WHERE target = $1
     ORDER BY created_at ASC`,
    [target],
  );
  return result.rows.map(rowToFact);
}

export async function getPersistentFactsText(target: MemoryTarget): Promise<string> {
  const facts = await listPersistentFacts(target);
  return facts.map((f) => f.content).join('\n');
}

export async function getPersistentFactsTotal(target: MemoryTarget): Promise<number> {
  const result = await pool.query(
    `SELECT COALESCE(SUM(LENGTH(content)), 0)::int AS total
     FROM persistent_facts WHERE target = $1`,
    [target],
  );
  return Number(result.rows[0]?.total ?? 0);
}

export async function addPersistentFact(
  target: MemoryTarget,
  content: string,
): Promise<PersistentFact> {
  const trimmed = content.trim();
  if (!trimmed) throw new Error('Content cannot be empty.');

  const current = await getPersistentFactsTotal(target);
  if (current + trimmed.length > MEMORY_BUDGETS[target]) {
    throw new Error(
      `Memory budget exceeded for target "${target}" (${MEMORY_BUDGETS[target]} chars max). Consolidate or remove entries first.`,
    );
  }

  const embedding = await embed(trimmed);
  const vectorSql = embedding.length > 0 ? pgvector.toSql(embedding) : null;

  const result = await pool.query(
    `INSERT INTO persistent_facts (target, content, embedding)
     VALUES ($1, $2, $3)
     RETURNING id, target, content, created_at`,
    [target, trimmed, vectorSql],
  );
  return rowToFact(result.rows[0]);
}

export async function findFactsByText(
  target: MemoryTarget,
  oldText: string,
): Promise<PersistentFact[]> {
  const facts = await listPersistentFacts(target);
  const needle = oldText.trim().toLowerCase();
  const exact = facts.filter((f) => f.content.toLowerCase().includes(needle));
  if (exact.length > 0) return exact;
  return facts.filter((f) => {
    const content = f.content.toLowerCase();
    const words = needle.split(/\s+/).filter(Boolean);
    const matches = words.filter((w) => content.includes(w)).length;
    return words.length > 0 && matches / words.length >= 0.6;
  });
}

export async function replacePersistentFact(
  target: MemoryTarget,
  oldText: string,
  newText: string,
): Promise<PersistentFact> {
  const matches = await findFactsByText(target, oldText);
  if (matches.length === 0) {
    throw new Error(`No memory entry matching "${oldText}" found for target "${target}".`);
  }
  if (matches.length > 1) {
    throw new Error(`Ambiguous match: ${matches.length} entries match "${oldText}". Be more specific.`);
  }

  const current = await getPersistentFactsTotal(target);
  const delta = newText.trim().length - matches[0].content.length;
  if (current + delta > MEMORY_BUDGETS[target]) {
    throw new Error(`Memory budget exceeded for target "${target}".`);
  }

  const embedding = await embed(newText.trim());
  const vectorSql = embedding.length > 0 ? pgvector.toSql(embedding) : null;

  const result = await pool.query(
    `UPDATE persistent_facts SET content = $1, embedding = $2, updated_at = NOW()
     WHERE id = $3
     RETURNING id, target, content, created_at`,
    [newText.trim(), vectorSql, matches[0].id],
  );
  return rowToFact(result.rows[0]);
}

export async function removePersistentFact(
  target: MemoryTarget,
  oldText: string,
): Promise<boolean> {
  const matches = await findFactsByText(target, oldText);
  if (matches.length === 0) {
    throw new Error(`No memory entry matching "${oldText}" found for target "${target}".`);
  }
  if (matches.length > 1) {
    throw new Error(`Ambiguous match: ${matches.length} entries match "${oldText}". Be more specific.`);
  }
  const result = await pool.query('DELETE FROM persistent_facts WHERE id = $1', [matches[0].id]);
  return (result.rowCount ?? 0) > 0;
}

export async function getAllPersistentContext(): Promise<string> {
  const parts: string[] = [];
  const user = await getPersistentFactsText('user');
  const memory = await getPersistentFactsText('memory');
  if (user) parts.push(`User profile:\n${user}`);
  if (memory) parts.push(`Agent notes:\n${memory}`);
  return parts.join('\n\n');
}

function rowToFact(row: Record<string, unknown>): PersistentFact {
  return {
    id: String(row.id),
    target: row.target as MemoryTarget,
    content: String(row.content),
    createdAt: new Date(String(row.created_at)),
  };
}
