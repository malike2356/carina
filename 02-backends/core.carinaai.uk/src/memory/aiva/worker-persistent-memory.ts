import { pool } from '../db.js';
import { embed } from '../embeddings.js';
import pgvector from 'pgvector/pg';
import {
  filterMemoryFactsForInjection,
  validateMemoryContent,
} from '../memory-discipline.js';
import { guardMemoryWrite } from '../memory-write-guard.js';
import type { MemoryTarget } from '../persistent-memory.js';
import { MEMORY_BUDGETS } from '../persistent-memory.js';

export type WorkerMemoryTarget = MemoryTarget;

export interface WorkerPersistentFact {
  id: string;
  workspaceId: string;
  workerId: string;
  contactId: string | null;
  target: WorkerMemoryTarget;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

let schemaReady: Promise<void> | null = null;

/**
 * Hermes frozen-snapshot cache: USER/MEMORY text is stable across turns until a
 * write invalidates generation for that workspace+worker. Mid-session writes
 * hit disk/DB immediately but do not rewrite the live prompt until next rebuild.
 */
const frozenCoreByKey = new Map<string, { generation: number; text: string }>();
const generationByWorker = new Map<string, number>();

function workerGenerationKey(workspaceId: string, workerId: string): string {
  return `${workspaceId}:${workerId}`;
}

function frozenCoreKey(
  workspaceId: string,
  workerId: string,
  contactId?: string | null,
): string {
  return `${workspaceId}:${workerId}:${contactId ?? ''}`;
}

export function invalidateWorkerDurableMemorySnapshot(
  workspaceId: string,
  workerId: string,
): void {
  const genKey = workerGenerationKey(workspaceId, workerId);
  generationByWorker.set(genKey, (generationByWorker.get(genKey) ?? 0) + 1);
  const prefix = `${workspaceId}:${workerId}:`;
  for (const key of [...frozenCoreByKey.keys()]) {
    if (key.startsWith(prefix)) frozenCoreByKey.delete(key);
  }
}

export function clearWorkerDurableMemorySnapshotsForTests(): void {
  frozenCoreByKey.clear();
  generationByWorker.clear();
}

export async function ensureWorkerPersistentMemorySchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS aiva_worker_persistent_facts (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          workspace_id UUID NOT NULL,
          worker_id UUID NOT NULL REFERENCES ai_workers(id) ON DELETE CASCADE,
          contact_id TEXT,
          target TEXT NOT NULL CHECK (target IN ('user', 'memory')),
          content TEXT NOT NULL,
          embedding VECTOR(768),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_aiva_worker_facts_scope
          ON aiva_worker_persistent_facts (workspace_id, worker_id, target, created_at);
        CREATE INDEX IF NOT EXISTS idx_aiva_worker_facts_contact
          ON aiva_worker_persistent_facts (workspace_id, worker_id, contact_id, target)
          WHERE contact_id IS NOT NULL;
      `);
    })().catch((err) => {
      schemaReady = null;
      throw err;
    });
  }
  await schemaReady;
}

function mapRow(row: Record<string, unknown>): WorkerPersistentFact {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    workerId: String(row.worker_id),
    contactId: row.contact_id ? String(row.contact_id) : null,
    target: row.target === 'user' ? 'user' : 'memory',
    content: String(row.content),
    createdAt: new Date(String(row.created_at)),
    updatedAt: new Date(String(row.updated_at)),
  };
}

export async function listWorkerPersistentFacts(opts: {
  workspaceId: string;
  workerId: string;
  target: WorkerMemoryTarget;
  contactId?: string | null;
}): Promise<WorkerPersistentFact[]> {
  await ensureWorkerPersistentMemorySchema();
  if (opts.target === 'user' && opts.contactId) {
    const result = await pool.query(
      `SELECT * FROM aiva_worker_persistent_facts
       WHERE workspace_id = $1 AND worker_id = $2 AND target = 'user'
         AND (contact_id IS NULL OR contact_id = $3)
       ORDER BY created_at ASC`,
      [opts.workspaceId, opts.workerId, opts.contactId],
    );
    return result.rows.map(mapRow);
  }
  const result = await pool.query(
    `SELECT * FROM aiva_worker_persistent_facts
     WHERE workspace_id = $1 AND worker_id = $2 AND target = $3
     ORDER BY created_at ASC`,
    [opts.workspaceId, opts.workerId, opts.target],
  );
  return result.rows.map(mapRow);
}

export async function getWorkerPersistentFactsTotal(opts: {
  workspaceId: string;
  workerId: string;
  target: WorkerMemoryTarget;
  contactId?: string | null;
}): Promise<number> {
  const facts = await listWorkerPersistentFacts(opts);
  return facts.reduce((sum, fact) => sum + fact.content.length, 0);
}

export async function addWorkerPersistentFact(opts: {
  workspaceId: string;
  workerId: string;
  target: WorkerMemoryTarget;
  content: string;
  contactId?: string | null;
  sessionId?: string;
}): Promise<WorkerPersistentFact> {
  await ensureWorkerPersistentMemorySchema();
  const trimmed = opts.content.trim();
  const validation = validateMemoryContent(trimmed);
  if (!validation.ok) throw new Error(validation.reason);

  const sessionId =
    opts.sessionId
    ?? `aiva-fact:${opts.workspaceId}:${opts.workerId}:${opts.target}`;
  const guard = await guardMemoryWrite(trimmed, 'inference', sessionId);
  if (!guard.allowed) {
    throw new Error('Memory write blocked by security guard');
  }

  const current = await getWorkerPersistentFactsTotal({
    workspaceId: opts.workspaceId,
    workerId: opts.workerId,
    target: opts.target,
    contactId: opts.contactId,
  });
  const budget = MEMORY_BUDGETS[opts.target];
  if (current + trimmed.length > budget) {
    throw new Error(
      `Memory at ${current}/${budget} chars. Adding this entry (${trimmed.length} chars) would exceed the limit. `
      + 'Consolidate with replace or remove stale entries, then retry.',
    );
  }

  const existing = await listWorkerPersistentFacts({
    workspaceId: opts.workspaceId,
    workerId: opts.workerId,
    target: opts.target,
    contactId: opts.contactId,
  });
  const duplicate = existing.find((f) => f.content.trim().toLowerCase() === trimmed.toLowerCase());
  if (duplicate) return duplicate;

  const embedding = await embed(trimmed);
  const vectorSql = embedding.length > 0 ? pgvector.toSql(embedding) : null;
  const contactId = opts.target === 'user' ? (opts.contactId ?? null) : null;
  const result = await pool.query(
    `INSERT INTO aiva_worker_persistent_facts
       (workspace_id, worker_id, contact_id, target, content, embedding)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [opts.workspaceId, opts.workerId, contactId, opts.target, trimmed, vectorSql],
  );
  invalidateWorkerDurableMemorySnapshot(opts.workspaceId, opts.workerId);
  return mapRow(result.rows[0]);
}

