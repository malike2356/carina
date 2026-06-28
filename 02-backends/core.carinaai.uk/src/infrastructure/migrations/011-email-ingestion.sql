-- Per-Aiva email ingestion and Propreneur bridge binding (Phase 1)

ALTER TABLE ai_workers ADD COLUMN IF NOT EXISTS propreneur_tenant_slug TEXT;
ALTER TABLE ai_workers ADD COLUMN IF NOT EXISTS propreneur_bridge_key_ref TEXT;
ALTER TABLE ai_workers ADD COLUMN IF NOT EXISTS worker_config JSONB NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS worker_email_connections (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id             UUID NOT NULL REFERENCES ai_workers(id) ON DELETE CASCADE,
  imap_host             TEXT NOT NULL,
  imap_port             INTEGER NOT NULL DEFAULT 993,
  imap_tls              BOOLEAN NOT NULL DEFAULT TRUE,
  encrypted_credentials TEXT NOT NULL,
  last_poll_at          TIMESTAMPTZ,
  status                TEXT NOT NULL DEFAULT 'disconnected',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_worker_email_connections_worker
  ON worker_email_connections(worker_id);

CREATE TABLE IF NOT EXISTS worker_email_senders (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id  UUID NOT NULL REFERENCES worker_email_connections(id) ON DELETE CASCADE,
  email_address  TEXT NOT NULL,
  role_tag       TEXT NOT NULL DEFAULT 'other',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_worker_email_senders_unique
  ON worker_email_senders(connection_id, email_address);

CREATE TABLE IF NOT EXISTS worker_email_digests (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id      UUID NOT NULL REFERENCES ai_workers(id) ON DELETE CASCADE,
  message_id     TEXT NOT NULL,
  from_address   TEXT NOT NULL,
  role_tag       TEXT,
  parsed_data    JSONB NOT NULL DEFAULT '{}',
  processed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_worker_email_digests_message
  ON worker_email_digests(worker_id, message_id);
CREATE INDEX IF NOT EXISTS idx_worker_email_digests_worker_time
  ON worker_email_digests(worker_id, processed_at DESC);
