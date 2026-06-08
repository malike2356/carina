import type pg from 'pg';

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
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
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
  // This table is IMMUTABLE — enforced by the RLS policy below.
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

  // No UPDATE or DELETE policies exist — those operations will fail
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
  // and email — the actual data exports and erasure confirmations
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

  console.log('[scout:migrations] Schema ready');
}
