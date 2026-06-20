import type pg from 'pg';

export async function runFindingsSchemaMigration(client: pg.PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS targets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      target TEXT NOT NULL,
      target_type TEXT NOT NULL CHECK (target_type IN ('domain', 'ip', 'cidr')),
      label TEXT,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (account_id, target)
    )
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_targets_account_active
      ON targets (account_id, is_active)
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS scan_configs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      target_id UUID NOT NULL REFERENCES targets(id) ON DELETE CASCADE,
      tool TEXT NOT NULL,
      schedule TEXT NOT NULL,
      is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      last_run_at TIMESTAMPTZ,
      next_run_at TIMESTAMPTZ,
      config JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (target_id, tool)
    )
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_scan_configs_next_run
      ON scan_configs (next_run_at)
      WHERE is_enabled = TRUE
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS scan_runs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      target_id UUID NOT NULL REFERENCES targets(id) ON DELETE CASCADE,
      account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      tool TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'queued'
        CHECK (status IN ('queued', 'running', 'completed', 'failed')),
      started_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      findings_count INTEGER NOT NULL DEFAULT 0,
      error_message TEXT,
      raw_output_path TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_scan_runs_target_created
      ON scan_runs (target_id, created_at DESC)
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_scan_runs_account_created
      ON scan_runs (account_id, created_at DESC)
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS findings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      scan_run_id UUID REFERENCES scan_runs(id) ON DELETE SET NULL,
      target_id UUID NOT NULL REFERENCES targets(id) ON DELETE CASCADE,
      account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      tool TEXT NOT NULL,
      finding_type TEXT NOT NULL,
      severity TEXT NOT NULL
        CHECK (severity IN ('critical', 'high', 'medium', 'low', 'info')),
      cvss_score DECIMAL(3, 1),
      title TEXT NOT NULL,
      description TEXT,
      remediation TEXT,
      raw_data JSONB NOT NULL DEFAULT '{}'::jsonb,
      status TEXT NOT NULL DEFAULT 'open'
        CHECK (status IN ('open', 'investigating', 'confirmed', 'false_positive', 'resolved')),
      is_new BOOLEAN NOT NULL DEFAULT TRUE,
      first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_findings_account_status
      ON findings (account_id, status, severity)
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_findings_target_created
      ON findings (target_id, created_at DESC)
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_findings_tool
      ON findings (tool, created_at DESC)
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS alerts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      finding_id UUID NOT NULL REFERENCES findings(id) ON DELETE CASCADE,
      alert_type TEXT NOT NULL
        CHECK (alert_type IN ('new_critical', 'severity_change', 'new_target', 'scan_complete')),
      is_read BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_alerts_account_unread
      ON alerts (account_id, is_read, created_at DESC)
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS scout_scores (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
      open_critical INTEGER NOT NULL DEFAULT 0,
      open_high INTEGER NOT NULL DEFAULT 0,
      open_medium INTEGER NOT NULL DEFAULT 0,
      open_low INTEGER NOT NULL DEFAULT 0,
      calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_scout_scores_account_calculated
      ON scout_scores (account_id, calculated_at DESC)
  `);
}
