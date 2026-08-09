-- Prompt 704: calendar projections, delivery attempts, Google watch channels (Postgres mirror).

CREATE TABLE IF NOT EXISTS vical_calendar_projections (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  booking_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_event_id TEXT,
  etag TEXT,
  html_link TEXT,
  organizer_email TEXT,
  attendees JSONB NOT NULL DEFAULT '[]'::jsonb,
  invitation_send_requested BOOLEAN NOT NULL DEFAULT FALSE,
  last_reconciled_at TIMESTAMPTZ,
  sync_error TEXT,
  watch_channel_id TEXT,
  watch_resource_id TEXT,
  watch_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS vical_calendar_projections_booking_uidx
  ON vical_calendar_projections (workspace_id, booking_id);

CREATE INDEX IF NOT EXISTS vical_calendar_projections_event_idx
  ON vical_calendar_projections (provider_event_id);

CREATE TABLE IF NOT EXISTS vical_delivery_attempts (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  booking_id TEXT NOT NULL,
  participant_id TEXT,
  channel TEXT NOT NULL,
  state TEXT NOT NULL,
  provider_message_id TEXT,
  error_code TEXT,
  error_message TEXT,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS vical_delivery_attempts_booking_idx
  ON vical_delivery_attempts (workspace_id, booking_id);

CREATE TABLE IF NOT EXISTS vical_calendar_watch_channels (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  worker_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  resource_uri TEXT,
  token TEXT NOT NULL,
  expiration TIMESTAMPTZ NOT NULL,
  sync_token TEXT,
  booking_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS vical_calendar_watch_channels_uidx
  ON vical_calendar_watch_channels (workspace_id, channel_id);
