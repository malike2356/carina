-- Billing config: Stripe price IDs editable from ops admin (no deploy restart).
CREATE TABLE IF NOT EXISTS billing_config (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL DEFAULT '',
  updated_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
