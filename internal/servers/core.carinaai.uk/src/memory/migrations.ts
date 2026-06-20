import type pg from 'pg';
import { BACKGROUND_PROCESS_MIGRATION } from '../tools/process-persistence.js';
import { KANBAN_BOARD_MIGRATION } from '../agents/kanban-persistence.js';
import { WEBHOOK_MATURITY_MIGRATION } from '../webhooks/webhook-persistence.js';
import { PROFILE_ISOLATION_MIGRATION } from '../profiles/isolation-persistence.js';
import { SCOUT_INVESTIGATIONS_MIGRATION } from '../integrations/scout-investigations-persistence.js';
import { USER_MODEL_MIGRATION } from './user-model-store.js';

const TABLES = `
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS episodic_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  embedding VECTOR(768),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS skill_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  trigger_keywords TEXT[] NOT NULL,
  steps TEXT NOT NULL,
  tools_used TEXT[] DEFAULT '{}',
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rag_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  pack TEXT NOT NULL DEFAULT 'general',
  content TEXT NOT NULL,
  embedding VECTOR(768),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inbound_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_address TEXT NOT NULL,
  to_address TEXT NOT NULL,
  subject TEXT,
  body_text TEXT,
  body_html TEXT,
  message_id TEXT UNIQUE,
  read BOOLEAN DEFAULT FALSE,
  urgency TEXT DEFAULT 'normal',
  triage_status TEXT DEFAULT 'inbox',
  received_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subscriptions (
  tenant_id UUID PRIMARY KEY,
  plan TEXT NOT NULL CHECK (plan IN ('free', 'scout_monitor', 'scout_pro', 'scout_standard', 'enterprise')),
  status TEXT NOT NULL,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT UNIQUE,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  scout_api_key TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  stripe_invoice_id TEXT NOT NULL UNIQUE,
  amount INTEGER NOT NULL,
  status TEXT NOT NULL,
  pdf_url TEXT,
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS usage_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  date DATE NOT NULL,
  tokens_used INTEGER NOT NULL,
  model TEXT NOT NULL,
  cost_estimate NUMERIC(12, 6) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS model_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  tokens_used INTEGER NOT NULL,
  estimated_cost NUMERIC(12, 9) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stripe_events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS check_in_state (
  state_key TEXT PRIMARY KEY,
  last_checks JSONB NOT NULL DEFAULT '{}',
  last_check_at TIMESTAMPTZ,
  last_contacted_at TIMESTAMPTZ,
  rotation_position INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS persistent_facts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target TEXT NOT NULL CHECK (target IN ('user', 'memory')),
  content TEXT NOT NULL,
  embedding VECTOR(768),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scheduled_tasks (
  id UUID PRIMARY KEY,
  name TEXT,
  schedule TEXT NOT NULL,
  prompt TEXT,
  script_path TEXT,
  no_agent BOOLEAN DEFAULT false,
  deliver TEXT DEFAULT 'origin',
  repeat_count INT,
  runs_remaining INT,
  status TEXT DEFAULT 'active',
  last_run TIMESTAMPTZ,
  next_run TIMESTAMPTZ,
  context_from TEXT[] DEFAULT '{}',
  enabled_toolsets TEXT[] DEFAULT '{}',
  workdir TEXT,
  origin_session_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scheduled_task_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES scheduled_tasks(id) ON DELETE CASCADE,
  output TEXT,
  success BOOLEAN DEFAULT true,
  completed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kanban_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  board_id TEXT NOT NULL DEFAULT 'default',
  title TEXT NOT NULL,
  description TEXT,
  column_name TEXT NOT NULL DEFAULT 'backlog',
  assignee TEXT,
  priority INTEGER DEFAULT 0,
  blocked BOOLEAN DEFAULT false,
  block_reason TEXT,
  linked_card_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kanban_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES kanban_cards(id) ON DELETE CASCADE,
  author TEXT NOT NULL DEFAULT 'agent',
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE kanban_cards ADD COLUMN IF NOT EXISTS blocked BOOLEAN DEFAULT false;
ALTER TABLE kanban_cards ADD COLUMN IF NOT EXISTS block_reason TEXT;
ALTER TABLE kanban_cards ADD COLUMN IF NOT EXISTS linked_card_id UUID;

ALTER TABLE skill_documents ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE skill_documents ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE skill_documents ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ;

ALTER TABLE scheduled_tasks ADD COLUMN IF NOT EXISTS chain_after TEXT[] DEFAULT '{}';
ALTER TABLE scheduled_tasks ADD COLUMN IF NOT EXISTS deliver_channels TEXT[] DEFAULT '{}';
ALTER TABLE scheduled_tasks ADD COLUMN IF NOT EXISTS origin_channel TEXT;
ALTER TABLE scheduled_tasks ADD COLUMN IF NOT EXISTS origin_conversation_id TEXT;
ALTER TABLE scheduled_tasks ADD COLUMN IF NOT EXISTS origin_thread_id TEXT;

CREATE TABLE IF NOT EXISTS webhook_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL,
  events TEXT[] NOT NULL,
  secret TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tenant_provider_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  provider TEXT NOT NULL,
  encrypted_api_key TEXT NOT NULL,
  custom_base_url TEXT,
  custom_model TEXT,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, provider)
);

CREATE TABLE IF NOT EXISTS incident_blog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  company TEXT NOT NULL,
  damage TEXT NOT NULL,
  category TEXT NOT NULL,
  date_occurred TEXT NOT NULL,
  body_html TEXT NOT NULL,
  sources_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  scout_fix_html TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  newsletter_sent BOOLEAN NOT NULL DEFAULT FALSE,
  newsletter_sent_at TIMESTAMPTZ,
  rejection_reason TEXT
);

CREATE TABLE IF NOT EXISTS incident_blog_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  subscribed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  confirm_token TEXT,
  unsubscribed_at TIMESTAMPTZ,
  last_sent_at TIMESTAMPTZ,
  source TEXT DEFAULT 'incidents-page'
);

CREATE TABLE IF NOT EXISTS incident_research_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  triggered_by TEXT NOT NULL,
  found_count INTEGER NOT NULL DEFAULT 0,
  drafted_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  error_log TEXT
);
`;

