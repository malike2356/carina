import type pg from 'pg';
import { runFindingsSchemaMigration } from './migrations/add-findings-schema.js';
import { runFreeScanSchemaMigration } from './migrations/add-free-scan-schema.js';
import { runComplianceVisibilityMigration } from './migrations/add-compliance-visibility.js';
import { runPendingApprovalsMigration } from './migrations/add-pending-approvals.js';
import { runFindActSchemaMigration } from './migrations/add-find-act-schema.js';

export async function runMigrations(client: pg.PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS security_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      severity TEXT NOT NULL CHECK (severity IN ('info','warning','critical','breach')),
      source TEXT NOT NULL,
      event_type TEXT NOT NULL,
      description TEXT NOT NULL,
      metadata JSONB DEFAULT '{}',
      ip_address TEXT,
      session_id TEXT,
      instance_id TEXT,
      mitigated BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS carina_instances (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      api_key TEXT NOT NULL,
      status TEXT DEFAULT 'active' CHECK (status IN ('active','suspended','offline')),
      suspension_reason TEXT,
      last_heartbeat TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS alert_channels (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      channel_type TEXT NOT NULL CHECK (channel_type IN ('telegram', 'email', 'slack')),
      severity_threshold TEXT NOT NULL DEFAULT 'warning'
        CHECK (severity_threshold IN ('info', 'warning', 'critical', 'breach')),
      enabled BOOLEAN NOT NULL DEFAULT true,
      config JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await client.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'alert_channels' AND column_name = 'type'
      ) THEN
        ALTER TABLE alert_channels ADD COLUMN IF NOT EXISTS channel_type TEXT;
        ALTER TABLE alert_channels ADD COLUMN IF NOT EXISTS config JSONB NOT NULL DEFAULT '{}'::jsonb;

        UPDATE alert_channels
          SET channel_type = type,
              config = CASE
                WHEN type = 'telegram' THEN jsonb_build_object('chat_id', identifier)
                WHEN type = 'email' THEN jsonb_build_object('to_address', identifier)
                WHEN type = 'slack' THEN jsonb_build_object('webhook_url', identifier)
                ELSE config
              END
          WHERE channel_type IS NULL;

        ALTER TABLE alert_channels DROP COLUMN IF EXISTS type;
        ALTER TABLE alert_channels DROP COLUMN IF EXISTS identifier;
      END IF;
    END $$
  `);

  await client.query(`
    ALTER TABLE alert_channels
      DROP CONSTRAINT IF EXISTS alert_channels_severity_threshold_check
  `);
  await client.query(`
    ALTER TABLE alert_channels
      ADD CONSTRAINT alert_channels_severity_threshold_check
      CHECK (severity_threshold IN ('info', 'warning', 'critical', 'breach'))
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_security_events_created_at
      ON security_events (created_at DESC)
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_security_events_severity
      ON security_events (severity)
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_security_events_instance_id
      ON security_events (instance_id)
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_security_events_event_type
      ON security_events (event_type)
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_security_events_type_time
      ON security_events (event_type, created_at)
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_carina_instances_status
      ON carina_instances (status)
  `);

  await client.query(`
    ALTER TABLE carina_instances
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS anomaly_baselines (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      instance_id TEXT NOT NULL,
      metric_name TEXT NOT NULL,
      mean_value FLOAT NOT NULL,
      std_dev FLOAT NOT NULL,
      sample_count INTEGER NOT NULL,
      computed_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(instance_id, metric_name)
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS anomaly_scores (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      instance_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      metric_name TEXT NOT NULL,
      current_value FLOAT NOT NULL,
      baseline_mean FLOAT NOT NULL,
      z_score FLOAT NOT NULL,
      is_anomaly BOOLEAN NOT NULL,
      detected_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_anomaly_scores_instance_time
      ON anomaly_scores (instance_id, detected_at DESC)
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS honeypots (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      type TEXT NOT NULL CHECK (type IN ('api_key', 'file', 'endpoint')),
      name TEXT NOT NULL,
      value TEXT NOT NULL,
      description TEXT,
      instance_id TEXT NOT NULL,
      triggered BOOLEAN NOT NULL DEFAULT FALSE,
      triggered_at TIMESTAMPTZ,
      trigger_ip TEXT,
      trigger_metadata JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_honeypots_instance
      ON honeypots (instance_id, created_at DESC)
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_honeypots_value
      ON honeypots (value)
  `);

  // Widen the credential-type set to the spec's five decoy categories
  // (api_key, password, token, endpoint, database) plus the original
  // 'file' planted-credential type, and track retirement so rotated-out
  // honeypots can still be matched during their 24-hour leak-monitoring
  // window (see HoneypotManager.rotate/scanForLeak).
  await client.query(`
    ALTER TABLE honeypots
      ADD COLUMN IF NOT EXISTS retired_at TIMESTAMPTZ
  `);

  await client.query(`
    ALTER TABLE honeypots
      DROP CONSTRAINT IF EXISTS honeypots_type_check
  `);

  await client.query(`
    ALTER TABLE honeypots
      ADD CONSTRAINT honeypots_type_check
      CHECK (type IN ('api_key', 'password', 'token', 'endpoint', 'database', 'file'))
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_honeypots_active
      ON honeypots (instance_id, type)
      WHERE retired_at IS NULL
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS blocked_sessions (
      session_id TEXT PRIMARY KEY,
      reason     TEXT NOT NULL,
      blocked_by TEXT NOT NULL DEFAULT 'operator',
      blocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_blocked_sessions_blocked_at
      ON blocked_sessions (blocked_at DESC)
  `);

  await client.query(`
    ALTER TABLE security_events
      ADD COLUMN IF NOT EXISTS acknowledged      BOOLEAN     DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS acknowledged_at  TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS acknowledged_note TEXT
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_security_events_acknowledged
      ON security_events (acknowledged)
      WHERE acknowledged = FALSE
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS accounts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      carina_tenant_id UUID UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await client.query(`
    ALTER TABLE accounts
      ADD COLUMN IF NOT EXISTS carina_tenant_id UUID UNIQUE
  `);

  await client.query(`
    ALTER TABLE accounts
      ADD COLUMN IF NOT EXISTS trust_settings JSONB NOT NULL DEFAULT '{"tier":"standard","attestation_interval_days":7,"verification_interval_days":7}'::jsonb
  `);

  await client.query(`
    ALTER TABLE accounts
      ADD COLUMN IF NOT EXISTS subscription_plan TEXT NOT NULL DEFAULT 'scout_pro'
  `);

  await client.query(`
    ALTER TABLE accounts
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE
  `);

  await client.query(`
    UPDATE accounts
    SET subscription_plan = 'scout_pro'
    WHERE subscription_plan IS NULL OR subscription_plan = ''
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS account_api_keys (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      key_hash TEXT NOT NULL UNIQUE,
      key_prefix TEXT NOT NULL,
      label TEXT NOT NULL DEFAULT 'Default key',
      last_used_at TIMESTAMPTZ,
      revoked_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_account_api_keys_account
      ON account_api_keys (account_id)
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS account_setup_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_account_setup_tokens_account
      ON account_setup_tokens (account_id, created_at DESC)
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS scout_platform_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await client.query(`
    ALTER TABLE carina_instances
      ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id) ON DELETE SET NULL
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_carina_instances_account
      ON carina_instances (account_id)
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS marker_rotations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      marker_value TEXT NOT NULL,
      rotated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      retired_at TIMESTAMPTZ
    )
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_marker_rotations_active
      ON marker_rotations (retired_at)
      WHERE retired_at IS NULL
  `);

  await client.query(`
    ALTER TABLE security_events
      ADD COLUMN IF NOT EXISTS acknowledged BOOLEAN NOT NULL DEFAULT FALSE
  `);

  await client.query(`
    ALTER TABLE security_events
      ADD COLUMN IF NOT EXISTS acknowledged_by TEXT
  `);

  await client.query(`
    ALTER TABLE security_events
      ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS throttle_state (
      tenant_id TEXT NOT NULL,
      severity TEXT NOT NULL,
      event_type TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      window_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (tenant_id, severity, event_type)
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS killswitch_state (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      state TEXT NOT NULL CHECK (state IN ('ARMED', 'TRIGGERED')),
      triggered_by TEXT,
      reason TEXT,
      triggered_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Drop the old minimal (killswitch-only) audit_log table and recreate it
  // with the full spec schema covering all five event categories:
  // tool_execution, model_request, security, admin, auth.
  // The old killswitch-specific columns (triggered_by, disarmed_by, reason,
  // agents_stopped, stop_duration_ms, affected_tenants, alerts_sent,
  // previously_triggered_by) now live inside the detail JSONB column.
  // This table is IMMUTABLE; enforced by the RLS policy below.
  await client.query(`DROP TABLE IF EXISTS audit_log CASCADE`);

  await client.query(`
    CREATE TABLE audit_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id TEXT NOT NULL,
      event_type TEXT NOT NULL
        CHECK (event_type IN ('tool_execution','model_request','security','admin','auth')),
      action TEXT NOT NULL,
      detail JSONB NOT NULL DEFAULT '{}',
      severity TEXT NOT NULL
        CHECK (severity IN ('info','warning','critical','breach')),
      session_id UUID,
      ip_address INET,
      admin_email TEXT,
      timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Append-only Row-Level Security: no UPDATE or DELETE permitted.
  // Application-level code must never UPDATE or DELETE audit_log rows.
  await client.query(`
    ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY
  `);
  await client.query(`
    CREATE POLICY audit_append_only ON audit_log
      FOR INSERT WITH CHECK (true)
  `);

  // No UPDATE or DELETE policies exist; those operations will fail
  // at the database level, guaranteeing immutability.

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_audit_log_tenant
      ON audit_log (tenant_id)
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_audit_log_event_type
      ON audit_log (event_type)
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_audit_log_severity
      ON audit_log (severity)
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp
      ON audit_log (timestamp DESC)
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_audit_log_type_time
      ON audit_log (event_type, timestamp)
  `);

  // GDPR compliance request tracking table.
  // Records SARs and erasure requests with due dates for the
  // compliance dashboard. Does NOT store PII beyond tenant_id
  // and email; the actual data exports and erasure confirmations
  // are returned inline to the requester.
  await client.query(`
    CREATE TABLE IF NOT EXISTS compliance_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      request_type TEXT NOT NULL CHECK (request_type IN ('sar', 'erasure')),
      tenant_id TEXT NOT NULL,
      email TEXT,
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'completed')),
      due_by TIMESTAMPTZ NOT NULL,
      requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      completed_at TIMESTAMPTZ
    )
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_compliance_requests_status
      ON compliance_requests (status, due_by)
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_compliance_requests_tenant
      ON compliance_requests (tenant_id)
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS trust_identities (
      slug TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      agent_uri TEXT NOT NULL,
      chain_id INTEGER NOT NULL,
      registry_address TEXT NOT NULL,
      agent_id TEXT,
      wallet_address TEXT,
      register_tx_hash TEXT,
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'registering', 'live', 'failed')),
      registered_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS trust_attestations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      identity_slug TEXT NOT NULL,
      namespace TEXT NOT NULL,
      tag TEXT NOT NULL,
      score INTEGER NOT NULL,
      attestation_uid TEXT,
      tx_hash TEXT NOT NULL,
      chain_id INTEGER NOT NULL,
      metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
      comment TEXT,
      status TEXT NOT NULL DEFAULT 'submitted'
        CHECK (status IN ('submitted', 'failed')),
      submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_trust_attestations_identity_submitted
      ON trust_attestations (identity_slug, submitted_at DESC)
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS trust_verifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      identity_slug TEXT NOT NULL,
      agent_id TEXT NOT NULL,
      chain_id INTEGER NOT NULL,
      wav_risk_score INTEGER NOT NULL,
      wv_risk_score INTEGER NOT NULL,
      unified_risk_score INTEGER NOT NULL,
      trust_response_score INTEGER NOT NULL,
      request_hash TEXT NOT NULL,
      request_tx_hash TEXT,
      response_tx_hash TEXT,
      response_uri TEXT,
      status TEXT NOT NULL DEFAULT 'submitted'
        CHECK (status IN ('submitted', 'failed')),
      details JSONB NOT NULL DEFAULT '{}'::jsonb,
      submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_trust_verifications_identity_submitted
      ON trust_verifications (identity_slug, submitted_at DESC)
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS forensic_snapshots (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      instance_id TEXT NOT NULL,
      reason TEXT NOT NULL,
      artifacts JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_forensic_snapshots_instance_created
      ON forensic_snapshots (instance_id, created_at DESC)
  `);

  await client.query(`
    ALTER TABLE security_events
      ADD COLUMN IF NOT EXISTS parent_session_id TEXT
  `);

  await client.query(`
    ALTER TABLE security_events
      ADD COLUMN IF NOT EXISTS root_session_id TEXT
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_security_events_parent_session
      ON security_events (parent_session_id)
      WHERE parent_session_id IS NOT NULL
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_security_events_root_session
      ON security_events (root_session_id)
      WHERE root_session_id IS NOT NULL
  `);

  await runPendingApprovalsMigration(client);
  await runFindingsSchemaMigration(client);
  await runFreeScanSchemaMigration(client);
  await runComplianceVisibilityMigration(client);
  await runFindActSchemaMigration(client);

  await client.query(`
    CREATE TABLE IF NOT EXISTS critical_event_attestations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      event_id UUID NOT NULL UNIQUE REFERENCES security_events(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL,
      severity TEXT NOT NULL,
      instance_id TEXT,
      content_hash TEXT NOT NULL,
      chain_hash TEXT NOT NULL,
      signature TEXT NOT NULL,
      on_chain_status TEXT NOT NULL DEFAULT 'off_chain'
        CHECK (on_chain_status IN ('off_chain', 'queued', 'submitted')),
      attested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_critical_event_attestations_attested
      ON critical_event_attestations (attested_at DESC)
  `);

  console.log('[scout:migrations] Schema ready');
}
