import { Router } from 'express';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { query } from '../lib/db.js';
import { scoutGet } from '../lib/scout.js';

const execFileAsync = promisify(execFile);

export const operatorRouter = Router();

async function learningMetricsFromDb(): Promise<Record<string, unknown>> {
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

operatorRouter.get('/status', async (_req, res) => {
  try {
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

    res.json({
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
      note: 'Read-only operator summary. Use carina learning / carina curator on the host.',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ ok: false, error: msg });
  }
});

operatorRouter.get('/security', async (_req, res) => {
  try {
    const [scoutPosture, trustState] = await Promise.all([
      scoutGet('/api/security/posture') as Promise<Record<string, unknown> | null>,
      execFileAsync('carina', ['security', 'trust', '--json'], {
        timeout: 15_000,
        env: process.env,
        maxBuffer: 1024 * 1024,
      }).then((r) => JSON.parse(r.stdout) as Record<string, unknown>).catch(() => null),
    ]);

    res.json({
      ok: true,
      generated_at: new Date().toISOString(),
      scout: scoutPosture ?? { ok: false, note: 'Scout offline or posture API unavailable' },
      carina: trustState ?? { note: 'Run carina security trust on gateway host' },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ ok: false, error: msg });
  }
});

operatorRouter.get('/capabilities', async (_req, res) => {
  try {
    const { stdout } = await execFileAsync('carina', ['capabilities', 'audit', '--json'], {
      timeout: 20_000,
      env: process.env,
      maxBuffer: 2 * 1024 * 1024,
    });
    const audit = JSON.parse(stdout) as Record<string, unknown>;
    res.json({ ok: true, source: 'carina-cli', audit });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.json({
      ok: true,
      source: 'fallback',
      note: 'Run carina capabilities audit on the gateway host for live inventory',
      error: msg,
      targets: { tools: 99, skills: 115, channels: 50 },
    });
  }
});

operatorRouter.get('/learning/pending', async (_req, res) => {
  try {
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

    res.json({
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
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ ok: false, error: msg });
  }
});

operatorRouter.get('/learning/improvements', async (_req, res) => {
  try {
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

    res.json({
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
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ ok: false, error: msg });
  }
});

operatorRouter.get('/learning/events', async (req, res) => {
  try {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 30)));
    const events = await query<{
      id: string;
      event_type: string;
      skill_name: string | null;
      created_at: string;
      input_summary: Record<string, unknown> | null;
      output_summary: Record<string, unknown> | null;
    }>(
      `SELECT id, event_type, skill_name, created_at, input_summary, output_summary
       FROM learning_events
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit],
    );
    res.json({ ok: true, events: events.rows });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ ok: false, error: msg });
  }
});
