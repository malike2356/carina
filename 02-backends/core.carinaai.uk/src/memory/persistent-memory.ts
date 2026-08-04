import { pool } from './db.js';
import { embed } from './embeddings.js';
import pgvector from 'pgvector/pg';
import { getActiveProfileOrDefault } from '../profiles/isolation.js';
import {
  filterMemoryFactsForInjection,
  validateMemoryContent,
} from './memory-discipline.js';
import { guardMemoryWrite } from './memory-write-guard.js';

const CURATED_SUMMARY_HEADER =
  'Curated long-term memory (compact summary; use memory search/list or session-search for details):';

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

function activeProfileName(): string {
  return getActiveProfileOrDefault();
}

export function activeAgentName(): string {
  return process.env.CARINA_ACTIVE_AGENT ?? 'main';
}

function userFactsWhere(): { sql: string; params: unknown[] } {
  return {
    sql: "target = $1 AND COALESCE(profile_name, 'default') = $2 AND agent_name IS NULL",
    params: ['user', activeProfileName()],
  };
}

function agentFactsWhere(agentId?: string): { sql: string; params: unknown[] } {
  const agent = agentId ?? activeAgentName();
  return {
    sql: "target = $1 AND COALESCE(profile_name, 'default') = $2 AND COALESCE(agent_name, 'main') = $3",
    params: ['memory', activeProfileName(), agent],
  };
}

function scopeForTarget(target: MemoryTarget, agentId?: string): { sql: string; params: unknown[] } {
  if (target === 'user') return userFactsWhere();
  return agentFactsWhere(agentId);
}

export async function listPersistentFacts(
  target: MemoryTarget,
  agentId?: string,
): Promise<PersistentFact[]> {
  const scope = scopeForTarget(target, agentId);
  const result = await pool.query(
    `SELECT id, target, content, created_at
     FROM persistent_facts
     WHERE ${scope.sql}
     ORDER BY created_at ASC`,
    scope.params,
  );
  return result.rows.map(rowToFact);
}

export async function getPersistentFactsText(
  target: MemoryTarget,
  agentId?: string,
): Promise<string> {
  const facts = await listPersistentFacts(target, agentId);
  return facts.map((f) => f.content).join('\n');
}

export async function getAgentMemoryText(agentId?: string): Promise<string> {
  return getPersistentFactsText('memory', agentId);
}

export async function getPersistentFactsTotal(
  target: MemoryTarget,
  agentId?: string,
): Promise<number> {
  const scope = scopeForTarget(target, agentId);
  const result = await pool.query(
    `SELECT COALESCE(SUM(LENGTH(content)), 0)::int AS total
     FROM persistent_facts
     WHERE ${scope.sql}`,
    scope.params,
  );
  return Number(result.rows[0]?.total ?? 0);
}

export async function addPersistentFact(
  target: MemoryTarget,
  content: string,
  options: { agentId?: string; sessionId?: string } = {},
): Promise<PersistentFact | null> {
  const trimmed = content.trim();
  const validation = validateMemoryContent(trimmed);
  if (!validation.ok) throw new Error(validation.reason);

  const sessionId = options.sessionId ?? `persistent:${target}:${activeProfileName()}`;
  const guard = await guardMemoryWrite(trimmed, 'inference', sessionId);
  if (!guard.allowed) return null;

  const current = await getPersistentFactsTotal(target, options.agentId);
  if (current + trimmed.length > MEMORY_BUDGETS[target]) {
    throw new Error(
      `Memory budget exceeded for target "${target}" (${MEMORY_BUDGETS[target]} chars max). Consolidate or remove entries first.`,
    );
  }

  const embedding = await embed(trimmed);
  const vectorSql = embedding.length > 0 ? pgvector.toSql(embedding) : null;
  const agentName = target === 'memory' ? (options.agentId ?? activeAgentName()) : null;

  const result = await pool.query(
    `INSERT INTO persistent_facts (target, content, embedding, profile_name, agent_name)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, target, content, created_at`,
    [target, trimmed, vectorSql, activeProfileName(), agentName],
  );
  return rowToFact(result.rows[0]);
}

export async function findFactsByText(
  target: MemoryTarget,
  oldText: string,
  agentId?: string,
): Promise<PersistentFact[]> {
  const facts = await listPersistentFacts(target, agentId);
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
  agentId?: string,
  sessionId?: string,
): Promise<PersistentFact | null> {
  const matches = await findFactsByText(target, oldText, agentId);
  if (matches.length === 0) {
    throw new Error(`No memory entry matching "${oldText}" found for target "${target}".`);
  }
  if (matches.length > 1) {
    throw new Error(`Ambiguous match: ${matches.length} entries match "${oldText}". Be more specific.`);
  }

  const validation = validateMemoryContent(newText.trim());
  if (!validation.ok) throw new Error(validation.reason);

  const guardSessionId = sessionId ?? `persistent:${target}:${activeProfileName()}`;
  const guard = await guardMemoryWrite(newText.trim(), 'inference', guardSessionId);
  if (!guard.allowed) return null;

  const current = await getPersistentFactsTotal(target, agentId);
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
  agentId?: string,
): Promise<boolean> {
  const matches = await findFactsByText(target, oldText, agentId);
  if (matches.length === 0) {
    throw new Error(`No memory entry matching "${oldText}" found for target "${target}".`);
  }
  if (matches.length > 1) {
    throw new Error(`Ambiguous match: ${matches.length} entries match "${oldText}". Be more specific.`);
  }
  const result = await pool.query('DELETE FROM persistent_facts WHERE id = $1', [matches[0].id]);
  return (result.rowCount ?? 0) > 0;
}

