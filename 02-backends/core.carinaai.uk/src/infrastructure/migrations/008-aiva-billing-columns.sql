-- Reference copy of billing columns added in AIVA_EMAIL_MIGRATION, AIVA_USAGE_MIGRATION,
-- AIVA_BILLING_MIGRATION, and AIVA_ADMIN_MIGRATION in src/memory/migrations.ts.
-- These columns are applied automatically at startup via runMigrations().
-- This file is documentation only; do not run it directly unless bootstrapping
-- a fresh database that skipped the inline migration (e.g. a local dev reset).

-- From AIVA_EMAIL_MIGRATION
ALTER TABLE aiva_subscriptions ADD COLUMN IF NOT EXISTS grace_period_ends_at TIMESTAMPTZ;
CREATE TABLE IF NOT EXISTS aiva_workspace_contacts (
  workspace_id             TEXT PRIMARY KEY,
  owner_email              TEXT NOT NULL,
  owner_name               TEXT NOT NULL DEFAULT '',
  email_unsubscribe_token  UUID NOT NULL DEFAULT gen_random_uuid(),
  email_marketing_opt_out  BOOLEAN NOT NULL DEFAULT false,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE aiva_workspace_contacts ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE aiva_workspace_contacts ADD COLUMN IF NOT EXISTS admin_notes TEXT NOT NULL DEFAULT '';

-- From AIVA_USAGE_MIGRATION
ALTER TABLE aiva_subscriptions ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE aiva_subscriptions ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
ALTER TABLE aiva_subscriptions ADD COLUMN IF NOT EXISTS stripe_price_id TEXT;
ALTER TABLE aiva_subscriptions ADD COLUMN IF NOT EXISTS pending_downgrade_conflict BOOLEAN NOT NULL DEFAULT false;

-- From AIVA_BILLING_MIGRATION
CREATE TABLE IF NOT EXISTS aiva_invoices (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      TEXT NOT NULL,
  stripe_invoice_id TEXT NOT NULL UNIQUE,
  amount_paid       INTEGER NOT NULL DEFAULT 0,
  currency          TEXT NOT NULL DEFAULT 'gbp',
  status            TEXT NOT NULL DEFAULT 'open',
  invoice_pdf_url   TEXT,
  period_start      TIMESTAMPTZ,
  period_end        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_aiva_invoices_workspace ON aiva_invoices(workspace_id);
ALTER TABLE aiva_subscriptions ADD COLUMN IF NOT EXISTS current_period_start TIMESTAMPTZ;
ALTER TABLE aiva_subscriptions ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ;
ALTER TABLE aiva_subscriptions ADD COLUMN IF NOT EXISTS billing_interval TEXT;
ALTER TABLE aiva_subscriptions ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE aiva_subscriptions ADD COLUMN IF NOT EXISTS payment_failed_at TIMESTAMPTZ;

-- From AIVA_ADMIN_MIGRATION
ALTER TABLE aiva_subscriptions ADD COLUMN IF NOT EXISTS monthly_amount_pence INTEGER NOT NULL DEFAULT 0;
ALTER TABLE aiva_invoices ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT;
