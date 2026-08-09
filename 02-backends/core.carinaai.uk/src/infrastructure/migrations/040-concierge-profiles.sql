-- 040: Concierge profiles for customer-facing Aiva workers (Prompt 698).
-- One profile per worker. Absence of a row means owner-assistant mode.

CREATE TABLE IF NOT EXISTS concierge_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL UNIQUE REFERENCES ai_workers(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL,
  published BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ,
  persona_name TEXT,
  greeting_message TEXT,
  business_name TEXT,
  business_description TEXT,
  knowledge_source_ids TEXT[] NOT NULL DEFAULT '{}',
  meeting_type_ids TEXT[] NOT NULL DEFAULT '{}',
  channel_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  calendar_provider TEXT,
  calendar_connected BOOLEAN NOT NULL DEFAULT false,
  conferencing_provider TEXT,
  conferencing_connected BOOLEAN NOT NULL DEFAULT false,
  business_hours JSONB,
  escalation_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_concierge_profiles_workspace
  ON concierge_profiles (workspace_id);

CREATE INDEX IF NOT EXISTS idx_concierge_profiles_published
  ON concierge_profiles (workspace_id, published)
  WHERE published = true;
