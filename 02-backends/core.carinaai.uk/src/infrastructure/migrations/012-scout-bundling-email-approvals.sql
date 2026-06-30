-- Scout bundling per workspace (Aiva SaaS) and Email Handler approval queue

ALTER TABLE aiva_subscriptions ADD COLUMN IF NOT EXISTS scout_workspace_id TEXT;
ALTER TABLE aiva_subscriptions ADD COLUMN IF NOT EXISTS scout_api_key_encrypted TEXT;
ALTER TABLE aiva_subscriptions ADD COLUMN IF NOT EXISTS scout_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE aiva_subscriptions ADD COLUMN IF NOT EXISTS scout_dashboard_url TEXT;
ALTER TABLE aiva_subscriptions ADD COLUMN IF NOT EXISTS scout_provisioned_at TIMESTAMPTZ;
ALTER TABLE aiva_subscriptions ADD COLUMN IF NOT EXISTS scout_last_heartbeat_at TIMESTAMPTZ;
ALTER TABLE aiva_subscriptions ADD COLUMN IF NOT EXISTS scout_provision_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE aiva_subscriptions ADD COLUMN IF NOT EXISTS scout_next_retry_at TIMESTAMPTZ;

ALTER TABLE ai_workers ADD COLUMN IF NOT EXISTS approval_config JSONB NOT NULL DEFAULT '{"email_send": true}';
ALTER TABLE ai_workers ADD COLUMN IF NOT EXISTS scout_risk_level TEXT NOT NULL DEFAULT 'medium';

CREATE TABLE IF NOT EXISTS worker_email_approvals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id       UUID NOT NULL REFERENCES ai_workers(id) ON DELETE CASCADE,
  workspace_id    TEXT NOT NULL,
  digest_id       UUID REFERENCES worker_email_digests(id) ON DELETE SET NULL,
  message_id      TEXT,
  action_type     TEXT NOT NULL DEFAULT 'email_send',
  category        TEXT NOT NULL DEFAULT 'client_query',
  recipient       TEXT NOT NULL,
  subject         TEXT NOT NULL,
  draft_body      TEXT NOT NULL,
  original_from   TEXT,
  status          TEXT NOT NULL DEFAULT 'pending',
  requested_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_by     TEXT,
  reviewed_at     TIMESTAMPTZ,
  decision        TEXT,
  modified_body   TEXT,
  scout_event_id  TEXT,
  timeout_at      TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '4 hours')
);
CREATE INDEX IF NOT EXISTS idx_worker_email_approvals_workspace
  ON worker_email_approvals(workspace_id, status, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_worker_email_approvals_worker
  ON worker_email_approvals(worker_id, status, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_worker_email_approvals_timeout
  ON worker_email_approvals(status, timeout_at)
  WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS worker_pending_triggers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id       UUID NOT NULL REFERENCES ai_workers(id) ON DELETE CASCADE,
  workspace_id    TEXT NOT NULL,
  trigger_type    TEXT NOT NULL,
  trigger_detail  JSONB NOT NULL DEFAULT '{}',
  queued_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_worker_pending_triggers_worker
  ON worker_pending_triggers(worker_id, queued_at);

CREATE TABLE IF NOT EXISTS aiva_scout_event_queue (
  id              BIGSERIAL PRIMARY KEY,
  workspace_id    TEXT NOT NULL,
  worker_id       UUID,
  event_type      TEXT NOT NULL,
  payload         JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  flushed_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_aiva_scout_event_queue_pending
  ON aiva_scout_event_queue(workspace_id, created_at)
  WHERE flushed_at IS NULL;

ALTER TABLE worker_email_digests ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE worker_email_digests ADD COLUMN IF NOT EXISTS id UUID;
-- Ensure digest row id is usable for approvals (backfill from existing primary key if named differently)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'worker_email_digests' AND column_name = 'id'
  ) THEN
    ALTER TABLE worker_email_digests ADD COLUMN id UUID DEFAULT gen_random_uuid();
  END IF;
END $$;