export async function getPersistentFactById(
  id: string,
  agentId?: string,
): Promise<PersistentFact | null> {
  for (const target of ['user', 'memory'] as MemoryTarget[]) {
    const scope = scopeForTarget(target, agentId);
    const offsetSql = scope.sql.replace(/\$(\d+)/g, (_, n) => `$${Number(n) + 1}`);
    const result = await pool.query(
      `SELECT id, target, content, created_at
       FROM persistent_facts
       WHERE id = $1 AND ${offsetSql}`,
      [id, ...scope.params],
    );
    if (result.rows[0]) return rowToFact(result.rows[0]);
  }
  return null;
}

export async function searchPersistentFacts(
  query: string,
  options: { target?: MemoryTarget; limit?: number; agentId?: string } = {},
): Promise<PersistentFact[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const limit = Math.min(Math.max(1, options.limit ?? 5), 20);
  const targets: MemoryTarget[] = options.target ? [options.target] : ['user', 'memory'];
  const results: PersistentFact[] = [];

  const embedding = await embed(trimmed);
  if (embedding.length > 0) {
    const vectorSql = pgvector.toSql(embedding);
    for (const target of targets) {
      const scope = scopeForTarget(target, options.agentId);
      const q = await pool.query(
        `SELECT id, target, content, created_at
         FROM persistent_facts
         WHERE ${scope.sql}
           AND embedding IS NOT NULL
         ORDER BY embedding <=> $${scope.params.length + 1}
         LIMIT $${scope.params.length + 2}`,
        [...scope.params, vectorSql, limit],
      );
      results.push(...q.rows.map(rowToFact));
    }
  }

  if (results.length === 0) {
    for (const target of targets) {
      const matches = await findFactsByText(target, trimmed, options.agentId);
      results.push(...matches.slice(0, limit));
    }
  }

  const seen = new Set<string>();
  return results
    .filter((fact) => {
      if (seen.has(fact.id)) return false;
      seen.add(fact.id);
      return true;
    })
    .slice(0, limit);
}

export async function getPersistentContextForAgent(agentId?: string): Promise<string> {
  const agent = agentId ?? activeAgentName();
  const parts: string[] = [];
  const userFacts = filterMemoryFactsForInjection(
    (await listPersistentFacts('user')).map((f) => f.content),
  );
  const memoryFacts = filterMemoryFactsForInjection(
    (await listPersistentFacts('memory', agent)).map((f) => f.content),
  );
  if (userFacts.length > 0 || memoryFacts.length > 0) {
    parts.push(CURATED_SUMMARY_HEADER);
  }
  if (userFacts.length > 0) {
    parts.push(`User profile (shared across agents on this profile):\n${userFacts.join('\n')}`);
  }
  if (memoryFacts.length > 0) {
    parts.push(`Agent notes (${agent}):\n${memoryFacts.join('\n')}`);
  }
  return parts.join('\n\n');
}

export async function getAllPersistentContext(): Promise<string> {
  return getPersistentContextForAgent();
}

export type MemoryBudgetStatus = {
  target: MemoryTarget;
  used: number;
  max: number;
  percent: number;
  headroom: number;
};

export async function getMemoryBudgetStatus(
  target: MemoryTarget,
  agentId?: string,
): Promise<MemoryBudgetStatus> {
  const used = await getPersistentFactsTotal(target, agentId);
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
  agentId?: string,
): Promise<{ removed: number; removedIds: string[] }> {
  const budget = MEMORY_BUDGETS[target];
  const goal = Math.floor((budget * targetPercent) / 100);
  let used = await getPersistentFactsTotal(target, agentId);
  const facts = await listPersistentFacts(target, agentId);
  const removedIds: string[] = [];

  for (const fact of facts) {
    if (used <= goal) break;
    await pool.query('DELETE FROM persistent_facts WHERE id = $1', [fact.id]);
    used -= fact.content.length;
    removedIds.push(fact.id);
  }

  return { removed: removedIds.length, removedIds };
}

export async function findNearDuplicateFacts(
  target: MemoryTarget,
  agentId?: string,
): Promise<string[][]> {
  const facts = await listPersistentFacts(target, agentId);
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