const INDEXES = [
  `CREATE INDEX IF NOT EXISTS episodic_memories_embedding_idx
   ON episodic_memories USING ivfflat (embedding vector_cosine_ops)
   WITH (lists = 100)`,
  `CREATE INDEX IF NOT EXISTS rag_chunks_embedding_idx
   ON rag_chunks USING ivfflat (embedding vector_cosine_ops)
   WITH (lists = 100)`,
  `CREATE INDEX IF NOT EXISTS idx_invoices_tenant_created
   ON invoices (tenant_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_usage_records_tenant_date
     ON usage_records (tenant_id, date DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_model_usage_session_created
     ON model_usage (session_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_model_usage_created
     ON model_usage (created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_persistent_facts_target
     ON persistent_facts (target, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_status
     ON scheduled_tasks (status, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_kanban_cards_session
     ON kanban_cards (session_id, board_id, column_name)`,
  `CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_active
     ON webhook_subscriptions (active, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_tenant_provider_keys_tenant
     ON tenant_provider_keys (tenant_id)`,
  `CREATE INDEX IF NOT EXISTS idx_incident_blog_status
     ON incident_blog(status)`,
  `CREATE INDEX IF NOT EXISTS idx_incident_blog_category
     ON incident_blog(category)`,
  `CREATE INDEX IF NOT EXISTS idx_incident_blog_published_at
     ON incident_blog(published_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_incident_blog_slug
     ON incident_blog(slug)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_incident_blog_subscribers_email
     ON incident_blog_subscribers(email)`,
];

const PACKS_MIGRATION = `
CREATE TABLE IF NOT EXISTS installed_packs (
  tenant_id TEXT NOT NULL,
  pack_name TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT '1.0.0',
  status TEXT NOT NULL DEFAULT 'installed',
  installed_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (tenant_id, pack_name)
);
CREATE TABLE IF NOT EXISTS pack_config (
  tenant_id TEXT NOT NULL,
  pack_name TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (tenant_id, pack_name)
);
CREATE TABLE IF NOT EXISTS operator_pack_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor TEXT NOT NULL DEFAULT 'unknown',
  source TEXT NOT NULL DEFAULT 'ops',
  packs_before TEXT[] NOT NULL DEFAULT '{}',
  packs_after TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS operator_pack_audit_created_idx
  ON operator_pack_audit (created_at DESC);
`;

