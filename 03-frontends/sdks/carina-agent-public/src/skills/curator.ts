import { pool } from '../memory/db.js';
import type { Skill } from '../types/index.js';
import { listSkills } from './store.js';

export type SkillStatus = 'active' | 'archived' | 'pruned';

function rowToSkill(row: Record<string, unknown>): Skill & { status: SkillStatus } {
  return {
    id: String(row.id),
    name: String(row.name),
    description: String(row.description),
    trigger: (row.trigger_keywords as string[]) ?? [],
    steps: String(row.steps),
    toolsUsed: (row.tools_used as string[]) ?? [],
    createdAt: new Date(String(row.created_at)),
    usageCount: Number(row.usage_count ?? 0),
    status: String(row.status ?? 'active') as SkillStatus,
  };
}

export async function archiveSkill(name: string, reason?: string): Promise<boolean> {
  const result = await pool.query(
    `UPDATE skill_documents
     SET status = 'archived', archived_at = NOW(),
         description = CASE WHEN $2::text IS NOT NULL THEN description || ' [archived: ' || $2 || ']' ELSE description END
     WHERE name = $1 AND COALESCE(status, 'active') = 'active'`,
    [name, reason ?? null],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function restoreSkill(name: string): Promise<boolean> {
  const result = await pool.query(
    `UPDATE skill_documents SET status = 'active', archived_at = NULL WHERE name = $1`,
    [name],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function pruneStaleSkills(options: {
  minUsage?: number;
  maxAgeDays?: number;
  dryRun?: boolean;
} = {}): Promise<{ pruned: string[]; candidates: string[] }> {
  const minUsage = options.minUsage ?? 0;
  const maxAgeDays = options.maxAgeDays ?? 90;
  const result = await pool.query(
    `SELECT name, usage_count, created_at, COALESCE(last_used_at, updated_at, created_at) AS last_touch
     FROM skill_documents
     WHERE COALESCE(status, 'active') = 'active'
       AND usage_count <= $1
       AND COALESCE(last_used_at, updated_at, created_at) < NOW() - ($2 || ' days')::interval`,
    [minUsage, String(maxAgeDays)],
  );

  const candidates = result.rows.map((r) => String(r.name));
  if (options.dryRun) return { pruned: [], candidates };

  const pruned: string[] = [];
  for (const name of candidates) {
    const ok = await pool.query(
      `UPDATE skill_documents SET status = 'pruned', archived_at = NOW() WHERE name = $1`,
      [name],
    );
    if ((ok.rowCount ?? 0) > 0) pruned.push(name);
  }
  return { pruned, candidates };
}

export async function curateFromWorkflow(input: {
  name: string;
  description: string;
  trigger: string[];
  steps: string;
  toolsUsed: string[];
  mergeThreshold?: number;
}): Promise<{ action: 'created' | 'merged' | 'skipped'; skill?: string }> {
  const all = await listSkills();
  const threshold = input.mergeThreshold ?? 0.6;

  for (const skill of all) {
    const overlap = jaccard(input.trigger, skill.trigger);
    if (overlap >= threshold) {
      await pool.query(
        `UPDATE skill_documents
         SET steps = $2, tools_used = $3, usage_count = usage_count + 1, updated_at = NOW(), last_used_at = NOW()
         WHERE name = $1`,
        [skill.name, input.steps, input.toolsUsed],
      );
      return { action: 'merged', skill: skill.name };
    }
  }

  const dup = all.find((s) => s.name === input.name);
  if (dup) return { action: 'skipped', skill: dup.name };

  await pool.query(
    `INSERT INTO skill_documents (name, description, trigger_keywords, steps, tools_used, status, last_used_at)
     VALUES ($1, $2, $3, $4, $5, 'active', NOW())`,
    [input.name, input.description, input.trigger, input.steps, input.toolsUsed],
  );
  return { action: 'created', skill: input.name };
}

export async function listCuratedSkills(status: SkillStatus = 'active'): Promise<Array<Skill & { status: SkillStatus }>> {
  const result = await pool.query(
    `SELECT * FROM skill_documents WHERE COALESCE(status, 'active') = $1 ORDER BY usage_count DESC`,
    [status],
  );
  return result.rows.map(rowToSkill);
}

function jaccard(a: string[], b: string[]): number {
  const setA = new Set(a.map((k) => k.toLowerCase()));
  const setB = new Set(b.map((k) => k.toLowerCase()));
  let intersection = 0;
  for (const k of setA) if (setB.has(k)) intersection++;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}
