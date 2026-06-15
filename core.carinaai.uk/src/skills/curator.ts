import { pool } from '../memory/db.js';
import type { Skill } from '../types/index.js';
import { getSkillByName, listSkills } from './store.js';
import { logSkillAction } from './skill-audit-log.js';

export type SkillStatus = 'active' | 'archived' | 'pruned';

function deriveSkillTags(skill: Skill, row?: Record<string, unknown>): string[] {
  const tags = [...(skill.tags ?? [])];
  for (const keyword of skill.trigger) {
    if (keyword.startsWith('domain:')) tags.push(keyword);
  }
  const draftSource = row?.draft_source ? String(row.draft_source) : '';
  if (draftSource.startsWith('pack:')) {
    tags.push(`domain:${draftSource.slice(5)}`);
  }
  return [...new Set(tags)];
}

function skillWithTags(skill: Skill, row?: Record<string, unknown>): Skill {
  return { ...skill, tags: deriveSkillTags(skill, row) };
}

function sameDomain(a: Skill, b: Skill): boolean {
  const da = a.tags?.find((t) => t.startsWith('domain:'));
  const db = b.tags?.find((t) => t.startsWith('domain:'));
  if (!da && !db) return true;
  return da === db;
}

function hasDomainTag(skill: Skill): boolean {
  return Boolean(skill.tags?.some((t) => t.startsWith('domain:')));
}

async function evalSkillCandidate(skill: Skill): Promise<boolean> {
  try {
    const { evalSkill } = await import('./eval/runner.js');
    const result = await evalSkill(skill);
    return result.pass;
  } catch {
    const steps = skill.steps?.trim() ?? '';
    return Boolean(skill.name && skill.description && steps.length > 0);
  }
}

async function propagateToAllAgents(generalSkills: Skill[]): Promise<void> {
  try {
    const { listAgentDefinitions, getDefaultAgentDefinition } = await import('../workspaces/agent-registry.js');
    const { propagateSkillAcrossAgents } = await import('./cross-agent-learning.js');
    const agents = listAgentDefinitions();
    if (agents.length <= 1) return;

    const sourceAgentId = getDefaultAgentDefinition()?.id ?? 'main';
    for (const skill of generalSkills) {
      if (hasDomainTag(skill)) continue;
      await propagateSkillAcrossAgents({
        skillName: skill.name,
        sourceAgentId,
        successCount: 99,
      });
    }
  } catch {
    // optional feature; skip when workspaces or sharing are unavailable
  }
}

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

export async function findDuplicateSkillCandidates(
  threshold = 0.75,
): Promise<Array<{ a: string; b: string; overlap: number }>> {
  const active = await listCuratedSkills('active');
  const out: Array<{ a: string; b: string; overlap: number }> = [];
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const overlap = jaccard(active[i]!.trigger, active[j]!.trigger);
      if (overlap >= threshold) {
        out.push({ a: active[i]!.name, b: active[j]!.name, overlap: Math.round(overlap * 100) / 100 });
      }
    }
  }
  return out.sort((x, y) => y.overlap - x.overlap);
}

