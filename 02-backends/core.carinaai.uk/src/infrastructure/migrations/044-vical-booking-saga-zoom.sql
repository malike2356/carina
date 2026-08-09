-- Prompt 703: durable Zoom webhook receipts + provider op visibility (Postgres mirror).
-- File-backed viCal saga remains primary runtime SoT; these tables support operator audit on Contabo.

CREATE TABLE IF NOT EXISTS vical_provider_operations (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  booking_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  action TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  status TEXT NOT NULL,
  attempt INTEGER NOT NULL DEFAULT 1,
  provider_resource_id TEXT,
  error_code TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS vical_provider_operations_idem_uidx
  ON vical_provider_operations (workspace_id, action, idempotency_key);

CREATE INDEX IF NOT EXISTS vical_provider_operations_booking_idx
  ON vical_provider_operations (workspace_id, booking_id);

CREATE TABLE IF NOT EXISTS vical_webhook_receipts (
  id TEXT PRIMARY KEY,
  workspace_id TEXT,
  provider TEXT NOT NULL,
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'received',
  payload_safe JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS vical_webhook_receipts_provider_event_uidx
  ON vical_webhook_receipts (provider, event_id);

CREATE TABLE IF NOT EXISTS vical_conference_artifacts (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  booking_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_meeting_id TEXT,
  join_url TEXT,
  host_start_url_present BOOLEAN NOT NULL DEFAULT FALSE,
  passcode_required BOOLEAN NOT NULL DEFAULT FALSE,
  waiting_room BOOLEAN NOT NULL DEFAULT TRUE,
  managed BOOLEAN NOT NULL DEFAULT TRUE,
  fallback_label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS vical_conference_artifacts_booking_uidx
  ON vical_conference_artifacts (workspace_id, booking_id);
