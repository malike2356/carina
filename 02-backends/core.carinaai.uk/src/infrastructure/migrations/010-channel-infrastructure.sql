-- Extend ai_worker_channels for encrypted credentials and routing metadata

ALTER TABLE ai_worker_channels ADD COLUMN IF NOT EXISTS workspace_id TEXT;
ALTER TABLE ai_worker_channels ADD COLUMN IF NOT EXISTS credentials JSONB NOT NULL DEFAULT '{}';
ALTER TABLE ai_worker_channels ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE ai_worker_channels ADD COLUMN IF NOT EXISTS verified BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE ai_worker_channels ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE ai_worker_channels c
SET workspace_id = w.workspace_id
FROM ai_workers w
WHERE c.worker_id = w.id AND (c.workspace_id IS NULL OR c.workspace_id = '');

CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_worker_channels_channel_identifier
  ON ai_worker_channels(channel, identifier);

CREATE INDEX IF NOT EXISTS idx_ai_worker_channels_worker_enabled
  ON ai_worker_channels(worker_id) WHERE enabled = true;

CREATE TABLE IF NOT EXISTS channel_threads (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id       UUID NOT NULL REFERENCES ai_workers(id) ON DELETE CASCADE,
  workspace_id    TEXT NOT NULL,
  channel         TEXT NOT NULL,
  contact_id      TEXT NOT NULL,
  thread_metadata JSONB NOT NULL DEFAULT '{}',
  last_message_at TIMESTAMPTZ,
  message_count   INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_channel_threads_worker
  ON channel_threads(worker_id, channel, contact_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_channel_threads_unique
  ON channel_threads(worker_id, channel, contact_id);

CREATE TABLE IF NOT EXISTS widget_sessions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id      UUID NOT NULL REFERENCES ai_workers(id) ON DELETE CASCADE,
  workspace_id   TEXT NOT NULL,
  session_token  TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  contact_id     TEXT NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_widget_sessions_token ON widget_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_widget_sessions_worker ON widget_sessions(worker_id, last_active_at DESC);
