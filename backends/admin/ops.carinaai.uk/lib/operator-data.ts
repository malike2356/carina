import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { query } from './db.js';
import { resolveCarinaCliCommand } from './pty-bridge-core.js';
import { scoutConsoleGet } from './scout.js';

const execFileAsync = promisify(execFile);

async function execCarinaJson(args: string[]): Promise<Record<string, unknown>> {
  const { file, args: spawnArgs, cwd } = resolveCarinaCliCommand(args);
  const { stdout } = await execFileAsync(file, spawnArgs, {
    timeout: 20_000,
    env: { ...process.env, DOTENV_CONFIG_QUIET: 'true' },
    cwd,
    maxBuffer: 2 * 1024 * 1024,
  });
  const jsonStart = stdout.indexOf('{');
  const jsonEnd = stdout.lastIndexOf('}');
  if (jsonStart < 0 || jsonEnd <= jsonStart) {
    throw new Error('Carina CLI did not return JSON');
  }
  return JSON.parse(stdout.slice(jsonStart, jsonEnd + 1)) as Record<string, unknown>;
}

export interface DraftSkillRow {
  skill_id: string;
  skill_name: string;
  description: string;
  usage_count: number;
  success_count: number;
  failure_count: number;
  updated_at: string;
}

export interface CorrectionRow {
  event_id: string;
  event_type: string;
  skill_name: string | null;
  skill_id: string | null;
  created_at: string;
}

export interface ImprovementRow {
  event_id: string;
  event_type: string;
  skill_name: string | null;
  skill_id: string | null;
  version: number | null;
  summary: Record<string, unknown> | null;
  created_at: string;
}

export interface OperatorStatus {
  ok: true;
  generated_at: string;
  curator: {
    active: number;
    draft: number;
    archived: number;
    pruned: number;
  };
  learning: {
    events_last_24h: number;
    drafts_pending: number;
    promotions_last_7d: number;
    last_curator_run_at: string | null;
  };
  kanban: Record<string, number>;
  note: string;
}

