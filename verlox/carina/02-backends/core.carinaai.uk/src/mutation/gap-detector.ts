import crypto from 'crypto';
import { pool } from '../memory/db.js';
import { logSelfModEvent } from '../security/self-mod-logger.js';

export const TOOL_GAP_PROPOSALS_MIGRATION = `
CREATE TABLE IF NOT EXISTS tool_gap_proposals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       TEXT NOT NULL,
  session_id      TEXT,
  missing_tool    TEXT NOT NULL,
  task_context    TEXT,
  proposed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','synthesized','dismissed','expired')),
  tool_id         UUID REFERENCES runtime_tools(id),
  idempotency_key TEXT UNIQUE
);
CREATE INDEX IF NOT EXISTS idx_tgp_tenant_status ON tool_gap_proposals(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_tgp_proposed ON tool_gap_proposals(proposed_at DESC);
`;

export interface GapProposal {
  id: string;
  tenantId: string;
  sessionId?: string;
  missingTool: string;
  taskContext?: string;
  status: 'pending' | 'synthesized' | 'dismissed' | 'expired';
  proposedAt: string;
  toolId?: string;
}

function idempotencyKey(tenantId: string, toolName: string): string {
  return crypto
    .createHash('sha256')
    .update(`${tenantId}|${toolName}`)
    .digest('hex')
    .slice(0, 40);
}

export async function onToolMiss(opts: {
  toolName: string;
  tenantId: string;
  sessionId?: string;
  taskContext?: string;
}): Promise<GapProposal | null> {
  if (process.env.CARINA_AUTO_SYNTHESIS !== 'true') {
    void logSelfModEvent('TOOL_GAP_DETECTED', {
      tool_name: opts.toolName,
      auto_synthesis: false,
      tenant_id: opts.tenantId,
    });
    return null;
  }

  const key = idempotencyKey(opts.tenantId, opts.toolName);

  const existing = await pool.query<{ id: string; status: string }>(
    `SELECT id, status FROM tool_gap_proposals
     WHERE idempotency_key = $1 AND proposed_at > NOW() - INTERVAL '1 hour'
     LIMIT 1`,
    [key],
  );
  if (existing.rows[0]) return null;

  const activeCheck = await pool.query<{ id: string }>(
    `SELECT id FROM runtime_tools WHERE name = $1 AND status = 'active' LIMIT 1`,
    [opts.toolName],
  );
  if (activeCheck.rows[0]) return null;

  const result = await pool.query<{ id: string; proposed_at: string }>(
    `INSERT INTO tool_gap_proposals
       (tenant_id, session_id, missing_tool, task_context, idempotency_key)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (idempotency_key) DO NOTHING
     RETURNING id, proposed_at`,
    [opts.tenantId, opts.sessionId ?? null, opts.toolName,
      opts.taskContext?.slice(0, 500) ?? null, key],
  );

  if (!result.rows[0]) return null;

  void logSelfModEvent('TOOL_GAP_PROPOSED', {
    tool_name: opts.toolName,
    tenant_id: opts.tenantId,
    proposal_id: result.rows[0].id,
  });

  return {
    id: result.rows[0].id,
    tenantId: opts.tenantId,
    sessionId: opts.sessionId,
    missingTool: opts.toolName,
    taskContext: opts.taskContext,
    status: 'pending',
    proposedAt: result.rows[0].proposed_at,
  };
}

export async function dismissGapProposal(id: string): Promise<void> {
  await pool.query(
    `UPDATE tool_gap_proposals SET status = 'dismissed' WHERE id = $1`,
    [id],
  );
}

export async function markGapSynthesized(proposalId: string, toolId: string): Promise<void> {
  await pool.query(
    `UPDATE tool_gap_proposals SET status = 'synthesized', tool_id = $1 WHERE id = $2`,
    [toolId, proposalId],
  );
}

export async function listGapProposals(opts: {
  tenantId: string;
  status?: string;
  limit?: number;
}): Promise<GapProposal[]> {
  const conditions = [`tenant_id = $1`];
  const values: unknown[] = [opts.tenantId];
  if (opts.status) {
    conditions.push(`status = $${values.length + 1}`);
    values.push(opts.status);
  }
  const result = await pool.query<{
    id: string;
    tenant_id: string;
    session_id: string | null;
    missing_tool: string;
    task_context: string | null;
    status: string;
    proposed_at: string;
    tool_id: string | null;
  }>(
    `SELECT * FROM tool_gap_proposals WHERE ${conditions.join(' AND ')}
     ORDER BY proposed_at DESC LIMIT $${values.length + 1}`,
    [...values, opts.limit ?? 50],
  );
  return result.rows.map((r) => ({
    id: r.id,
    tenantId: r.tenant_id,
    sessionId: r.session_id ?? undefined,
    missingTool: r.missing_tool,
    taskContext: r.task_context ?? undefined,
    status: r.status as GapProposal['status'],
    proposedAt: r.proposed_at,
    toolId: r.tool_id ?? undefined,
  }));
}

export async function expireStaleProposals(olderThanDays = 30, dryRun = false): Promise<number> {
  if (dryRun) {
    const result = await pool.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM tool_gap_proposals
       WHERE status = 'pending' AND proposed_at < NOW() - INTERVAL '1 day' * $1`,
      [olderThanDays],
    );
    return Number(result.rows[0]?.count ?? 0);
  }

  const result = await pool.query<{ count: string }>(
    `WITH updated AS (
       UPDATE tool_gap_proposals
       SET status = 'expired'
       WHERE status = 'pending' AND proposed_at < NOW() - INTERVAL '1 day' * $1
       RETURNING id
     ) SELECT COUNT(*) AS count FROM updated`,
    [olderThanDays],
  );
  return Number(result.rows[0]?.count ?? 0);
}
