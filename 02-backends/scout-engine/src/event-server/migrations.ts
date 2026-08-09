// scout-engine/src/event-server/migrations.ts
// Idempotent schema migrations for the event ingestion server.
// Safe to run on every server start. Uses IF NOT EXISTS throughout.
// Tables: security_events, alert_rules, alert_history, kill_switch_state
import type pg from 'pg';

export async function runMigrations(client: pg.PoolClient): Promise<void> {
  // security_events; the primary event table for all Carina tool calls and security events
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

  // alert_rules; defines conditions that trigger alerts
  await client.query(`
    CREATE TABLE IF NOT EXISTS alert_rules (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      description TEXT,
      trigger JSONB NOT NULL,
      channels TEXT[] NOT NULL DEFAULT '{}',
      config JSONB DEFAULT '{}',
      enabled BOOLEAN DEFAULT TRUE,
      cooldown_minutes INTEGER DEFAULT 60,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // alert_history; log of all alert deliveries
  await client.query(`
    CREATE TABLE IF NOT EXISTS alert_history (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      rule_id UUID REFERENCES alert_rules(id) ON DELETE SET NULL,
      event_id UUID REFERENCES security_events(id) ON DELETE SET NULL,
      channel TEXT NOT NULL,
      delivered BOOLEAN DEFAULT FALSE,
      error TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // kill_switch_state; tracks suspension state per Carina instance
  await client.query(`
    CREATE TABLE IF NOT EXISTS kill_switch_state (
      instance_id TEXT PRIMARY KEY,
      suspended BOOLEAN DEFAULT FALSE,
      suspended_at TIMESTAMPTZ,
      suspended_by TEXT,
      reason TEXT,
      reactivated_at TIMESTAMPTZ,
      reactivated_by TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Indexes (all IF NOT EXISTS)
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_sevents_created_at
      ON security_events (created_at DESC)
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_sevents_severity
      ON security_events (severity)
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_sevents_instance_id
      ON security_events (instance_id)
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_sevents_event_type
      ON security_events (event_type)
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_alert_rules_enabled
      ON alert_rules (enabled)
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_alert_history_created_at
      ON alert_history (created_at DESC)
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_kill_switch_suspended
      ON kill_switch_state (suspended) WHERE suspended = TRUE
  `);

  // Channel kill / trusted operator links (idempotent)
  await client.query(`
    CREATE TABLE IF NOT EXISTS channel_operator_links (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id TEXT NOT NULL,
      dashboard_user_id TEXT NOT NULL,
      channel TEXT NOT NULL CHECK (channel IN ('telegram', 'whatsapp', 'slack', 'dashboard')),
      channel_user_ref TEXT NOT NULL,
      chat_ref TEXT,
      role TEXT NOT NULL DEFAULT 'operator' CHECK (role IN ('owner', 'operator')),
      enabled BOOLEAN NOT NULL DEFAULT TRUE,
      linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      revoked_at TIMESTAMPTZ,
      confirmed_at TIMESTAMPTZ,
      control_scope TEXT NOT NULL DEFAULT 'org',
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb
    )
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_channel_operator_links_org
      ON channel_operator_links (organization_id, enabled)
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_channel_operator_links_channel
      ON channel_operator_links (channel, channel_user_ref)
  `);
  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_channel_operator_links_active
      ON channel_operator_links (organization_id, channel, channel_user_ref)
      WHERE revoked_at IS NULL
  `);

  await client.query(`
    ALTER TABLE carina_instances
      ADD COLUMN IF NOT EXISTS organization_id TEXT
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_carina_instances_organization
      ON carina_instances (organization_id, status)
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS channel_control_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id TEXT NOT NULL,
      audit_code TEXT NOT NULL,
      action TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT,
      channel TEXT,
      channel_user_ref TEXT,
      dashboard_user_id TEXT,
      reason TEXT,
      confirmed BOOLEAN NOT NULL DEFAULT FALSE,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_channel_control_events_audit_code
      ON channel_control_events (organization_id, audit_code)
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_channel_control_events_org_time
      ON channel_control_events (organization_id, created_at DESC)
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_channel_control_events_action
      ON channel_control_events (action, created_at DESC)
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS channel_link_codes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id TEXT NOT NULL,
      dashboard_user_id TEXT NOT NULL,
      channel TEXT NOT NULL CHECK (channel IN ('telegram', 'whatsapp', 'slack')),
      code_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'operator' CHECK (role IN ('owner', 'operator')),
      expires_at TIMESTAMPTZ NOT NULL,
      consumed_at TIMESTAMPTZ,
      consumed_by TEXT,
      consumed_chat_ref TEXT,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_channel_link_codes_hash
      ON channel_link_codes (code_hash)
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_channel_link_codes_org_channel
      ON channel_link_codes (organization_id, channel, created_at DESC)
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS organization_control_settings (
      organization_id TEXT PRIMARY KEY,
      panic_mode BOOLEAN NOT NULL DEFAULT FALSE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Repository secret scanning (account-scoped for live Carina Scout / OPS).
  // Requires accounts (+ findings for optional mirror). Skip cleanly if accounts missing.
  const accounts = await client.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'accounts'
     ) AS exists`,
  );
  if (accounts.rows[0]?.exists) {
    const { ensureRepositorySecretSchema } = await import('../secret-scanning/migrate.js');
    await ensureRepositorySecretSchema(client);
    console.log('[scout:migrations] Schema ready (events, alerts, kill switch, channel control, repo secrets)');
  } else {
    console.log('[scout:migrations] Schema ready (events, alerts, kill switch, channel control)');
  }
}