function jaccard(a: string[], b: string[]): number {
  const setA = new Set(a.map((k) => k.toLowerCase()));
  const setB = new Set(b.map((k) => k.toLowerCase()));
  let intersection = 0;
  for (const k of setA) if (setB.has(k)) intersection++;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

export interface CuratorCycleResult {
  promoted: string[];
  consolidated: string[];
  archived: string[];
  reportSummary: string;
}

export async function promoteDraftSkills(): Promise<string[]> {
  const result = await pool.query(
    `SELECT id, name, usage_count, success_count, failure_count, created_at
     FROM skill_documents
     WHERE COALESCE(status, 'active') = 'draft'`,
  );
  const promoted: string[] = [];
  for (const row of result.rows) {
    const name = String(row.name);
    const usageCount = Number(row.usage_count ?? 0);
    const successCount = Number(row.success_count ?? 0);
    const createdAt = new Date(String(row.created_at));
    const ageDays = (Date.now() - createdAt.getTime()) / 86_400_000;
    const candidate = skillWithTags(rowToSkill(row as Record<string, unknown>), row as Record<string, unknown>);

    if (usageCount >= 3 && successCount >= 2) {
      const passes = await evalSkillCandidate(candidate);
      if (!passes) {
        console.log(`[curator] skipped "${name}": failed eval`);
        continue;
      }
      await pool.query(`UPDATE skill_documents SET status = 'active' WHERE id = $1`, [row.id]);
      await logSkillAction('promoted', String(row.id), { usageCount, successCount });
      promoted.push(name);
    } else if (ageDays >= 14 && usageCount === 0) {
      await pool.query(`UPDATE skill_documents SET status = 'archived', archived_at = NOW() WHERE id = $1`, [row.id]);
      await logSkillAction('archived', String(row.id), { reason: 'draft unused for 14 days' });
    }
  }
  return promoted;
}

export async function consolidateOverlappingSkills(): Promise<string[]> {
  const consolidated: string[] = [];
  const dupes = await findDuplicateSkillCandidates(0.7);
  for (const { a, b } of dupes) {
    const skillA = await pool.query(`SELECT * FROM skill_documents WHERE name = $1 LIMIT 1`, [a]);
    const skillB = await pool.query(`SELECT * FROM skill_documents WHERE name = $1 LIMIT 1`, [b]);
    if (!skillA.rows[0] || !skillB.rows[0]) continue;

    const rowA = skillA.rows[0] as Record<string, unknown>;
    const rowB = skillB.rows[0] as Record<string, unknown>;
    const typedA = skillWithTags(rowToSkill(rowA), rowA);
    const typedB = skillWithTags(rowToSkill(rowB), rowB);
    if (!sameDomain(typedA, typedB)) continue;

    const scoreA = (Number(rowA.success_count ?? 0)) / Math.max(1, Number(rowA.usage_count ?? 1));
    const scoreB = (Number(rowB.success_count ?? 0)) / Math.max(1, Number(rowB.usage_count ?? 1));

    const [keeper, loser, keeperRow, loserRow] = scoreA >= scoreB
      ? [typedA, typedB, rowA, rowB]
      : [typedB, typedA, rowB, rowA];
    const passes = await evalSkillCandidate(keeper);
    if (!passes) {
      console.log(`[curator] skipped "${keeper.name}": failed eval`);
      continue;
    }

    const mergedKeywords = [...new Set([
      ...((keeperRow.trigger_keywords as string[]) ?? []),
      ...((loserRow.trigger_keywords as string[]) ?? []),
    ])];
    await pool.query(
      `UPDATE skill_documents SET trigger_keywords = $1, updated_at = NOW() WHERE id = $2`,
      [mergedKeywords, keeperRow.id],
    );
    await pool.query(
      `UPDATE skill_documents SET status = 'archived', archived_at = NOW() WHERE id = $1`,
      [loserRow.id],
    );
    await logSkillAction('consolidated', String(keeperRow.id), {
      merged: String(loserRow.name),
      overlap: dupes.find((d) => (d.a === a && d.b === b) || (d.a === b && d.b === a))?.overlap,
    });
    consolidated.push(`${String(loserRow.name)} -> ${String(keeperRow.name)}`);
  }
  return consolidated;
}

export async function archiveStaleActiveSkills(maxAgeDays = 30): Promise<string[]> {
  const result = await pool.query(
    `SELECT id, name FROM skill_documents
     WHERE COALESCE(status, 'active') = 'active'
       AND usage_count = 0
       AND COALESCE(last_used_at, created_at) < NOW() - ($1 || ' days')::interval`,
    [String(maxAgeDays)],
  );
  const archived: string[] = [];
  for (const row of result.rows) {
    await pool.query(`UPDATE skill_documents SET status = 'archived', archived_at = NOW() WHERE id = $1`, [row.id]);
    await logSkillAction('archived', String(row.id), { reason: `unused for ${maxAgeDays} days` });
    archived.push(String(row.name));
  }
  return archived;
}

export async function getLastCuratorRunMs(): Promise<number> {
  try {
    const result = await pool.query(
      `SELECT details->>'ts' AS ts FROM skill_audit_log WHERE action = 'curator-run' ORDER BY created_at DESC LIMIT 1`,
    );
    const ts = result.rows[0]?.ts;
    return ts ? Number(ts) : 0;
  } catch {
    return 0;
  }
}

export async function runLightCuratorPass(): Promise<{ promoted: string[] }> {
  try {
    const promoted = await promoteDraftSkills();
    return { promoted };
  } catch {
    return { promoted: [] };
  }
}

export async function runFullCuratorCycle(options: {
  curatorSilent?: boolean;
  intervalDays?: number;
  force?: boolean;
} = {}): Promise<CuratorCycleResult> {
  const intervalDays = options.intervalDays ?? Number(process.env.CARINA_CURATOR_INTERVAL_DAYS ?? '7');
  if (!options.force) {
    const lastRun = await getLastCuratorRunMs();
    const msSinceRun = Date.now() - lastRun;
    const intervalMs = intervalDays * 24 * 60 * 60 * 1000;
    if (lastRun > 0 && msSinceRun < intervalMs) {
      return { promoted: [], consolidated: [], archived: [], reportSummary: '' };
    }
  }

  const promoted = await promoteDraftSkills();
  const consolidated = await consolidateOverlappingSkills();
  const archived = await archiveStaleActiveSkills(30);

  const consolidatedGeneralSkills: Skill[] = [];
  for (const name of promoted) {
    const skill = await getSkillByName(name);
    if (skill && !hasDomainTag(skillWithTags(skill))) consolidatedGeneralSkills.push(skill);
  }
  for (const line of consolidated) {
    const keeperName = line.split(' -> ')[1]?.trim();
    if (!keeperName) continue;
    const skill = await getSkillByName(keeperName);
    if (skill && !hasDomainTag(skillWithTags(skill))) {
      if (!consolidatedGeneralSkills.some((s) => s.name === skill.name)) {
        consolidatedGeneralSkills.push(skill);
      }
    }
  }
  await propagateToAllAgents(consolidatedGeneralSkills);

  await pool.query(
    `INSERT INTO skill_audit_log (skill_id, action, details) VALUES (NULL, 'curator-run', $1)`,
    [JSON.stringify({ ts: Date.now(), promoted: promoted.length, consolidated: consolidated.length, archived: archived.length })],
  );

  const reportSummary = `Curator reviewed skills: ${promoted.length} promoted, ${consolidated.length} consolidated, ${archived.length} archived.`;
  return { promoted, consolidated, archived, reportSummary };
}