async function learningMetricsFromDb(): Promise<OperatorStatus['learning']> {
  const [events, drafts, promotions, lastCurator] = await Promise.all([
    query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM learning_events
       WHERE created_at > NOW() - INTERVAL '24 hours'`,
    ),
    query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM skill_documents
       WHERE COALESCE(status, 'active') = 'draft'`,
    ),
    query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM skill_audit_log
       WHERE action = 'promoted' AND created_at > NOW() - INTERVAL '7 days'`,
    ),
    query<{ ts: string | null }>(
      `SELECT details->>'ts' AS ts FROM skill_audit_log
       WHERE action = 'curator-run' ORDER BY created_at DESC LIMIT 1`,
    ),
  ]);

  const lastTs = lastCurator.rows[0]?.ts;
  return {
    events_last_24h: Number(events.rows[0]?.count ?? 0),
    drafts_pending: Number(drafts.rows[0]?.count ?? 0),
    promotions_last_7d: Number(promotions.rows[0]?.count ?? 0),
    last_curator_run_at: lastTs ? new Date(Number(lastTs)).toISOString() : null,
  };
}

export async function getOperatorStatus(): Promise<OperatorStatus> {
  const [skills, kanban, learning] = await Promise.all([
    query<{ status: string; count: string }>(
      `SELECT COALESCE(status, 'active') AS status, COUNT(*)::text AS count
       FROM skill_documents
       GROUP BY COALESCE(status, 'active')`,
    ),
    query<{ column_name: string; count: string }>(
      `SELECT column_name, COUNT(*)::text AS count
       FROM kanban_cards
       GROUP BY column_name`,
    ),
    learningMetricsFromDb(),
  ]);

  const skillCounts: Record<string, number> = {};
  for (const row of skills.rows) {
    skillCounts[row.status] = Number(row.count);
  }

  const kanbanCounts: Record<string, number> = {};
  for (const row of kanban.rows) {
    kanbanCounts[row.column_name] = Number(row.count);
  }

  return {
    ok: true,
    generated_at: new Date().toISOString(),
    curator: {
      active: skillCounts.active ?? 0,
      draft: skillCounts.draft ?? 0,
      archived: skillCounts.archived ?? 0,
      pruned: skillCounts.pruned ?? 0,
    },
    learning,
    kanban: kanbanCounts,
    note: 'Read-only operator summary. Promote or archive drafts here; run carina curator on the host for automated passes.',
  };
}

export async function getLearningPending(): Promise<{
  ok: true;
  drafts: DraftSkillRow[];
  recent_corrections: CorrectionRow[];
}> {
  const [drafts, events] = await Promise.all([
    query<{
      id: string;
      name: string;
      description: string;
      usage_count: string;
      success_count: string;
      failure_count: string;
      updated_at: string;
    }>(
      `SELECT id, name, description, usage_count, success_count, failure_count, updated_at
       FROM skill_documents
       WHERE COALESCE(status, 'active') = 'draft'
       ORDER BY updated_at DESC
       LIMIT 50`,
    ),
    query<{
      id: string;
      event_type: string;
      skill_name: string | null;
      skill_id: string | null;
      created_at: string;
    }>(
      `SELECT id, event_type, skill_name, skill_id, created_at
       FROM learning_events
       WHERE event_type IN ('skill_conflict_resolved', 'skill_refined', 'preference_learned')
       ORDER BY created_at DESC
       LIMIT 30`,
    ),
  ]);

  return {
    ok: true,
    drafts: drafts.rows.map((row) => ({
      skill_id: row.id,
      skill_name: row.name,
      description: row.description,
      usage_count: Number(row.usage_count),
      success_count: Number(row.success_count),
      failure_count: Number(row.failure_count),
      updated_at: row.updated_at,
    })),
    recent_corrections: events.rows.map((row) => ({
      event_id: row.id,
      event_type: row.event_type,
      skill_name: row.skill_name,
      skill_id: row.skill_id,
      created_at: row.created_at,
    })),
  };
}

export async function getLearningImprovements(): Promise<{ ok: true; improvements: ImprovementRow[] }> {
  const events = await query<{
    id: string;
    event_type: string;
    skill_name: string | null;
    skill_id: string | null;
    version: string | null;
    output_summary: Record<string, unknown> | null;
    created_at: string;
  }>(
    `SELECT id, event_type, skill_name, skill_id, version, output_summary, created_at
     FROM learning_events
     WHERE event_type IN ('skill_created', 'skill_refined', 'skill_conflict_resolved', 'skill_rolled_back')
     ORDER BY created_at DESC
     LIMIT 50`,
  );

  return {
    ok: true,
    improvements: events.rows.map((row) => ({
      event_id: row.id,
      event_type: row.event_type,
      skill_name: row.skill_name,
      skill_id: row.skill_id,
      version: row.version == null ? null : Number(row.version),
      summary: row.output_summary,
      created_at: row.created_at,
    })),
  };
}

export async function getCapabilitiesAudit(): Promise<Record<string, unknown>> {
  try {
    const audit = await execCarinaJson(['capabilities', 'audit', '--json']);
    return { ok: true, source: 'carina-cli', audit };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: true,
      source: 'fallback',
      note: 'Run carina capabilities audit on the gateway host for live inventory',
      error: msg,
      targets: { tools: 99, skills: 115, channels: 50 },
    };
  }
}

export async function getSecurityPosture(): Promise<Record<string, unknown>> {
  const [scoutPosture, trustState] = await Promise.all([
    scoutConsoleGet('/api/security/posture') as Promise<Record<string, unknown> | null>,
    execCarinaJson(['security', 'trust', '--json']).catch(() => null),
  ]);

  return {
    ok: true,
    generated_at: new Date().toISOString(),
    scout: scoutPosture ?? { ok: false, note: 'Scout offline or posture API unavailable' },
    carina: trustState ?? { note: 'Run carina security trust on gateway host' },
  };
}

export async function promoteDraftSkill(skillId: string): Promise<boolean> {
  const result = await query<{ id: string }>(
    `UPDATE skill_documents
     SET status = 'active', updated_at = NOW()
     WHERE id = $1 AND COALESCE(status, 'active') = 'draft'
     RETURNING id`,
    [skillId],
  );
  if (!result.rows[0]) return false;
  await query(
    `INSERT INTO skill_audit_log (skill_id, action, details) VALUES ($1, 'promoted', $2)`,
    [skillId, JSON.stringify({ source: 'ops-panel', manual: true })],
  );
  return true;
}

export async function archiveDraftSkill(skillId: string): Promise<boolean> {
  const result = await query<{ id: string }>(
    `UPDATE skill_documents
     SET status = 'archived', archived_at = NOW(), updated_at = NOW()
     WHERE id = $1 AND COALESCE(status, 'active') = 'draft'
     RETURNING id`,
    [skillId],
  );
  if (!result.rows[0]) return false;
  await query(
    `INSERT INTO skill_audit_log (skill_id, action, details) VALUES ($1, 'archived', $2)`,
    [skillId, JSON.stringify({ source: 'ops-panel', reason: 'operator discarded draft' })],
  );
  return true;
}

export function formatEventType(eventType: string): string {
  return eventType.replace(/_/g, ' ');
}