export async function removeWorkerPersistentFact(opts: {
  workspaceId: string;
  workerId: string;
  idOrText: string;
}): Promise<{ removed: number; ids: string[] }> {
  await ensureWorkerPersistentMemorySchema();
  const needle = opts.idOrText.trim();
  if (!needle) return { removed: 0, ids: [] };

  const byId = await pool.query(
    `DELETE FROM aiva_worker_persistent_facts
     WHERE workspace_id = $1 AND worker_id = $2 AND id::text = $3
     RETURNING id`,
    [opts.workspaceId, opts.workerId, needle],
  );
  if (byId.rowCount && byId.rowCount > 0) {
    invalidateWorkerDurableMemorySnapshot(opts.workspaceId, opts.workerId);
    return { removed: byId.rowCount, ids: byId.rows.map((r) => String(r.id)) };
  }

  const matches = await pool.query(
    `SELECT id, content FROM aiva_worker_persistent_facts
     WHERE workspace_id = $1 AND worker_id = $2
       AND content ILIKE '%' || $3 || '%'
     ORDER BY created_at ASC`,
    [opts.workspaceId, opts.workerId, needle],
  );
  if (matches.rows.length === 0) return { removed: 0, ids: [] };
  if (matches.rows.length > 1) {
    throw new Error(
      `Multiple memory entries match "${needle}". Be more specific or pass the entry id.`,
    );
  }
  const id = String(matches.rows[0].id);
  await pool.query(`DELETE FROM aiva_worker_persistent_facts WHERE id = $1`, [id]);
  invalidateWorkerDurableMemorySnapshot(opts.workspaceId, opts.workerId);
  return { removed: 1, ids: [id] };
}

