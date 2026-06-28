import type pg from 'pg';
import { runAiPlatformMigrations } from '../hosted/ai-platform-migrate.js';

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

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  owner_user_id UUID NOT NULL REFERENCES hosted_users(id),
  plan TEXT NOT NULL DEFAULT 'free',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS org_memberships (
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES hosted_users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner','admin','operator','auditor','viewer')),
  invited_by UUID REFERENCES hosted_users(id),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (org_id, user_id)
);

CREATE TABLE IF NOT EXISTS org_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','operator','auditor','viewer')),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_memberships_user ON org_memberships (user_id);
CREATE INDEX IF NOT EXISTS idx_org_invites_email ON org_invites (email);

CREATE TABLE IF NOT EXISTS subscriptions (
  tenant_id UUID PRIMARY KEY,
  plan TEXT NOT NULL CHECK (plan IN ('free', 'scout_monitor', 'scout_pro', 'scout_standard', 'enterprise', 'carina_ops_starter', 'carina_ops_team')),
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
  `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id)`,
  `ALTER TABLE usage_records ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id)`,
  `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id)`,
  `ALTER TABLE tenant_provider_keys ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id)`,
  `ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_plan_check`,
  `ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_plan_check CHECK (plan IN ('free', 'scout_monitor', 'scout_pro', 'scout_standard', 'enterprise', 'carina_ops_starter', 'carina_ops_team'))`,
  `CREATE TABLE IF NOT EXISTS product_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    actor_user_id UUID REFERENCES hosted_users(id),
    action TEXT NOT NULL,
    resource_type TEXT,
    resource_id TEXT,
    details JSONB NOT NULL DEFAULT '{}',
    ip_hash TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_product_audit_org_created
     ON product_audit_log (org_id, created_at DESC)`,
  `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS onboarding_flags JSONB NOT NULL DEFAULT '{}'`,
  `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS onboarding_dismissed BOOLEAN NOT NULL DEFAULT FALSE`,
  `CREATE TABLE IF NOT EXISTS partner_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    brand JSONB NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'archived')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS partner_id UUID REFERENCES partner_accounts(id)`,
  `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS brand JSONB NOT NULL DEFAULT '{}'`,
  `CREATE TABLE IF NOT EXISTS custom_domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hostname TEXT UNIQUE NOT NULL,
    partner_id UUID REFERENCES partner_accounts(id) ON DELETE SET NULL,
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    verified_at TIMESTAMPTZ,
    tls_status TEXT NOT NULL DEFAULT 'pending' CHECK (tls_status IN ('pending', 'active', 'failed')),
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_custom_domains_hostname ON custom_domains (hostname)`,
  `CREATE INDEX IF NOT EXISTS idx_organizations_partner ON organizations (partner_id)`,
  `ALTER TABLE partner_accounts ADD COLUMN IF NOT EXISTS commercial_tier TEXT NOT NULL DEFAULT 'starter'`,
  `ALTER TABLE partner_accounts ADD COLUMN IF NOT EXISTS owner_org_id UUID REFERENCES organizations(id)`,
  `ALTER TABLE partner_accounts ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT`,
  `ALTER TABLE partner_accounts ADD COLUMN IF NOT EXISTS max_client_orgs INTEGER NOT NULL DEFAULT 10`,
  `ALTER TABLE partner_accounts DROP CONSTRAINT IF EXISTS partner_accounts_commercial_tier_check`,
  `ALTER TABLE partner_accounts ADD CONSTRAINT partner_accounts_commercial_tier_check CHECK (commercial_tier IN ('starter', 'agency', 'enterprise'))`,
  `ALTER TABLE custom_domains ADD COLUMN IF NOT EXISTS verification_token TEXT`,
  `ALTER TABLE custom_domains ADD COLUMN IF NOT EXISTS is_canonical BOOLEAN NOT NULL DEFAULT FALSE`,
  `ALTER TABLE partner_accounts ADD COLUMN IF NOT EXISTS pack_catalog JSONB NOT NULL DEFAULT '[]'`,
  // Platform event metering - tollbooth infrastructure (TB-001)
  // Valid event_type values: message, tool_call, skill_invocation, memory_read,
  // memory_write, scout_audit, webhook_delivery, channel_connect
  `CREATE TABLE IF NOT EXISTS platform_events (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id         UUID        REFERENCES organizations(id) ON DELETE SET NULL,
    partner_id     UUID        REFERENCES partner_accounts(id) ON DELETE SET NULL,
    event_type     TEXT        NOT NULL,
    model          TEXT,
    provider       TEXT,
    tokens_in      INTEGER     NOT NULL DEFAULT 0,
    tokens_out     INTEGER     NOT NULL DEFAULT 0,
    tool_calls     INTEGER     NOT NULL DEFAULT 0,
    skill_calls    INTEGER     NOT NULL DEFAULT 0,
    memory_ops     INTEGER     NOT NULL DEFAULT 0,
    latency_ms     INTEGER,
    scout_verified BOOLEAN     NOT NULL DEFAULT false,
    fee_pence      INTEGER     NOT NULL DEFAULT 0,
    metadata       JSONB,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_platform_events_org
     ON platform_events (org_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_platform_events_partner
     ON platform_events (partner_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_platform_events_type
     ON platform_events (event_type, created_at DESC)`,

  // TB-002: partner API keys
  // Valid scopes: 'session' | 'memory' | 'skills' | 'analytics' | 'admin'
  `CREATE TABLE IF NOT EXISTS partner_api_keys (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id          UUID        NOT NULL REFERENCES partner_accounts(id) ON DELETE CASCADE,
    label               TEXT        NOT NULL,
    key_prefix          TEXT        NOT NULL,
    key_hash            TEXT        NOT NULL UNIQUE,
    scopes              TEXT[]      NOT NULL DEFAULT '{}',
    rate_limit_rpm      INTEGER     NOT NULL DEFAULT 60,
    monthly_cap_events  INTEGER     NOT NULL DEFAULT 100000,
    revenue_share_bps   INTEGER     NOT NULL DEFAULT 50,
    status              TEXT        NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'revoked')),
    last_used_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at          TIMESTAMPTZ
  )`,
  `CREATE INDEX IF NOT EXISTS idx_partner_api_keys_partner
     ON partner_api_keys (partner_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_partner_api_keys_prefix
     ON partner_api_keys (key_prefix)`,

  // TB-004: Stripe metered billing columns on partner_accounts
  `ALTER TABLE partner_accounts ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT`,
  `ALTER TABLE partner_accounts ADD COLUMN IF NOT EXISTS stripe_metered_item_id TEXT`,

  // TB-006: Author earnings ledger (Stripe Connect payout automation is future work)
  `CREATE TABLE IF NOT EXISTS author_earnings (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    author_email  TEXT        NOT NULL,
    pack_name     TEXT        NOT NULL,
    billing_month TEXT        NOT NULL,
    installs      INTEGER     NOT NULL DEFAULT 0,
    gross_pence   INTEGER     NOT NULL DEFAULT 0,
    author_pence  INTEGER     NOT NULL DEFAULT 0,
    carina_pence  INTEGER     NOT NULL DEFAULT 0,
    payout_status TEXT        NOT NULL DEFAULT 'pending'
                  CHECK (payout_status IN ('pending', 'paid', 'held')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_author_earnings_month
     ON author_earnings (author_email, pack_name, billing_month)`,

  // TB-007: Platform health checks and SLA credits
  `CREATE TABLE IF NOT EXISTS platform_health_checks (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    checked_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    endpoint    TEXT        NOT NULL,
    status_code INTEGER,
    latency_ms  INTEGER,
    healthy     BOOLEAN     NOT NULL,
    error       TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_health_checks_time
     ON platform_health_checks (checked_at DESC)`,
  `CREATE TABLE IF NOT EXISTS sla_credits (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id       UUID        REFERENCES partner_accounts(id),
    billing_month    TEXT        NOT NULL,
    downtime_minutes INTEGER     NOT NULL,
    credit_pence     INTEGER     NOT NULL,
    stripe_credit_id TEXT,
    applied_at       TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
];

export async function runHostedMigrations(client: pg.PoolClient): Promise<void> {
  await client.query(HOSTED_SCHEMA);
  for (const patch of HOSTED_ADMIN_PATCHES) {
    try {
      await client.query(patch);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[hosted-migrations] patch skipped: ${msg.slice(0, 200)}`);
    }
  }
  await runAiPlatformMigrations(client);
}
