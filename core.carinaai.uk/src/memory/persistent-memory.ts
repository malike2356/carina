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

export type MemoryBudgetStatus = {
  target: MemoryTarget;
  used: number;
  max: number;
  percent: number;
  headroom: number;
};

export async function getMemoryBudgetStatus(target: MemoryTarget): Promise<MemoryBudgetStatus> {
  const used = await getPersistentFactsTotal(target);
  const max = MEMORY_BUDGETS[target];
  return {
    target,
    used,
    max,
    percent: max > 0 ? Math.round((used / max) * 100) : 0,
    headroom: Math.max(0, max - used),
  };
}

/** Remove oldest facts until usage is at or below target percent of budget. */
export async function trimPersistentFactsToBudget(
  target: MemoryTarget,
  targetPercent = 85,
): Promise<{ removed: number; removedIds: string[] }> {
  const budget = MEMORY_BUDGETS[target];
  const goal = Math.floor((budget * targetPercent) / 100);
  let used = await getPersistentFactsTotal(target);
  const facts = await listPersistentFacts(target);
  const removedIds: string[] = [];

  for (const fact of facts) {
    if (used <= goal) break;
    await pool.query('DELETE FROM persistent_facts WHERE id = $1', [fact.id]);
    used -= fact.content.length;
    removedIds.push(fact.id);
  }

  return { removed: removedIds.length, removedIds };
}

export async function findNearDuplicateFacts(target: MemoryTarget): Promise<string[][]> {
  const facts = await listPersistentFacts(target);
  const groups: string[][] = [];
  const seen = new Set<string>();

  for (let i = 0; i < facts.length; i++) {
    for (let j = i + 1; j < facts.length; j++) {
      const a = facts[i]!;
      const b = facts[j]!;
      const overlap = wordOverlap(a.content, b.content);
      if (overlap >= 0.65) {
        const key = [a.id, b.id].sort().join(':');
        if (seen.has(key)) continue;
        seen.add(key);
        groups.push([a.content.slice(0, 80), b.content.slice(0, 80)]);
      }
    }
  }
  return groups;
}

function wordOverlap(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/).filter((w) => w.length >= 4));
  const wordsB = new Set(b.toLowerCase().split(/\s+/).filter((w) => w.length >= 4));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let hit = 0;
  for (const w of wordsA) if (wordsB.has(w)) hit++;
  return hit / new Set([...wordsA, ...wordsB]).size;
}

function rowToFact(row: Record<string, unknown>): PersistentFact {
  return {
    id: String(row.id),
    target: row.target as MemoryTarget,
    content: String(row.content),
    createdAt: new Date(String(row.created_at)),
  };
}
