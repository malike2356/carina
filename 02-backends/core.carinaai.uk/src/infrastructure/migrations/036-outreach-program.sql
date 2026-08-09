-- 036: Aiva outreach program (core DB). Additive, workspace-scoped.
-- IDs are TEXT to preserve legacy JSON UUIDs. Entity bodies live in payload JSONB;
-- indexed columns support CRM filters, due sweeps, and keyset pagination.

CREATE TABLE IF NOT EXISTS outreach_meta (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS outreach_leads (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  email TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  pipeline_stage TEXT,
  source TEXT,
  company TEXT,
  niche TEXT,
  town_city TEXT,
  priority TEXT,
  has_email BOOLEAN NOT NULL DEFAULT false,
  replied BOOLEAN NOT NULL DEFAULT false,
  next_action_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INT NOT NULL DEFAULT 1,
  payload JSONB NOT NULL,
  UNIQUE (workspace_id, id)
);

CREATE INDEX IF NOT EXISTS idx_outreach_leads_workspace ON outreach_leads (workspace_id);
CREATE INDEX IF NOT EXISTS idx_outreach_leads_ws_updated ON outreach_leads (workspace_id, updated_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_outreach_leads_ws_status ON outreach_leads (workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_outreach_leads_ws_email ON outreach_leads (workspace_id, lower(email)) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_outreach_leads_ws_next ON outreach_leads (workspace_id, next_action_at) WHERE next_action_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS outreach_campaigns (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INT NOT NULL DEFAULT 1,
  payload JSONB NOT NULL,
  UNIQUE (workspace_id, id)
);
CREATE INDEX IF NOT EXISTS idx_outreach_campaigns_ws ON outreach_campaigns (workspace_id);

CREATE TABLE IF NOT EXISTS outreach_sequences (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INT NOT NULL DEFAULT 1,
  payload JSONB NOT NULL,
  UNIQUE (workspace_id, id)
);
CREATE INDEX IF NOT EXISTS idx_outreach_sequences_ws ON outreach_sequences (workspace_id);

CREATE TABLE IF NOT EXISTS outreach_enrollments (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  lead_id TEXT NOT NULL,
  sequence_id TEXT NOT NULL,
  campaign_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  next_action_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INT NOT NULL DEFAULT 1,
  payload JSONB NOT NULL,
  UNIQUE (workspace_id, id)
);
CREATE INDEX IF NOT EXISTS idx_outreach_enrollments_ws ON outreach_enrollments (workspace_id);
CREATE INDEX IF NOT EXISTS idx_outreach_enrollments_due ON outreach_enrollments (workspace_id, status, next_action_at)
  WHERE status = 'active' AND next_action_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_outreach_enrollments_lead ON outreach_enrollments (workspace_id, lead_id);

CREATE TABLE IF NOT EXISTS outreach_deliveries (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  enrollment_id TEXT,
  lead_id TEXT NOT NULL,
  approval_id TEXT,
  status TEXT NOT NULL,
  scheduled_for TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INT NOT NULL DEFAULT 1,
  payload JSONB NOT NULL,
  UNIQUE (workspace_id, id)
);
CREATE INDEX IF NOT EXISTS idx_outreach_deliveries_ws ON outreach_deliveries (workspace_id);
CREATE INDEX IF NOT EXISTS idx_outreach_deliveries_approval ON outreach_deliveries (workspace_id, approval_id)
  WHERE approval_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_outreach_deliveries_status ON outreach_deliveries (workspace_id, status);

CREATE TABLE IF NOT EXISTS outreach_lists (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INT NOT NULL DEFAULT 1,
  payload JSONB NOT NULL,
  UNIQUE (workspace_id, id)
);
CREATE INDEX IF NOT EXISTS idx_outreach_lists_ws ON outreach_lists (workspace_id);

CREATE TABLE IF NOT EXISTS outreach_list_members (
  workspace_id TEXT NOT NULL,
  list_id TEXT NOT NULL,
  lead_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (workspace_id, list_id, lead_id)
);

CREATE TABLE IF NOT EXISTS outreach_reply_reviews (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  lead_id TEXT,
  fingerprint TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INT NOT NULL DEFAULT 1,
  payload JSONB NOT NULL,
  UNIQUE (workspace_id, id)
);
CREATE INDEX IF NOT EXISTS idx_outreach_replies_ws ON outreach_reply_reviews (workspace_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_outreach_replies_fingerprint
  ON outreach_reply_reviews (workspace_id, fingerprint) WHERE fingerprint IS NOT NULL;

CREATE TABLE IF NOT EXISTS outreach_inbound_messages (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  lead_id TEXT,
  review_id TEXT,
  provider_message_id TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  retention_until TIMESTAMPTZ,
  payload JSONB NOT NULL,
  body_text TEXT,
  UNIQUE (workspace_id, id)
);
CREATE INDEX IF NOT EXISTS idx_outreach_inbound_ws ON outreach_inbound_messages (workspace_id);
CREATE INDEX IF NOT EXISTS idx_outreach_inbound_retention ON outreach_inbound_messages (retention_until)
  WHERE retention_until IS NOT NULL;

CREATE TABLE IF NOT EXISTS outreach_suppressions (
  workspace_id TEXT NOT NULL,
  email TEXT NOT NULL,
  email_normalized TEXT NOT NULL,
  reason TEXT NOT NULL,
  lead_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (workspace_id, email_normalized)
);

CREATE TABLE IF NOT EXISTS outreach_bookings (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  lead_id TEXT NOT NULL,
  status TEXT NOT NULL,
  starts_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INT NOT NULL DEFAULT 1,
  payload JSONB NOT NULL,
  UNIQUE (workspace_id, id)
);
CREATE INDEX IF NOT EXISTS idx_outreach_bookings_ws ON outreach_bookings (workspace_id);
CREATE INDEX IF NOT EXISTS idx_outreach_bookings_starts ON outreach_bookings (workspace_id, starts_at);

CREATE TABLE IF NOT EXISTS outreach_reminders (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  booking_id TEXT,
  lead_id TEXT,
  status TEXT NOT NULL,
  due_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INT NOT NULL DEFAULT 1,
  payload JSONB NOT NULL,
  UNIQUE (workspace_id, id)
);
CREATE INDEX IF NOT EXISTS idx_outreach_reminders_due ON outreach_reminders (workspace_id, status, due_at);

CREATE TABLE IF NOT EXISTS outreach_follow_up_tasks (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  lead_id TEXT NOT NULL,
  status TEXT NOT NULL,
  due_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INT NOT NULL DEFAULT 1,
  payload JSONB NOT NULL,
  UNIQUE (workspace_id, id)
);
CREATE INDEX IF NOT EXISTS idx_outreach_followups_due ON outreach_follow_up_tasks (workspace_id, status, due_at);

CREATE TABLE IF NOT EXISTS outreach_lead_views (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payload JSONB NOT NULL,
  UNIQUE (workspace_id, id)
);
CREATE INDEX IF NOT EXISTS idx_outreach_lead_views_ws ON outreach_lead_views (workspace_id);

CREATE TABLE IF NOT EXISTS outreach_ingest_jobs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payload JSONB NOT NULL,
  UNIQUE (workspace_id, id)
);
CREATE INDEX IF NOT EXISTS idx_outreach_ingest_ws ON outreach_ingest_jobs (workspace_id, created_at DESC);

CREATE TABLE IF NOT EXISTS outreach_funnel_events (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  lead_id TEXT,
  kind TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (workspace_id, id)
);
CREATE INDEX IF NOT EXISTS idx_outreach_funnel_ws ON outreach_funnel_events (workspace_id, created_at DESC);

CREATE TABLE IF NOT EXISTS outreach_controls (
  workspace_id TEXT PRIMARY KEY,
  paused BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payload JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS outreach_alert_targets (
  workspace_id TEXT PRIMARY KEY,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payload JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS outreach_booking_configs (
  workspace_id TEXT PRIMARY KEY,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payload JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS outreach_board_configs (
  workspace_id TEXT PRIMARY KEY,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payload JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS outreach_board_refs (
  workspace_id TEXT NOT NULL,
  lead_id TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payload JSONB NOT NULL,
  PRIMARY KEY (workspace_id, lead_id)
);

CREATE TABLE IF NOT EXISTS outreach_lead_sheet_configs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payload JSONB NOT NULL,
  UNIQUE (workspace_id, id)
);

CREATE TABLE IF NOT EXISTS outreach_migration_runs (
  id TEXT PRIMARY KEY,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  dry_run BOOLEAN NOT NULL DEFAULT false,
  source_path TEXT NOT NULL,
  source_sha256 TEXT NOT NULL,
  backup_path TEXT,
  report JSONB NOT NULL DEFAULT '{}'::jsonb
);

COMMENT ON TABLE outreach_inbound_messages IS
  'Provider payloads/bodies. Purge when retention_until < now(); default retention 90 days on insert.';
