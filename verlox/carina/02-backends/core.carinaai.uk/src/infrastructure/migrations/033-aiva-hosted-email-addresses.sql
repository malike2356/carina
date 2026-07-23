-- Hosted inbound email aliases for Aiva workers (Mailgun catch-all mapping).
-- One address per worker; no per-Aiva Mailgun mailbox.

CREATE TABLE IF NOT EXISTS aiva_hosted_email_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  worker_id UUID NOT NULL,
  address TEXT NOT NULL,
  local_part TEXT NOT NULL,
  domain TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'mailgun',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT aiva_hosted_email_addresses_address_unique UNIQUE (address),
  CONSTRAINT aiva_hosted_email_addresses_local_part_unique UNIQUE (local_part),
  CONSTRAINT aiva_hosted_email_addresses_worker_unique UNIQUE (worker_id)
);

CREATE INDEX IF NOT EXISTS aiva_hosted_email_addresses_workspace_idx
  ON aiva_hosted_email_addresses (workspace_id);

CREATE INDEX IF NOT EXISTS aiva_hosted_email_addresses_status_idx
  ON aiva_hosted_email_addresses (status);
