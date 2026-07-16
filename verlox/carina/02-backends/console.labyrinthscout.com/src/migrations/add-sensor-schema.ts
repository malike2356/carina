import type pg from 'pg';

/** Protect sensor keys, events, plane verdicts, fail-closed config, durable control commands. */
export async function runSensorSchemaMigration(client: pg.PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS sensor_keys (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      account_id  UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      key_hash    TEXT NOT NULL UNIQUE,
      label       TEXT NOT NULL,
      hostname    TEXT,
      platform    TEXT NOT NULL DEFAULT 'linux',
      last_seen_at TIMESTAMPTZ,
      active      BOOLEAN NOT NULL DEFAULT true,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_sensor_keys_account
      ON sensor_keys (account_id, active)
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS sensor_events (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      account_id    UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      sensor_key_id UUID,
      event_type    TEXT NOT NULL,
      payload       JSONB NOT NULL,
      received_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_sensor_account_time
      ON sensor_events (account_id, received_at DESC)
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS plane_verdicts (
      id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      account_id          UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      app_event_id        UUID,
      sensor_event_ids    UUID[],
      verdict             TEXT NOT NULL CHECK (verdict IN ('verified', 'unverified', 'disagreement')),
      disagreement_reason TEXT,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_verdicts_account
      ON plane_verdicts (account_id, created_at DESC)
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS fail_closed_config (
      id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      account_id               UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      tool_class               TEXT NOT NULL,
      mode                     TEXT NOT NULL CHECK (mode IN ('fail_open', 'fail_closed', 'dry_run')),
      scout_unreachable_action TEXT NOT NULL DEFAULT 'block'
        CHECK (scout_unreachable_action IN ('block', 'allow', 'alert_only')),
      updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (account_id, tool_class)
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS protect_control_commands (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      account_id    UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      sensor_key_id UUID REFERENCES sensor_keys(id) ON DELETE SET NULL,
      command_type  TEXT NOT NULL,
      payload       JSONB NOT NULL DEFAULT '{}',
      status        TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'acked', 'applied', 'failed', 'cancelled')),
      soft_wall_id  TEXT,
      approval_id   UUID,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at    TIMESTAMPTZ
    )
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_protect_commands_pending
      ON protect_control_commands (account_id, status, created_at DESC)
  `);

  await client.query(`
    ALTER TABLE sensor_keys
      ADD COLUMN IF NOT EXISTS hostname TEXT,
      ADD COLUMN IF NOT EXISTS platform TEXT NOT NULL DEFAULT 'linux',
      ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ
  `);
}
