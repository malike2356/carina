-- Aiva (AI worker) definitions and related tables

CREATE TABLE IF NOT EXISTS ai_workers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    TEXT NOT NULL,
  name            TEXT NOT NULL,
  role_description TEXT NOT NULL,
  template_id     TEXT,
  persona_prompt  TEXT NOT NULL,
  skill_packs     TEXT[] NOT NULL DEFAULT '{}',
  channels        TEXT[] NOT NULL DEFAULT '{}',
  language        TEXT NOT NULL DEFAULT 'en-GB',
  status          TEXT NOT NULL DEFAULT 'active',
  escalation_threshold INTEGER NOT NULL DEFAULT 60,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_worker_channels (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id   UUID NOT NULL REFERENCES ai_workers(id) ON DELETE CASCADE,
  channel     TEXT NOT NULL,
  identifier  TEXT NOT NULL,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_worker_channels_lookup
  ON ai_worker_channels(channel, identifier);

CREATE TABLE IF NOT EXISTS ai_worker_activity (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id       UUID NOT NULL REFERENCES ai_workers(id) ON DELETE CASCADE,
  action_type     TEXT NOT NULL,
  summary         TEXT NOT NULL,
  input_text      TEXT,
  output_text     TEXT,
  escalated       BOOLEAN NOT NULL DEFAULT FALSE,
  attestation_tx  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_worker_activity_worker
  ON ai_worker_activity(worker_id, created_at DESC);

CREATE TABLE IF NOT EXISTS ai_worker_escalations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id       UUID NOT NULL REFERENCES ai_workers(id) ON DELETE CASCADE,
  workspace_id    TEXT NOT NULL,
  channel         TEXT NOT NULL,
  channel_id      TEXT NOT NULL,
  original_input  TEXT NOT NULL,
  worker_draft    TEXT,
  holding_message TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'open',
  assigned_to     TEXT,
  resolved_at     TIMESTAMPTZ,
  resolution_text TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_escalations_open
  ON ai_worker_escalations(workspace_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS ai_worker_automations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id       UUID NOT NULL REFERENCES ai_workers(id) ON DELETE CASCADE,
  workspace_id    TEXT NOT NULL,
  name            TEXT NOT NULL,
  description     TEXT NOT NULL,
  cron_expression TEXT NOT NULL,
  schedule_label  TEXT NOT NULL,
  trigger_type    TEXT NOT NULL DEFAULT 'cron',
  trigger_event   TEXT,
  enabled         BOOLEAN NOT NULL DEFAULT TRUE,
  last_run_at     TIMESTAMPTZ,
  next_run_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_worker_automations_worker
  ON ai_worker_automations(worker_id, enabled);
