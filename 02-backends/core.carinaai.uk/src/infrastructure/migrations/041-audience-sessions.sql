-- 041: Audience sessions for Customer Concierge external principals (Prompt 701).
-- Public widget visitors are never workspace members.

CREATE TABLE IF NOT EXISTS audience_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  channel TEXT NOT NULL DEFAULT 'web',
  external_key TEXT NOT NULL,
  display_name TEXT,
  email TEXT,
  phone TEXT,
  crm_contact_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, channel, external_key)
);

CREATE INDEX IF NOT EXISTS idx_audience_identities_workspace
  ON audience_identities (workspace_id);

CREATE TABLE IF NOT EXISTS audience_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  worker_id UUID NOT NULL REFERENCES ai_workers(id) ON DELETE CASCADE,
  concierge_profile_id UUID REFERENCES concierge_profiles(id) ON DELETE SET NULL,
  identity_id UUID NOT NULL REFERENCES audience_identities(id) ON DELETE CASCADE,
  channel TEXT NOT NULL DEFAULT 'web',
  session_mode TEXT NOT NULL DEFAULT 'public'
    CHECK (session_mode IN ('public', 'preview')),
  widget_session_token TEXT,
  origin TEXT,
  locale TEXT,
  consent_state TEXT NOT NULL DEFAULT 'unknown'
    CHECK (consent_state IN ('unknown', 'granted', 'denied', 'withdrawn')),
  risk_state TEXT NOT NULL DEFAULT 'normal'
    CHECK (risk_state IN ('normal', 'elevated', 'blocked')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'handed_off', 'closed')),
  expires_at TIMESTAMPTZ NOT NULL,
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_audience_sessions_widget_token
  ON audience_sessions (widget_session_token)
  WHERE widget_session_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audience_sessions_workspace_worker
  ON audience_sessions (workspace_id, worker_id);

CREATE INDEX IF NOT EXISTS idx_audience_sessions_identity
  ON audience_sessions (identity_id);

-- Link existing widget_sessions to audience principals when present.
ALTER TABLE widget_sessions
  ADD COLUMN IF NOT EXISTS audience_session_id UUID,
  ADD COLUMN IF NOT EXISTS session_mode TEXT NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS origin TEXT,
  ADD COLUMN IF NOT EXISTS embed_nonce TEXT,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_widget_sessions_audience
  ON widget_sessions (audience_session_id)
  WHERE audience_session_id IS NOT NULL;

-- Durable rate / abuse buckets (IP + session + worker).
CREATE TABLE IF NOT EXISTS audience_rate_buckets (
  bucket_key TEXT PRIMARY KEY,
  hit_count INT NOT NULL DEFAULT 0,
  reset_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One-time embed nonces (replay defense).
CREATE TABLE IF NOT EXISTS audience_embed_nonces (
  nonce TEXT PRIMARY KEY,
  worker_id UUID NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audience_embed_nonces_expires
  ON audience_embed_nonces (expires_at);