export async function replaceWorkerPersistentFact(opts: {
  workspaceId: string;
  workerId: string;
  oldText: string;
  content: string;
  target?: WorkerMemoryTarget;
  contactId?: string | null;
}): Promise<WorkerPersistentFact> {
  const needle = opts.oldText.trim();
  const facts = await pool.query(
    `SELECT * FROM aiva_worker_persistent_facts
     WHERE workspace_id = $1 AND worker_id = $2
       AND content ILIKE '%' || $3 || '%'
       ${opts.target ? 'AND target = $4' : ''}
     ORDER BY created_at ASC`,
    opts.target
      ? [opts.workspaceId, opts.workerId, needle, opts.target]
      : [opts.workspaceId, opts.workerId, needle],
  );
  if (facts.rows.length === 0) throw new Error(`No memory entry matched "${needle}"`);
  if (facts.rows.length > 1) {
    throw new Error(`Multiple entries matched "${needle}". Use a more specific substring.`);
  }
  const existing = mapRow(facts.rows[0]);
  await pool.query(`DELETE FROM aiva_worker_persistent_facts WHERE id = $1`, [existing.id]);
  // addWorkerPersistentFact invalidates the snapshot
  return addWorkerPersistentFact({
    workspaceId: opts.workspaceId,
    workerId: opts.workerId,
    target: opts.target ?? existing.target,
    content: opts.content,
    contactId: opts.contactId ?? existing.contactId,
  });
}

export async function getWorkerMemoryBudgetStatus(opts: {
  workspaceId: string;
  workerId: string;
  target: WorkerMemoryTarget;
  contactId?: string | null;
}): Promise<{ target: WorkerMemoryTarget; used: number; max: number; percent: number }> {
  const used = await getWorkerPersistentFactsTotal(opts);
  const max = MEMORY_BUDGETS[opts.target];
  return {
    target: opts.target,
    used,
    max,
    percent: max > 0 ? Math.round((used / max) * 100) : 0,
  };
}

