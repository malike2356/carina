-- 042: Published knowledge, customer support cases, handoff (Prompt 702).

-- Profile policy fields (JSON for flexibility; never expose unpublished sources).
ALTER TABLE concierge_profiles
  ADD COLUMN IF NOT EXISTS tone TEXT,
  ADD COLUMN IF NOT EXISTS supported_languages TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS response_boundaries TEXT,
  ADD COLUMN IF NOT EXISTS contact_capture_policy JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS booking_permission TEXT NOT NULL DEFAULT 'offer_and_book'
    CHECK (booking_permission IN ('off', 'offer_only', 'offer_and_book')),
  ADD COLUMN IF NOT EXISTS sla_policy JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS answer_policy JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS escalation_rules JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Knowledge publish state (enabled alone is not enough for visitors).
ALTER TABLE aiva_knowledge_base
  ADD COLUMN IF NOT EXISTS publish_state TEXT NOT NULL DEFAULT 'draft'
    CHECK (publish_state IN ('draft', 'published', 'archived')),
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS revision INT NOT NULL DEFAULT 1;

-- Backfill: previously enabled entries that owners already selected become published.
UPDATE aiva_knowledge_base
SET publish_state = 'published',
    published_at = COALESCE(published_at, created_at)
WHERE enabled = true
  AND publish_state = 'draft';

CREATE TABLE IF NOT EXISTS aiva_knowledge_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES aiva_knowledge_base(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL,
  workspace_id UUID NOT NULL,
  revision INT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  publish_state TEXT NOT NULL DEFAULT 'draft',
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (entry_id, revision)
);

CREATE INDEX IF NOT EXISTS idx_aiva_knowledge_revisions_entry
  ON aiva_knowledge_revisions (entry_id, revision DESC);

CREATE INDEX IF NOT EXISTS idx_aiva_knowledge_publish
  ON aiva_knowledge_base (worker_id, publish_state)
  WHERE publish_state = 'published';

-- Tenant customer-support cases (separate from product VA escalations).
CREATE TABLE IF NOT EXISTS concierge_support_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  worker_id UUID NOT NULL REFERENCES ai_workers(id) ON DELETE CASCADE,
  concierge_profile_id UUID REFERENCES concierge_profiles(id) ON DELETE SET NULL,
  audience_session_id UUID,
  identity_id UUID,
  contact_id TEXT,
  channel TEXT NOT NULL DEFAULT 'web',
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'pending_customer', 'pending_operator', 'resolved', 'closed')),
  priority TEXT NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  assignee_user_id TEXT,
  sla_first_response_at TIMESTAMPTZ,
  sla_resolution_at TIMESTAMPTZ,
  first_responded_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  conversation_summary TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_concierge_support_cases_workspace
  ON concierge_support_cases (workspace_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_concierge_support_cases_worker
  ON concierge_support_cases (worker_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_concierge_support_cases_session
  ON concierge_support_cases (audience_session_id)
  WHERE audience_session_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS concierge_support_case_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES concierge_support_cases(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  actor_type TEXT NOT NULL DEFAULT 'system'
    CHECK (actor_type IN ('system', 'visitor', 'ai', 'operator', 'owner')),
  actor_id TEXT,
  detail TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_concierge_support_case_events_case
  ON concierge_support_case_events (case_id, created_at ASC);

-- Internal notes: never injected into visitor prompts or widget stream.
CREATE TABLE IF NOT EXISTS concierge_internal_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  worker_id UUID NOT NULL,
  case_id UUID REFERENCES concierge_support_cases(id) ON DELETE CASCADE,
  audience_session_id UUID,
  author_user_id TEXT,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_concierge_internal_notes_case
  ON concierge_internal_notes (case_id, created_at ASC);

-- Audience session takeover fields.
ALTER TABLE audience_sessions
  ADD COLUMN IF NOT EXISTS handed_off_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS operator_user_id TEXT,
  ADD COLUMN IF NOT EXISTS active_support_case_id UUID,
  ADD COLUMN IF NOT EXISTS conversation_summary TEXT;
