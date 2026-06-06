import type pg from 'pg';

const HOSTED_SCHEMA = `
CREATE TABLE IF NOT EXISTS hosted_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  api_key TEXT UNIQUE NOT NULL,
  schema_name TEXT UNIQUE NOT NULL,
  tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'pro')),
  messages_today INTEGER NOT NULL DEFAULT 0,
  messages_day DATE NOT NULL DEFAULT CURRENT_DATE,
  stripe_customer_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
`;

export async function runHostedMigrations(client: pg.PoolClient): Promise<void> {
  await client.query(HOSTED_SCHEMA);
}
