import type { PoolClient } from 'pg';

export async function runCloudMigrations(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS cloud_orgs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      plan TEXT NOT NULL DEFAULT 'free',
      stripe_customer_id TEXT,
      stripe_subscription_id TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS cloud_byok_keys (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id UUID NOT NULL REFERENCES cloud_orgs(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      key_name TEXT NOT NULL,
      encrypted_value TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS cloud_byok_keys_org_id_idx ON cloud_byok_keys(org_id);
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS cloud_scout_pairings (
      org_id UUID PRIMARY KEY REFERENCES cloud_orgs(id) ON DELETE CASCADE,
      console_url TEXT NOT NULL,
      encrypted_api_key TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS cloud_projects (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id UUID NOT NULL REFERENCES cloud_orgs(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      workspace_type TEXT NOT NULL DEFAULT 'Workspace',
      color TEXT NOT NULL DEFAULT '#3b82f6',
      icon_url TEXT,
      last_activity_at TIMESTAMPTZ DEFAULT NOW(),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS cloud_projects_org_activity_idx
    ON cloud_projects(org_id, last_activity_at DESC);
  `);
}