const PACKS_META_MIGRATION = `
ALTER TABLE installed_packs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE installed_packs ADD COLUMN IF NOT EXISTS updated_by TEXT DEFAULT 'system';
`;

const MEMORY_ADMIN_MIGRATION = `
ALTER TABLE episodic_memories ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 0;
ALTER TABLE episodic_memories ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'general';
ALTER TABLE episodic_memories ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE episodic_memories ADD COLUMN IF NOT EXISTS memory_tier TEXT DEFAULT 'short_term';
ALTER TABLE episodic_memories ADD COLUMN IF NOT EXISTS access_count INTEGER DEFAULT 0;
ALTER TABLE episodic_memories ADD COLUMN IF NOT EXISTS last_accessed_at TIMESTAMPTZ;
ALTER TABLE episodic_memories ADD COLUMN IF NOT EXISTS promotion_score NUMERIC(6,3) DEFAULT 0;
CREATE TABLE IF NOT EXISTS memory_promotion_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id UUID NOT NULL REFERENCES episodic_memories(id) ON DELETE CASCADE,
  proposed_content TEXT NOT NULL,
  proposed_target TEXT NOT NULL DEFAULT 'memory',
  score NUMERIC(6,3) NOT NULL,
  rationale TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS memory_promotion_queue_status_idx ON memory_promotion_queue(status);
CREATE INDEX IF NOT EXISTS episodic_memories_tier_idx ON episodic_memories(memory_tier, created_at DESC);
DO $$
BEGIN
  ALTER TABLE episodic_memories DROP CONSTRAINT IF EXISTS episodic_memories_role_check;
  ALTER TABLE episodic_memories ADD CONSTRAINT episodic_memories_role_check
    CHECK (role IN ('user', 'assistant', 'system'));
EXCEPTION WHEN others THEN
  NULL;
END $$;
`;

const FTS_MIGRATION = `
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'episodic_memories' AND column_name = 'content_tsv'
  ) THEN
    ALTER TABLE episodic_memories
      ADD COLUMN content_tsv tsvector
      GENERATED ALWAYS AS (to_tsvector('english', content)) STORED;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS episodic_memories_tsv_idx
  ON episodic_memories USING GIN (content_tsv);
`;

const SESSION_SEARCH_MIGRATION = `
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS episodic_memories_content_trgm_idx
  ON episodic_memories USING GIN (content gin_trgm_ops);
CREATE INDEX IF NOT EXISTS episodic_memories_session_created_idx
  ON episodic_memories (session_id, created_at DESC);
`;

const CRON_WORKFLOW_MIGRATION = `
CREATE TABLE IF NOT EXISTS cron_workflows (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  schedule TEXT NOT NULL,
  definition JSONB NOT NULL,
  deliver TEXT DEFAULT 'origin',
  deliver_channels TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'active',
  workdir TEXT,
  origin_session_id TEXT,
  origin_channel TEXT,
  origin_conversation_id TEXT,
  origin_thread_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cron_workflow_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES cron_workflows(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'queued',
  current_step_id TEXT,
  step_states JSONB NOT NULL DEFAULT '{}'::jsonb,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  error TEXT,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cron_workflow_runs_workflow
  ON cron_workflow_runs (workflow_id, created_at DESC);
`;

