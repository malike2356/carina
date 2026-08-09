-- 037: Durable outreach sequence due-job queue (claim/lease, Soft Wall only).
-- Pattern matches ai_worker_automation_runs (FOR UPDATE SKIP LOCKED).

CREATE TABLE IF NOT EXISTS outreach_due_jobs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  enrollment_id TEXT NOT NULL,
  step_id TEXT NOT NULL,
  step_order INT NOT NULL DEFAULT 0,
  campaign_id TEXT,
  sequence_id TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 8,
  locked_at TIMESTAMPTZ,
  locked_by TEXT,
  available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  due_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_error TEXT,
  dead_letter_reason TEXT,
  result_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS outreach_due_jobs_one_open_idx
  ON outreach_due_jobs (workspace_id, enrollment_id, step_id)
  WHERE status IN ('queued', 'running', 'deferred');

CREATE INDEX IF NOT EXISTS outreach_due_jobs_claim_idx
  ON outreach_due_jobs (status, available_at, created_at)
  WHERE status IN ('queued', 'running', 'deferred');

CREATE INDEX IF NOT EXISTS outreach_due_jobs_ws_status
  ON outreach_due_jobs (workspace_id, status, available_at);

CREATE TABLE IF NOT EXISTS outreach_scheduler_control (
  key TEXT PRIMARY KEY DEFAULT 'global',
  paused BOOLEAN NOT NULL DEFAULT false,
  drain_mode BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT,
  reason TEXT
);

INSERT INTO outreach_scheduler_control (key, paused, drain_mode)
VALUES ('global', false, false)
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS outreach_scheduler_audit (
  id BIGSERIAL PRIMARY KEY,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS outreach_scheduler_audit_created
  ON outreach_scheduler_audit (created_at DESC);

CREATE TABLE IF NOT EXISTS outreach_scheduler_heartbeat (
  key TEXT PRIMARY KEY DEFAULT 'global',
  enqueue_at TIMESTAMPTZ,
  drain_at TIMESTAMPTZ,
  last_enqueue_count INT NOT NULL DEFAULT 0,
  last_drain_count INT NOT NULL DEFAULT 0,
  processed_total BIGINT NOT NULL DEFAULT 0,
  retry_total BIGINT NOT NULL DEFAULT 0,
  dead_letter_total BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO outreach_scheduler_heartbeat (key)
VALUES ('global')
ON CONFLICT (key) DO NOTHING;
