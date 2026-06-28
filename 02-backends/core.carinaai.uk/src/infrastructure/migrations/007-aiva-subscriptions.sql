-- Aiva subscription / trial state per workspace (cloud workspace UUID)

CREATE TABLE IF NOT EXISTS aiva_subscriptions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    TEXT NOT NULL UNIQUE,
  plan_tier       TEXT NOT NULL DEFAULT 'trial',
  status          TEXT NOT NULL DEFAULT 'trialing',
  trial_ends_at   TIMESTAMPTZ,
  aiva_slot_limit INTEGER NOT NULL DEFAULT 1,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_aiva_subscriptions_workspace
  ON aiva_subscriptions(workspace_id);
