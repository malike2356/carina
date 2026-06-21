import type pg from 'pg';

export async function runPendingApprovalsMigration(client: pg.PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS pending_approvals (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      instance_id TEXT NOT NULL,
      session_id  TEXT NOT NULL,
      tool_name   TEXT,
      action_type TEXT NOT NULL DEFAULT 'unknown',
      content     TEXT,
      params      JSONB,
      risk_score  INTEGER NOT NULL DEFAULT 0,
      policy_pack TEXT,
      regulatory_category TEXT,
      regulation  TEXT,
      requested_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at    TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '15 minutes',
      status        TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
      decided_by    TEXT,
      decided_at    TIMESTAMPTZ,
      rejection_reason TEXT
    )
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_pending_approvals_status
      ON pending_approvals(status) WHERE status = 'pending'
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_pending_approvals_instance
      ON pending_approvals(instance_id, requested_at DESC)
  `);
}
