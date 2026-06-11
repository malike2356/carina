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

CREATE TABLE IF NOT EXISTS subscriptions (
  tenant_id UUID PRIMARY KEY,
  plan TEXT NOT NULL CHECK (plan IN ('free', 'scout_monitor', 'scout_pro', 'scout_standard', 'enterprise')),
  status TEXT NOT NULL,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT UNIQUE,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  scout_api_key TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  stripe_invoice_id TEXT NOT NULL UNIQUE,
  amount INTEGER NOT NULL,
  status TEXT NOT NULL,
  pdf_url TEXT,
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS usage_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  date DATE NOT NULL,
  tokens_used INTEGER NOT NULL,
  model TEXT NOT NULL,
  cost_estimate NUMERIC(12, 6) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stripe_events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mobile_push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  expo_push_token TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
  task_alerts BOOLEAN NOT NULL DEFAULT true,
  scout_alerts BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tenant_id, expo_push_token)
);

CREATE TABLE IF NOT EXISTS scout_alert_watermarks (
  tenant_id UUID PRIMARY KEY,
  last_event_id TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES hosted_users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
`;

const HOSTED_ADMIN_PATCHES = [
  `ALTER TABLE hosted_users ADD COLUMN IF NOT EXISTS display_name TEXT`,
  `ALTER TABLE hosted_users ADD COLUMN IF NOT EXISTS company_name TEXT`,
  `ALTER TABLE hosted_users ADD COLUMN IF NOT EXISTS provisioning_type TEXT NOT NULL DEFAULT 'saas'`,
  `ALTER TABLE hosted_users ADD COLUMN IF NOT EXISTS access_status TEXT NOT NULL DEFAULT 'active'`,
  `ALTER TABLE hosted_users ADD COLUMN IF NOT EXISTS notes TEXT`,
  `ALTER TABLE hosted_users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`,
  `ALTER TABLE hosted_users ADD COLUMN IF NOT EXISTS daily_message_limit INTEGER`,
  `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS provisioning_source TEXT NOT NULL DEFAULT 'saas'`,
  `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ`,
  `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ`,
];

export async function runHostedMigrations(client: pg.PoolClient): Promise<void> {
  await client.query(HOSTED_SCHEMA);
  for (const patch of HOSTED_ADMIN_PATCHES) {
    await client.query(patch);
  }
}