async function buildFrozenUserMemoryCore(opts: {
  workspaceId: string;
  workerId: string;
  contactId?: string | null;
}): Promise<string> {
  const genKey = workerGenerationKey(opts.workspaceId, opts.workerId);
  const generation = generationByWorker.get(genKey) ?? 0;
  const key = frozenCoreKey(opts.workspaceId, opts.workerId, opts.contactId);
  const cached = frozenCoreByKey.get(key);
  if (cached && cached.generation === generation) return cached.text;

  const [userFacts, memoryFacts, userBudget, memoryBudget] = await Promise.all([
    listWorkerPersistentFacts({
      workspaceId: opts.workspaceId,
      workerId: opts.workerId,
      target: 'user',
      contactId: opts.contactId,
    }),
    listWorkerPersistentFacts({
      workspaceId: opts.workspaceId,
      workerId: opts.workerId,
      target: 'memory',
    }),
    getWorkerMemoryBudgetStatus({
      workspaceId: opts.workspaceId,
      workerId: opts.workerId,
      target: 'user',
      contactId: opts.contactId,
    }),
    getWorkerMemoryBudgetStatus({
      workspaceId: opts.workspaceId,
      workerId: opts.workerId,
      target: 'memory',
    }),
  ]);

  const userLines = filterMemoryFactsForInjection(userFacts.map((f) => f.content));
  const memoryLines = filterMemoryFactsForInjection(memoryFacts.map((f) => f.content));
  const parts: string[] = [];

  if (userLines.length > 0) {
    parts.push(
      `USER PROFILE [${userBudget.percent}%; ${userBudget.used}/${userBudget.max} chars]`,
      userLines.join('\n§\n'),
    );
  } else {
    parts.push(`USER PROFILE [${userBudget.percent}%; ${userBudget.used}/${userBudget.max} chars]: (empty)`);
  }

  if (memoryLines.length > 0) {
    parts.push(
      `MEMORY / agent notes [${memoryBudget.percent}%; ${memoryBudget.used}/${memoryBudget.max} chars]`,
      memoryLines.join('\n§\n'),
    );
  } else {
    parts.push(
      `MEMORY / agent notes [${memoryBudget.percent}%; ${memoryBudget.used}/${memoryBudget.max} chars]: (empty)`,
    );
  }

  const text = parts.join('\n');
  frozenCoreByKey.set(key, { generation, text });
  return text;
}

/**
 * Hermes-style clear split injection:
 * - USER profile (bounded, frozen until write)
 * - MEMORY notes (bounded, frozen until write)
 * - pinned preferences (legacy, refreshed each turn)
 */
export async function buildWorkerDurableMemorySuffix(opts: {
  workspaceId: string;
  workerId: string;
  contactId?: string | null;
  pinnedLines?: string[];
}): Promise<string> {
  const frozenCore = await buildFrozenUserMemoryCore(opts);
  const parts: string[] = [
    '',
    'Durable memory (Hermes-style clear split):',
    '- Always-on curated facts below are bounded and frozen for this session until memory writes.',
    '- Do not dump raw chat into them.',
    '- For older conversation details, use worker-conversation-search (this worker only).',
    '- External memory providers are optional and additive when configured.',
    frozenCore,
  ];

  if (opts.pinnedLines && opts.pinnedLines.length > 0) {
    parts.push('Pinned preferences (manual):', ...opts.pinnedLines.map((line) => `- ${line}`));
  }

  return parts.join('\n');
}

/**
 * Procedural skills memory (Hermes skills layer): titles/triggers/steps for this
 * worker only. Never loads host skill MD.
 */
export async function buildWorkerProceduralSkillsSuffix(opts: {
  workspaceId: string;
  workerId: string;
  maxSkills?: number;
}): Promise<string> {
  try {
    const { listWorkerSkills } = await import('../../workers/aiva-parity-store.js');
    const skills = (await listWorkerSkills(opts.workspaceId, opts.workerId))
      .filter((s) => s.status === 'active')
      .slice(0, Math.min(Math.max(opts.maxSkills ?? 8, 1), 16));
    if (skills.length === 0) return '';

    const blocks = skills.map((skill, index) => {
      const triggers = skill.triggerHints.length > 0
        ? `Triggers: ${skill.triggerHints.slice(0, 6).join('; ')}`
        : '';
      const steps = skill.steps
        .slice(0, 6)
        .map((step, stepIndex) => {
          const text = typeof step === 'string' ? step : JSON.stringify(step);
          return `  ${stepIndex + 1}. ${text.slice(0, 160)}`;
        })
        .join('\n');
      return [
        `${index + 1}. ${skill.title}${skill.description ? `: ${skill.description.slice(0, 120)}` : ''}`,
        triggers,
        steps ? `Steps:\n${steps}` : '',
        `Skill id: ${skill.id}`,
      ].filter(Boolean).join('\n');
    });

    return [
      '',
      'Procedural skills (this Aiva only; use worker-skills to list/run):',
      ...blocks,
    ].join('\n');
  } catch {
    return '';
  }
}
