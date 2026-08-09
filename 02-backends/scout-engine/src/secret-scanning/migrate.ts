// Repository secret scanning for live Carina Scout (account-scoped).
// Lifecycle truth lives in repo_secret_* tables. Optional mirror rows in findings
// (finding_type = exposed_secret) feed Scout Score without storing secrets.
import type pg from 'pg';

export async function ensureRepositorySecretSchema(client: pg.PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS repo_connectors (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      connector_key TEXT NOT NULL,
      repository_alias TEXT NOT NULL,
      product TEXT,
      status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'revoked', 'offboarded')),
      path_display_policy TEXT NOT NULL DEFAULT 'relative'
        CHECK (path_display_policy IN ('relative', 'basename')),
      commit_display_policy TEXT NOT NULL DEFAULT 'allow'
        CHECK (commit_display_policy IN ('allow', 'omit')),
      retention_days INTEGER NOT NULL DEFAULT 365 CHECK (retention_days >= 30 AND retention_days <= 2555),
      revoked_at TIMESTAMPTZ,
      last_ingest_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (account_id, connector_key)
    )
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_repo_connectors_account
      ON repo_connectors(account_id, status)
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS repo_secret_scan_runs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      connector_id UUID NOT NULL REFERENCES repo_connectors(id) ON DELETE CASCADE,
      client_scan_id TEXT NOT NULL,
      mode TEXT NOT NULL CHECK (mode IN ('current', 'staged', 'history', 'environment')),
      scanner_name TEXT NOT NULL,
      scanner_version TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('completed', 'failed', 'partial')),
      started_at TIMESTAMPTZ NOT NULL,
      completed_at TIMESTAMPTZ NOT NULL,
      observed_at TIMESTAMPTZ NOT NULL,
      count_critical INTEGER NOT NULL DEFAULT 0,
      count_high INTEGER NOT NULL DEFAULT 0,
      count_medium INTEGER NOT NULL DEFAULT 0,
      count_low INTEGER NOT NULL DEFAULT 0,
      count_info INTEGER NOT NULL DEFAULT 0,
      findings_accepted INTEGER NOT NULL DEFAULT 0,
      findings_deduped INTEGER NOT NULL DEFAULT 0,
      hook_installed BOOLEAN,
      hook_last_check_at TIMESTAMPTZ,
      environment_policy_ok BOOLEAN,
      environment_policy_detail TEXT,
      idempotency_key TEXT NOT NULL,
      signature_algorithm TEXT,
      signature_nonce TEXT,
      correlation_id TEXT NOT NULL,
      warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
      retain_until TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (account_id, idempotency_key),
      UNIQUE (account_id, connector_id, client_scan_id)
    )
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_repo_secret_scan_runs_connector
      ON repo_secret_scan_runs(account_id, connector_id, observed_at DESC)
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS repo_secret_findings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      connector_id UUID NOT NULL REFERENCES repo_connectors(id) ON DELETE CASCADE,
      scout_finding_id UUID REFERENCES findings(id) ON DELETE SET NULL,
      fingerprint TEXT NOT NULL,
      rule_id TEXT NOT NULL,
      severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low', 'info')),
      relative_path TEXT,
      line_number INTEGER,
      commit_id TEXT,
      remediation_status TEXT NOT NULL DEFAULT 'open'
        CHECK (remediation_status IN (
          'open', 'acknowledged', 'rotation-required', 'rotation-in-progress',
          'verification-pending', 'resolved', 'accepted-risk', 'false-positive'
        )),
      first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_scan_run_id UUID REFERENCES repo_secret_scan_runs(id) ON DELETE SET NULL,
      seen_count INTEGER NOT NULL DEFAULT 1,
      remediation_owner TEXT,
      due_at TIMESTAMPTZ,
      accepted_risk_expires_at TIMESTAMPTZ,
      resolution_evidence TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (account_id, connector_id, fingerprint)
    )
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_repo_secret_findings_open
      ON repo_secret_findings(account_id, remediation_status, severity)
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS repo_secret_remediation_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      finding_id UUID NOT NULL REFERENCES repo_secret_findings(id) ON DELETE CASCADE,
      from_status TEXT,
      to_status TEXT NOT NULL,
      actor TEXT NOT NULL,
      reason TEXT,
      evidence_note TEXT,
      correlation_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS repo_secret_ingestion_receipts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      connector_id UUID REFERENCES repo_connectors(id) ON DELETE SET NULL,
      idempotency_key TEXT,
      client_scan_id TEXT,
      outcome TEXT NOT NULL,
      http_status INTEGER NOT NULL,
      error_code TEXT,
      correlation_id TEXT NOT NULL,
      findings_accepted INTEGER NOT NULL DEFAULT 0,
      findings_deduped INTEGER NOT NULL DEFAULT 0,
      request_byte_length INTEGER,
      schema_version TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS repo_secret_workspace_settings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      retention_days INTEGER NOT NULL DEFAULT 365 CHECK (retention_days >= 30 AND retention_days <= 2555),
      overdue_days INTEGER NOT NULL DEFAULT 14 CHECK (overdue_days >= 1 AND overdue_days <= 365),
      severity_routing JSONB NOT NULL DEFAULT '{"critical":"immediate","high":"immediate","medium":"digest","low":"digest","info":"digest"}'::jsonb,
      path_display_policy TEXT NOT NULL DEFAULT 'relative'
        CHECK (path_display_policy IN ('relative', 'basename')),
      commit_display_policy TEXT NOT NULL DEFAULT 'allow'
        CHECK (commit_display_policy IN ('allow', 'omit')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (account_id)
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS repo_secret_scan_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      connector_id UUID NOT NULL REFERENCES repo_connectors(id) ON DELETE CASCADE,
      mode TEXT NOT NULL CHECK (mode IN ('current', 'staged', 'history', 'environment')),
      status TEXT NOT NULL DEFAULT 'requested'
        CHECK (status IN ('requested', 'acknowledged', 'cancelled', 'expired')),
      requested_by TEXT NOT NULL,
      note TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ
    )
  `);
}
