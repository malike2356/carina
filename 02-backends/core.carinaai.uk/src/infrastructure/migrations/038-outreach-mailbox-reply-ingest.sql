-- 038: Automatic mailbox reply ingestion (cursors, inbound dedupe, delivery provider ids).

ALTER TABLE outreach_inbound_messages
  ADD COLUMN IF NOT EXISTS worker_id TEXT,
  ADD COLUMN IF NOT EXISTS provider TEXT,
  ADD COLUMN IF NOT EXISTS thread_id TEXT,
  ADD COLUMN IF NOT EXISTS delivery_id TEXT,
  ADD COLUMN IF NOT EXISTS enrollment_id TEXT,
  ADD COLUMN IF NOT EXISTS campaign_id TEXT,
  ADD COLUMN IF NOT EXISTS match_method TEXT,
  ADD COLUMN IF NOT EXISTS match_confidence REAL,
  ADD COLUMN IF NOT EXISTS checksum TEXT,
  ADD COLUMN IF NOT EXISTS review_status TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_outreach_inbound_provider_msg
  ON outreach_inbound_messages (workspace_id, provider, provider_message_id)
  WHERE provider_message_id IS NOT NULL AND provider IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_outreach_inbound_thread
  ON outreach_inbound_messages (workspace_id, thread_id)
  WHERE thread_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_outreach_inbound_delivery
  ON outreach_inbound_messages (workspace_id, delivery_id)
  WHERE delivery_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS outreach_mailbox_sync_cursors (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  worker_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  mailbox_identity TEXT NOT NULL DEFAULT '',
  history_cursor TEXT,
  last_success_at TIMESTAMPTZ,
  last_error TEXT,
  status TEXT NOT NULL DEFAULT 'idle',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, worker_id, provider, mailbox_identity)
);

CREATE INDEX IF NOT EXISTS idx_outreach_mailbox_cursors_ws
  ON outreach_mailbox_sync_cursors (workspace_id, provider, status);

COMMENT ON TABLE outreach_mailbox_sync_cursors IS
  'Gmail history / IMAP watermark for automatic outreach reply ingestion.';
