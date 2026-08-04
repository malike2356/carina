import { pool } from '../memory/db.js';

export interface CompoundingMetrics {
  tenantId: string;
  totalTools: number;
  activeTools: number;
  promotedTools: number;
  quarantinedTools: number;
  avgQualityScore: number | null;
  totalToolUses: number;
  evolvedPrompts: number;
  activeOverrides: number;
  pendingGapProposals: number;
  divergenceScore: number;
  computedAt: string;
}

export async function computeCompoundingMetrics(tenantId: string): Promise<CompoundingMetrics> {
  const [toolStats, promptStats, gapStats] = await Promise.all([
    pool.query<{
      total: string;
      active: string;
      promoted: string;
      quarantined: string;
      avg_quality: number | null;
      total_uses: string;
    }>(
      `SELECT
         COUNT(*) AS total,
         COUNT(*) FILTER (WHERE status = 'active') AS active,
         COUNT(*) FILTER (WHERE promoted = TRUE) AS promoted,
         COUNT(*) FILTER (WHERE status = 'disabled' AND quarantined_at IS NOT NULL) AS quarantined,
         AVG(quality_score) FILTER (WHERE status = 'active') AS avg_quality,
         COALESCE(SUM(times_used), 0) AS total_uses
       FROM runtime_tools`,
    ),
    pool.query<{ evolved: string; active: string }>(
      `SELECT
         COUNT(*) FILTER (WHERE activated_at IS NOT NULL) AS evolved,
         COUNT(*) FILTER (WHERE is_active = TRUE) AS active
       FROM system_prompt_overrides
       WHERE tenant_id = $1`,
      [tenantId],
    ),
    pool.query<{ pending: string }>(
      `SELECT COUNT(*) AS pending FROM tool_gap_proposals
       WHERE tenant_id = $1 AND status = 'pending'`,
      [tenantId],
    ),
  ]);

  const ts = toolStats.rows[0]!;
  const ps = promptStats.rows[0]!;
  const gs = gapStats.rows[0]!;

  const activeTools = Number(ts.active);
  const promotedTools = Number(ts.promoted);
  const evolvedPrompts = Number(ps.evolved);

  const toolComponent = Math.min(activeTools / 20, 1.0) * 0.40;
  const promotedComponent = Math.min(promotedTools / 10, 1.0) * 0.30;
  const promptComponent = Math.min(evolvedPrompts / 5, 1.0) * 0.30;
  const raw = toolComponent + promotedComponent + promptComponent;
  const divergenceScore = Math.min(Math.max(raw, 0), 1);

  return {
    tenantId,
    totalTools: Number(ts.total),
    activeTools,
    promotedTools,
    quarantinedTools: Number(ts.quarantined),
    avgQualityScore: ts.avg_quality ?? null,
    totalToolUses: Number(ts.total_uses),
    evolvedPrompts,
    activeOverrides: Number(ps.active),
    pendingGapProposals: Number(gs.pending),
    divergenceScore: Math.round(divergenceScore * 1000) / 1000,
    computedAt: new Date().toISOString(),
  };
}