// Migrate existing 1536-dim columns to 768 (DeepSeek native dimension).
// Safe to run repeatedly - only fires when the old dimension is detected.
async function migrateDimensions(client: pg.PoolClient): Promise<void> {
  const check = await client.query<{ data_type: string }>(`
    SELECT pg_catalog.format_type(a.atttypid, a.atttypmod) AS data_type
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    WHERE c.relname = 'episodic_memories'
      AND a.attname = 'embedding'
      AND a.attnum > 0
  `);

  const currentType = check.rows[0]?.data_type ?? '';
  const needsMigration = currentType.includes('1536') || currentType.includes('1024');
  if (!needsMigration) return; // already 768 or table doesn't exist yet

  const fromDim = currentType.includes('1536') ? '1536' : '1024';
  console.log(`Migrating vector columns from ${fromDim} to 768 dims...`);
  // Drop indexes first (they reference the column type)
  await client.query('DROP INDEX IF EXISTS episodic_memories_embedding_idx');
  await client.query('DROP INDEX IF EXISTS rag_chunks_embedding_idx');
  // Wipe existing vectors - they are incompatible with the new dimension
  await client.query('UPDATE episodic_memories SET embedding = NULL');
  await client.query('UPDATE rag_chunks SET embedding = NULL');
  // Alter column type
  await client.query('ALTER TABLE episodic_memories ALTER COLUMN embedding TYPE VECTOR(768)');
  await client.query('ALTER TABLE rag_chunks ALTER COLUMN embedding TYPE VECTOR(768)');
  console.log('Vector column migration complete. Re-run pnpm ingest to rebuild the RAG index.');
}

const BILLING_PLAN_MIGRATION = `
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_plan_check;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_plan_check
  CHECK (plan IN ('free', 'scout_monitor', 'scout_pro', 'scout_standard', 'enterprise'));
`;

const OPS_METERING_MIGRATION = `
CREATE TABLE IF NOT EXISTS ops_model_rate_cards (
  id          SERIAL PRIMARY KEY,
  model_class TEXT    NOT NULL,
  input_weight  NUMERIC(10,6) NOT NULL,
  output_weight NUMERIC(10,6) NOT NULL,
  cache_weight  NUMERIC(10,6) NOT NULL,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  effective_to   TIMESTAMPTZ,
  note TEXT
);

CREATE TABLE IF NOT EXISTS ops_credit_ledger (
  id           BIGSERIAL PRIMARY KEY,
  org_id       TEXT NOT NULL,
  event_type   TEXT NOT NULL,
  credits      NUMERIC(18,6) NOT NULL,
  provider_cost_usd NUMERIC(18,9),
  model        TEXT,
  model_class  TEXT,
  session_id   TEXT,
  rate_card_id INT REFERENCES ops_model_rate_cards(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ops_credit_ledger_org_month
  ON ops_credit_ledger(org_id, created_at);

CREATE TABLE IF NOT EXISTS ops_plan_model_classes (
  plan_id     TEXT NOT NULL,
  model_class TEXT NOT NULL,
  PRIMARY KEY (plan_id, model_class)
);

INSERT INTO ops_model_rate_cards (model_class, input_weight, output_weight, cache_weight, note)
SELECT * FROM (VALUES
  ('mini',      0.000002::NUMERIC, 0.000008::NUMERIC, 0.0000005::NUMERIC, 'initial rate card 2026-06'),
  ('balanced',  0.000006::NUMERIC, 0.000024::NUMERIC, 0.0000015::NUMERIC, 'initial rate card 2026-06'),
  ('premium',   0.000020::NUMERIC, 0.000080::NUMERIC, 0.0000050::NUMERIC, 'initial rate card 2026-06'),
  ('frontier',  0.000050::NUMERIC, 0.000200::NUMERIC, 0.0000125::NUMERIC, 'initial rate card 2026-06')
) AS seed(model_class, input_weight, output_weight, cache_weight, note)
WHERE NOT EXISTS (SELECT 1 FROM ops_model_rate_cards LIMIT 1);

INSERT INTO ops_plan_model_classes (plan_id, model_class)
SELECT * FROM (VALUES
  ('free',              'mini'),
  ('carina_ops_starter','mini'),
  ('carina_ops_starter','balanced'),
  ('carina_ops_team',   'mini'),
  ('carina_ops_team',   'balanced'),
  ('carina_ops_team',   'premium'),
  ('enterprise',        'mini'),
  ('enterprise',        'balanced'),
  ('enterprise',        'premium'),
  ('enterprise',        'frontier')
) AS seed(plan_id, model_class)
WHERE NOT EXISTS (SELECT 1 FROM ops_plan_model_classes LIMIT 1);
`;

const EMAIL_TRIAGE_MIGRATION = `
ALTER TABLE inbound_emails ADD COLUMN IF NOT EXISTS urgency TEXT DEFAULT 'normal';
ALTER TABLE inbound_emails ADD COLUMN IF NOT EXISTS triage_status TEXT DEFAULT 'inbox';
`;

