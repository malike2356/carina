import { pool } from '../memory/db.js';
import { registry } from '../tools/registry.js';
import { logSelfModEvent } from '../security/self-mod-logger.js';

const ALPHA = 0.3;
const QUARANTINE_THRESHOLD = parseFloat(process.env.CARINA_MUTATION_QUALITY_QUARANTINE ?? '0.3');
const PROMOTE_THRESHOLD = parseFloat(process.env.CARINA_MUTATION_QUALITY_PROMOTE ?? '0.85');
const PROMOTE_MIN_USES = parseInt(process.env.CARINA_MUTATION_QUALITY_PROMOTE_MIN_USES ?? '5', 10);

export type QualityOutcome = 'success' | 'failure' | 'partial';

export interface QualitySample {
  id: string;
  toolId: string;
  tenantId: string;
  sessionId?: string;
  outcome: QualityOutcome;
  score: number;
  errorSummary?: string;
  durationMs?: number;
  sampledAt: string;
}

export function outcomeToScore(outcome: QualityOutcome): number {
  if (outcome === 'success') return 1.0;
  if (outcome === 'partial') return 0.5;
  return 0.0;
}

export function computeEma(prevScore: number | null, sample: number): number {
  if (prevScore === null) return sample;
  return ALPHA * sample + (1 - ALPHA) * prevScore;
}

export async function recordToolOutcome(opts: {
  toolName: string;
  tenantId: string;
  sessionId?: string;
  outcome: QualityOutcome;
  errorSummary?: string;
  durationMs?: number;
}): Promise<void> {
  if (process.env.CARINA_MUTATION_QUALITY === 'false') return;

  const toolRow = await pool.query<{ id: string; quality_score: number | null; times_used: number }>(
    `SELECT id, quality_score, times_used FROM runtime_tools WHERE name = $1 AND status = 'active' LIMIT 1`,
    [opts.toolName],
  );
  if (!toolRow.rows[0]) return;

  const { id: toolId, quality_score: prevScore, times_used: timesUsed } = toolRow.rows[0];
  const sample = outcomeToScore(opts.outcome);
  const newScore = computeEma(prevScore, sample);

  await pool.query(
    `INSERT INTO runtime_tool_quality_samples
       (tool_id, tenant_id, session_id, outcome, score, error_summary, duration_ms)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [toolId, opts.tenantId, opts.sessionId ?? null, opts.outcome, sample,
      opts.errorSummary ?? null, opts.durationMs ?? null],
  );

  await pool.query(
    `UPDATE runtime_tools SET quality_score = $1, updated_at = NOW() WHERE id = $2`,
    [newScore, toolId],
  );

  await checkAutoQuarantine(toolId, opts.toolName, newScore);
  await checkAutoPromote(toolId, opts.toolName, newScore, timesUsed + 1);
}

async function checkAutoQuarantine(toolId: string, toolName: string, score: number): Promise<void> {
  if (score >= QUARANTINE_THRESHOLD) return;

  const reason = `Quality score ${score.toFixed(3)} fell below quarantine threshold ${QUARANTINE_THRESHOLD}`;

  await pool.query(
    `UPDATE runtime_tools SET status = 'disabled', quarantined_at = NOW(), quarantine_reason = $1, updated_at = NOW() WHERE id = $2`,
    [reason, toolId],
  );

  registry.unregister(toolName);

  void logSelfModEvent('TOOL_AUTO_QUARANTINE', {
    tool_name: toolName,
    quality_score: score,
    reason,
  });
}

async function checkAutoPromote(toolId: string, toolName: string, score: number, useCount: number): Promise<void> {
  if (score < PROMOTE_THRESHOLD || useCount < PROMOTE_MIN_USES) return;

  const result = await pool.query<{ promoted: boolean }>(
    `SELECT promoted FROM runtime_tools WHERE id = $1`,
    [toolId],
  );
  if (result.rows[0]?.promoted) return;

  await pool.query(
    `UPDATE runtime_tools SET promoted = TRUE, updated_at = NOW() WHERE id = $1`,
    [toolId],
  );

  void logSelfModEvent('TOOL_AUTO_PROMOTED', {
    tool_name: toolName,
    quality_score: score,
    use_count: useCount,
  });
}

export async function getQualityHistory(toolId: string, limit = 50): Promise<QualitySample[]> {
  const result = await pool.query<{
    id: string;
    tool_id: string;
    tenant_id: string;
    session_id: string | null;
    outcome: string;
    score: number;
    error_summary: string | null;
    duration_ms: number | null;
    sampled_at: string;
  }>(
    `SELECT * FROM runtime_tool_quality_samples WHERE tool_id = $1 ORDER BY sampled_at DESC LIMIT $2`,
    [toolId, limit],
  );
  return result.rows.map((r) => ({
    id: r.id,
    toolId: r.tool_id,
    tenantId: r.tenant_id,
    sessionId: r.session_id ?? undefined,
    outcome: r.outcome as QualityOutcome,
    score: r.score,
    errorSummary: r.error_summary ?? undefined,
    durationMs: r.duration_ms ?? undefined,
    sampledAt: r.sampled_at,
  }));
}
