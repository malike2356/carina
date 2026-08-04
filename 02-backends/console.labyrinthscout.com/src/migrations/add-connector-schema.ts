import type pg from 'pg';

export async function runConnectorSchemaMigration(client: pg.PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS connector_configs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      connector_id TEXT NOT NULL,
      account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      config JSONB NOT NULL DEFAULT '{}'::jsonb,
      enabled BOOLEAN NOT NULL DEFAULT FALSE,
      last_health TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (account_id, connector_id)
    )
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_connector_configs_account_enabled
      ON connector_configs (account_id, enabled)
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS connector_routes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      connector_id TEXT NOT NULL,
      account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      finding_types TEXT[],
      min_severity TEXT NOT NULL DEFAULT 'medium'
        CHECK (min_severity IN ('critical', 'high', 'medium', 'low', 'info')),
      route_alerts BOOLEAN NOT NULL DEFAULT TRUE,
      enabled BOOLEAN NOT NULL DEFAULT TRUE,
      priority INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_connector_routes_account_enabled
      ON connector_routes (account_id, enabled, priority)
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS connector_vendor_refs (
      scout_finding_id TEXT NOT NULL,
      connector_id TEXT NOT NULL,
      account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      vendor_id TEXT NOT NULL,
      vendor_url TEXT,
      pushed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (scout_finding_id, connector_id)
    )
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_connector_vendor_refs_account
      ON connector_vendor_refs (account_id, pushed_at DESC)
  `);
}
