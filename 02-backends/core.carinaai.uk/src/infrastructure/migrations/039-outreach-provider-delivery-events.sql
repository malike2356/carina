-- 039: Provider delivery events + indexed delivery provider ids + reconciliation gaps.

ALTER TABLE outreach_deliveries
  ADD COLUMN IF NOT EXISTS provider TEXT,
  ADD COLUMN IF NOT EXISTS provider_message_id TEXT,
  ADD COLUMN IF NOT EXISTS provider_thread_id TEXT,
  ADD COLUMN IF NOT EXISTS rfc_message_id TEXT,
  ADD COLUMN IF NOT EXISTS mailbox_identity TEXT,
  ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS clicked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS open_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS click_count INT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_outreach_deliveries_provider_msg
  ON outreach_deliveries (workspace_id, provider, provider_message_id)
  WHERE provider_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_outreach_deliveries_thread
  ON outreach_deliveries (workspace_id, provider_thread_id)
  WHERE provider_thread_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS outreach_provider_events (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  provider_event_id TEXT NOT NULL,
  workspace_id TEXT,
  mailbox_identity TEXT,
  provider_message_id TEXT,
  delivery_id TEXT,
  kind TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  checksum TEXT NOT NULL,
  processing_status TEXT NOT NULL DEFAULT 'applied',
  reject_reason TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, provider_event_id)
);

CREATE INDEX IF NOT EXISTS idx_outreach_provider_events_ws
  ON outreach_provider_events (workspace_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_outreach_provider_events_delivery
  ON outreach_provider_events (delivery_id, occurred_at DESC)
  WHERE delivery_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_outreach_provider_events_checksum
  ON outreach_provider_events (provider, checksum);

CREATE TABLE IF NOT EXISTS outreach_delivery_reconcile_gaps (
  id TEXT PRIMARY KEY,
  workspace_id TEXT,
  delivery_id TEXT,
  gap_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'warn',
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_outreach_reconcile_gaps_open
  ON outreach_delivery_reconcile_gaps (status, created_at DESC)
  WHERE status = 'open';

COMMENT ON TABLE outreach_provider_events IS
  'Normalized provider delivery/engagement events (idempotent by provider+event id).';
COMMENT ON TABLE outreach_delivery_reconcile_gaps IS
  'Reconciliation findings; never invents opens/clicks.';
