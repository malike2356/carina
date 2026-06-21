/**
 * Org-scoped AI platform tables for Carina Ops customer product.
 * Source of truth in core; ops.carinaai.uk prototype is reference only.
 */
export const AI_PLATFORM_SCHEMA = `
CREATE TABLE IF NOT EXISTS ai_platform_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  tier TEXT NOT NULL DEFAULT 'balanced',
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'active',
  input_price NUMERIC(10,4) NOT NULL DEFAULT 0,
  output_price NUMERIC(10,4) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, provider, model)
);

CREATE TABLE IF NOT EXISTS ai_platform_workbench_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled run',
  prompt TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  tokens_in INTEGER NOT NULL DEFAULT 0,
  tokens_out INTEGER NOT NULL DEFAULT 0,
  tokens_cached INTEGER NOT NULL DEFAULT 0,
  model_class TEXT,
  credits_billed NUMERIC(18,6) NOT NULL DEFAULT 0,
  cost_estimate NUMERIC(12,6) NOT NULL DEFAULT 0,
  response_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_platform_environments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  api_base_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, slug)
);

CREATE TABLE IF NOT EXISTS ai_platform_deployments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  environment_id UUID REFERENCES ai_platform_environments(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  model TEXT NOT NULL DEFAULT '',
  provider TEXT NOT NULL DEFAULT '',
  version TEXT NOT NULL DEFAULT '1.0.0',
  deployed_at TIMESTAMPTZ,
  metadata_json JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_platform_models_org
  ON ai_platform_models (org_id);
CREATE INDEX IF NOT EXISTS idx_ai_platform_workbench_runs_org
  ON ai_platform_workbench_runs (org_id, created_at DESC);

ALTER TABLE ai_platform_workbench_runs ADD COLUMN IF NOT EXISTS tokens_cached INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ai_platform_workbench_runs ADD COLUMN IF NOT EXISTS model_class TEXT;
ALTER TABLE ai_platform_workbench_runs ADD COLUMN IF NOT EXISTS credits_billed NUMERIC(18,6) NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_ai_platform_environments_org
  ON ai_platform_environments (org_id);
CREATE INDEX IF NOT EXISTS idx_ai_platform_deployments_org
  ON ai_platform_deployments (org_id, deployed_at DESC NULLS LAST);

CREATE TABLE IF NOT EXISTS ai_platform_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ready',
  mime_type TEXT,
  size_bytes BIGINT,
  storage_uri TEXT,
  batch_input_count INTEGER,
  batch_output_count INTEGER,
  metadata_json JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_platform_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  model TEXT NOT NULL DEFAULT '',
  provider TEXT NOT NULL DEFAULT '',
  instructions TEXT,
  metadata_json JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, slug)
);

CREATE TABLE IF NOT EXISTS ai_platform_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES ai_platform_agents(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT 'Untitled session',
  channel TEXT NOT NULL DEFAULT 'workbench',
  status TEXT NOT NULL DEFAULT 'open',
  message_count INTEGER NOT NULL DEFAULT 0,
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata_json JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_platform_memory_stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  store_type TEXT NOT NULL DEFAULT 'episodic',
  status TEXT NOT NULL DEFAULT 'active',
  record_count INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, slug)
);

CREATE TABLE IF NOT EXISTS ai_platform_usage_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  usage_date DATE NOT NULL,
  tokens_in INTEGER NOT NULL DEFAULT 0,
  tokens_out INTEGER NOT NULL DEFAULT 0,
  credits_billed NUMERIC(18,6) NOT NULL DEFAULT 0,
  cost_estimate NUMERIC(12,6) NOT NULL DEFAULT 0,
  request_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, usage_date)
);

CREATE INDEX IF NOT EXISTS idx_ai_platform_assets_org_kind
  ON ai_platform_assets (org_id, kind, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_platform_agents_org
  ON ai_platform_agents (org_id, name);
CREATE INDEX IF NOT EXISTS idx_ai_platform_sessions_org
  ON ai_platform_sessions (org_id, last_activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_platform_memory_stores_org
  ON ai_platform_memory_stores (org_id, name);
CREATE INDEX IF NOT EXISTS idx_ai_platform_usage_daily_org
  ON ai_platform_usage_daily (org_id, usage_date DESC);
`;

export interface DefaultModelSeed {
  provider: string;
  model: string;
  tier: string;
  isDefault: boolean;
  status: string;
  inputPrice: number;
  outputPrice: number;
  notes: string;
}

export const DEFAULT_MODELS: DefaultModelSeed[] = [
  {
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    tier: 'balanced',
    isDefault: true,
    status: 'active',
    inputPrice: 3,
    outputPrice: 15,
    notes: 'Everyday tasks, writing, cost-efficient',
  },
  {
    provider: 'anthropic',
    model: 'claude-opus-4-20250514',
    tier: 'premium',
    isDefault: false,
    status: 'active',
    inputPrice: 15,
    outputPrice: 75,
    notes: 'Complex projects, agents, coding',
  },
  {
    provider: 'anthropic',
    model: 'claude-haiku-3-5-20241022',
    tier: 'fast',
    isDefault: false,
    status: 'active',
    inputPrice: 0.8,
    outputPrice: 4,
    notes: 'Fastest, lowest cost, high volume',
  },
  {
    provider: 'openai',
    model: 'gpt-4o',
    tier: 'balanced',
    isDefault: false,
    status: 'active',
    inputPrice: 2.5,
    outputPrice: 10,
    notes: 'General purpose multimodal',
  },
  {
    provider: 'openai',
    model: 'gpt-4o-mini',
    tier: 'fast',
    isDefault: false,
    status: 'active',
    inputPrice: 0.15,
    outputPrice: 0.6,
    notes: 'Low cost high volume',
  },
];