const SELF_IMPROVING_LOOP_MIGRATION = `
ALTER TABLE skill_documents ADD COLUMN IF NOT EXISTS success_count INTEGER DEFAULT 0;
ALTER TABLE skill_documents ADD COLUMN IF NOT EXISTS failure_count INTEGER DEFAULT 0;
ALTER TABLE skill_documents ADD COLUMN IF NOT EXISTS draft_source TEXT;

CREATE TABLE IF NOT EXISTS skill_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id UUID REFERENCES skill_documents(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS skill_audit_log_skill_idx ON skill_audit_log(skill_id, created_at DESC);
CREATE INDEX IF NOT EXISTS skill_audit_log_action_idx ON skill_audit_log(action, created_at DESC);

CREATE TABLE IF NOT EXISTS learning_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT '__operator__',
  session_id TEXT,
  event_type TEXT NOT NULL,
  idempotency_key TEXT,
  skill_id UUID REFERENCES skill_documents(id) ON DELETE SET NULL,
  skill_name TEXT,
  version INTEGER,
  input_summary JSONB,
  output_summary JSONB,
  internal_notes JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS learning_events_idempotency_idx
  ON learning_events(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS learning_events_tenant_idx ON learning_events(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS learning_events_skill_idx ON learning_events(skill_name, created_at DESC);

CREATE TABLE IF NOT EXISTS skill_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id UUID NOT NULL REFERENCES skill_documents(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  steps TEXT NOT NULL,
  trigger_keywords TEXT[] NOT NULL,
  tools_used TEXT[] NOT NULL,
  source TEXT NOT NULL,
  learning_event_id UUID REFERENCES learning_events(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(skill_id, version)
);
CREATE INDEX IF NOT EXISTS skill_versions_skill_idx ON skill_versions(skill_id, version DESC);
`;

export async function runMigrations(client: pg.PoolClient): Promise<void> {
  await client.query(TABLES);
  try {
    await client.query(BILLING_PLAN_MIGRATION);
  } catch {
    // constraint may already match
  }
  await migrateDimensions(client);
  for (const sql of INDEXES) {
    try {
      await client.query(sql);
    } catch {
      // ivfflat requires at least one row; safe to skip and retry after ingest
    }
  }
  try {
    await client.query(PACKS_MIGRATION);
  } catch {
    // tables may already exist
  }
  try {
    await client.query(PACKS_META_MIGRATION);
  } catch {
    // columns may already exist
  }
  try {
    await client.query(MEMORY_ADMIN_MIGRATION);
  } catch {
    // columns may already exist
  }
  try {
    await client.query(FTS_MIGRATION);
  } catch {
    // FTS column may already exist
  }
  try {
    await client.query(SESSION_SEARCH_MIGRATION);
  } catch {
    // session search indexes may already exist
  }
  try {
    await client.query(CRON_WORKFLOW_MIGRATION);
  } catch {
    // cron workflow tables may already exist
  }
  try {
    await client.query(BACKGROUND_PROCESS_MIGRATION);
  } catch {
    // background process tables may already exist
  }
  try {
    await client.query(KANBAN_BOARD_MIGRATION);
  } catch {
    // kanban board columns may already exist
  }
  try {
    await client.query(WEBHOOK_MATURITY_MIGRATION);
  } catch {
    // webhook delivery tables may already exist
  }
  try {
    await client.query(PROFILE_ISOLATION_MIGRATION);
  } catch {
    // profile isolation columns may already exist
  }
  try {
    await client.query(OPS_METERING_MIGRATION);
  } catch {
    // ops metering tables may already exist
  }
  try {
    await client.query(EMAIL_TRIAGE_MIGRATION);
  } catch {
    // triage columns may already exist
  }
  try {
    await client.query(SELF_IMPROVING_LOOP_MIGRATION);
  } catch {
    // columns/table may already exist
  }
  try {
    await client.query(USER_MODEL_MIGRATION);
  } catch {
    // user intelligence tables may already exist
  }
  try {
    await client.query(SCOUT_INVESTIGATIONS_MIGRATION);
  } catch {
    // scout investigations table may already exist
  }
}
