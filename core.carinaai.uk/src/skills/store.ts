import { pool } from '../memory/db.js';
import type { Skill } from '../types/index.js';

type SkillInput = Omit<Skill, 'id' | 'createdAt' | 'usageCount'>;

function rowToSkill(row: Record<string, unknown>): Skill {
  return {
    id: String(row.id),
    name: String(row.name),
    description: String(row.description),
    trigger: (row.trigger_keywords as string[]) ?? [],
    steps: String(row.steps),
    toolsUsed: (row.tools_used as string[]) ?? [],
    createdAt: new Date(String(row.created_at)),
    usageCount: Number(row.usage_count ?? 0),
  };
}

export async function saveSkill(skill: SkillInput): Promise<Skill> {
  const result = await pool.query(
    `INSERT INTO skill_documents (name, description, trigger_keywords, steps, tools_used)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [skill.name, skill.description, skill.trigger, skill.steps, skill.toolsUsed],
  );
  return rowToSkill(result.rows[0]);
}

export async function findRelevantSkills(keywords: string[]): Promise<Skill[]> {
  if (keywords.length === 0) return [];

  const result = await pool.query(
    `SELECT * FROM skill_documents
     WHERE trigger_keywords && $1::text[]
     ORDER BY usage_count DESC
     LIMIT 5`,
    [keywords],
  );
  return result.rows.map(rowToSkill);
}

export async function incrementSkillUsage(id: string): Promise<void> {
  await pool.query(
    `UPDATE skill_documents
     SET usage_count = usage_count + 1, updated_at = NOW()
     WHERE id = $1`,
    [id],
  );
}

export async function listSkills(): Promise<Skill[]> {
  const result = await pool.query(
    'SELECT * FROM skill_documents ORDER BY created_at DESC',
  );
  return result.rows.map(rowToSkill);
}

export function jaccardSimilarity(a: string[], b: string[]): number {
  const setA = new Set(a.map((k) => k.toLowerCase()));
  const setB = new Set(b.map((k) => k.toLowerCase()));
  if (setA.size === 0 && setB.size === 0) return 0;
  let intersection = 0;
  for (const k of setA) {
    if (setB.has(k)) intersection++;
  }
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

export async function findSkillByKeywordOverlap(
  keywords: string[],
  threshold: number,
): Promise<Skill | null> {
  const all = await listSkills();
  let best: Skill | null = null;
  let bestScore = 0;

  for (const skill of all) {
    const score = jaccardSimilarity(keywords, skill.trigger);
    if (score > bestScore) {
      bestScore = score;
      best = skill;
    }
  }

  return bestScore >= threshold ? best : null;
}

export async function skillExistsByName(name: string): Promise<boolean> {
  const result = await pool.query(
    'SELECT 1 FROM skill_documents WHERE name = $1 LIMIT 1',
    [name],
  );
  return result.rowCount !== null && result.rowCount > 0;
}
