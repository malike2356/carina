import type pg from 'pg';
import { BACKGROUND_PROCESS_MIGRATION } from '../tools/process-persistence.js';
import { KANBAN_BOARD_MIGRATION } from '../agents/kanban-persistence.js';
import { WEBHOOK_MATURITY_MIGRATION } from '../webhooks/webhook-persistence.js';
import { PROFILE_ISOLATION_MIGRATION } from '../profiles/isolation-persistence.js';
import { SCOUT_INVESTIGATIONS_MIGRATION } from '../integrations/scout-investigations-persistence.js';
import { USER_MODEL_MIGRATION } from './user-model-store.js';
import { STANDING_ORDERS_MIGRATION } from '../agents/standing-orders-types.js';
import { IDENTITY_LINKS_MIGRATION } from '../gateway/identity-links-types.js';

const TABLES = `
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

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

const AI_WORKERS_MIGRATION = `
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
CREATE INDEX IF NOT EXISTS idx_worker_channels_lookup ON ai_worker_channels(channel, identifier);
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
CREATE INDEX IF NOT EXISTS idx_worker_activity_worker ON ai_worker_activity(worker_id, created_at DESC);
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
CREATE INDEX IF NOT EXISTS idx_escalations_open ON ai_worker_escalations(workspace_id, status, created_at DESC);
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
CREATE INDEX IF NOT EXISTS idx_worker_automations_worker ON ai_worker_automations(worker_id, enabled);
`;

const AIVA_SUBSCRIPTIONS_MIGRATION = `
CREATE TABLE IF NOT EXISTS aiva_subscriptions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    TEXT NOT NULL UNIQUE,
  plan_tier       TEXT NOT NULL DEFAULT 'trial',
  status          TEXT NOT NULL DEFAULT 'trialing',
  trial_ends_at   TIMESTAMPTZ,
  aiva_slot_limit INTEGER NOT NULL DEFAULT 1,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_aiva_subscriptions_workspace ON aiva_subscriptions(workspace_id);
`;

const AIVA_EMAIL_MIGRATION = `
CREATE TABLE IF NOT EXISTS aiva_workspace_contacts (
  workspace_id TEXT PRIMARY KEY,
  owner_email TEXT NOT NULL,
  owner_name TEXT NOT NULL DEFAULT '',
  email_unsubscribe_token UUID NOT NULL DEFAULT gen_random_uuid(),
  email_marketing_opt_out BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE aiva_subscriptions ADD COLUMN IF NOT EXISTS grace_period_ends_at TIMESTAMPTZ;
ALTER TABLE ai_worker_automations ADD COLUMN IF NOT EXISTS consecutive_failures INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ai_worker_automations ADD COLUMN IF NOT EXISTS last_error TEXT;
ALTER TABLE ai_worker_automations ADD COLUMN IF NOT EXISTS last_run_status TEXT;
ALTER TABLE ai_worker_automations ADD COLUMN IF NOT EXISTS last_run_error TEXT;
CREATE TABLE IF NOT EXISTS pending_workspace_deletions (
  workspace_id TEXT PRIMARY KEY,
  delete_after TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE ai_worker_activity ADD COLUMN IF NOT EXISTS pii_erased_at TIMESTAMPTZ;
ALTER TABLE ai_worker_activity ADD COLUMN IF NOT EXISTS channel TEXT;
ALTER TABLE ai_worker_activity ADD COLUMN IF NOT EXISTS contact_id TEXT;
CREATE INDEX IF NOT EXISTS idx_worker_activity_thread ON ai_worker_activity(worker_id, channel, contact_id, created_at);
ALTER TABLE aiva_workspace_contacts ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
`;

const AIVA_USAGE_MIGRATION = `
CREATE TABLE IF NOT EXISTS aiva_usage (
  workspace_id TEXT NOT NULL,
  month TEXT NOT NULL,
  message_count INTEGER NOT NULL DEFAULT 0,
  automation_count INTEGER NOT NULL DEFAULT 0,
  escalation_count INTEGER NOT NULL DEFAULT 0,
  warning_sent_at TIMESTAMPTZ,
  limit_reached_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (workspace_id, month)
);
CREATE INDEX IF NOT EXISTS idx_aiva_usage_workspace_month ON aiva_usage(workspace_id, month DESC);
ALTER TABLE aiva_subscriptions ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE aiva_subscriptions ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
ALTER TABLE aiva_subscriptions ADD COLUMN IF NOT EXISTS stripe_price_id TEXT;
ALTER TABLE aiva_subscriptions ADD COLUMN IF NOT EXISTS pending_downgrade_conflict BOOLEAN NOT NULL DEFAULT false;
`;

const AIVA_BILLING_MIGRATION = `
CREATE TABLE IF NOT EXISTS aiva_invoices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    TEXT NOT NULL,
  stripe_invoice_id TEXT NOT NULL UNIQUE,
  amount_paid     INTEGER NOT NULL DEFAULT 0,
  currency        TEXT NOT NULL DEFAULT 'gbp',
  status          TEXT NOT NULL DEFAULT 'open',
  invoice_pdf_url TEXT,
  period_start    TIMESTAMPTZ,
  period_end      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_aiva_invoices_workspace ON aiva_invoices(workspace_id);
ALTER TABLE aiva_subscriptions ADD COLUMN IF NOT EXISTS current_period_start TIMESTAMPTZ;
ALTER TABLE aiva_subscriptions ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ;
ALTER TABLE aiva_subscriptions ADD COLUMN IF NOT EXISTS billing_interval TEXT;
ALTER TABLE aiva_subscriptions ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE aiva_subscriptions ADD COLUMN IF NOT EXISTS payment_failed_at TIMESTAMPTZ;
`;

const AIVA_ADMIN_MIGRATION = `
CREATE TABLE IF NOT EXISTS admin_operators (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           TEXT NOT NULL UNIQUE,
  password_hash   TEXT NOT NULL,
  name            TEXT NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE admin_operators ADD COLUMN IF NOT EXISTS totp_secret TEXT;
ALTER TABLE admin_operators ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE admin_operators ADD COLUMN IF NOT EXISTS totp_verified_at TIMESTAMPTZ;
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id   UUID NOT NULL REFERENCES admin_operators(id),
  action          TEXT NOT NULL,
  target_type     TEXT NOT NULL,
  target_id       TEXT NOT NULL,
  metadata        JSONB NOT NULL DEFAULT '{}',
  ip_address      INET,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_admin ON admin_audit_log(admin_user_id, created_at DESC);
CREATE TABLE IF NOT EXISTS va_team_members (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  email           TEXT NOT NULL UNIQUE,
  available       BOOLEAN NOT NULL DEFAULT true,
  current_load    INTEGER NOT NULL DEFAULT 0,
  max_load        INTEGER NOT NULL DEFAULT 5,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE ai_worker_escalations ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'normal';
ALTER TABLE ai_worker_escalations ADD COLUMN IF NOT EXISTS first_response_at TIMESTAMPTZ;
ALTER TABLE ai_worker_escalations ADD COLUMN IF NOT EXISTS sla_first_response_target TIMESTAMPTZ;
ALTER TABLE ai_worker_escalations ADD COLUMN IF NOT EXISTS sla_resolution_target TIMESTAMPTZ;
ALTER TABLE ai_worker_escalations ADD COLUMN IF NOT EXISTS conversation_context JSONB NOT NULL DEFAULT '[]';
ALTER TABLE channel_threads ADD COLUMN IF NOT EXISTS va_override BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE aiva_subscriptions ADD COLUMN IF NOT EXISTS monthly_amount_pence INTEGER NOT NULL DEFAULT 0;
ALTER TABLE aiva_workspace_contacts ADD COLUMN IF NOT EXISTS admin_notes TEXT NOT NULL DEFAULT '';
ALTER TABLE aiva_invoices ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT;
UPDATE aiva_subscriptions SET monthly_amount_pence = CASE plan_tier
  WHEN 'starter' THEN 4900
  WHEN 'team' THEN 9900
  WHEN 'business' THEN 29900
  ELSE 0
END WHERE monthly_amount_pence = 0;
CREATE TABLE IF NOT EXISTS scout_signal_cache (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id    UUID NOT NULL,
  event_type  TEXT NOT NULL,
  severity    TEXT NOT NULL DEFAULT 'info',
  summary     TEXT NOT NULL DEFAULT '',
  metadata    JSONB NOT NULL DEFAULT '{}',
  scout_tx    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_scout_signal_cache_agent ON scout_signal_cache(agent_id, created_at DESC);
CREATE TABLE IF NOT EXISTS workspace_branding (
  workspace_id              TEXT PRIMARY KEY,
  logo_url                  TEXT,
  primary_color             TEXT NOT NULL DEFAULT '#1a5f7a',
  company_name              TEXT,
  custom_domain             TEXT,
  custom_domain_verified    BOOLEAN NOT NULL DEFAULT false,
  hide_verlox_attribution   BOOLEAN NOT NULL DEFAULT false,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS aiva_knowledge_base (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id     UUID NOT NULL REFERENCES ai_workers(id) ON DELETE CASCADE,
  workspace_id  TEXT NOT NULL,
  type          TEXT NOT NULL,
  title         TEXT NOT NULL,
  content       TEXT NOT NULL,
  char_count    INTEGER NOT NULL DEFAULT 0,
  enabled       BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_aiva_knowledge_worker ON aiva_knowledge_base(worker_id, enabled);
CREATE TABLE IF NOT EXISTS aiva_scout_governance (
  workspace_id                TEXT PRIMARY KEY,
  volume_spike_threshold      INTEGER NOT NULL DEFAULT 50,
  escalation_rate_threshold   NUMERIC(4,2) NOT NULL DEFAULT 0.30,
  escalation_burst_window     INTEGER NOT NULL DEFAULT 5,
  escalation_burst_count      INTEGER NOT NULL DEFAULT 3,
  ignore_signal_types         TEXT[] NOT NULL DEFAULT '{}',
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

const AMBIENT_AGENT_MIGRATION = `
CREATE TABLE IF NOT EXISTS ambient_channel_settings (
  channel_id TEXT PRIMARY KEY,
  channel_name TEXT NOT NULL DEFAULT '',
  passive_reading_enabled BOOLEAN NOT NULL DEFAULT true,
  ambient_checks_enabled BOOLEAN NOT NULL DEFAULT true,
  quiet_until TIMESTAMPTZ,
  response_mode TEXT NOT NULL DEFAULT 'thread',
  broadcast_on_complete BOOLEAN NOT NULL DEFAULT false,
  mention_required BOOLEAN NOT NULL DEFAULT true,
  dismissed_check_ids JSONB NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS channel_agent_bindings (
  channel_id TEXT PRIMARY KEY,
  channel_name TEXT NOT NULL DEFAULT '',
  agent_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_channel_agent_bindings_agent
  ON channel_agent_bindings (agent_id);
`;

const CHANNEL_CONTEXT_FACTS_MIGRATION = `
CREATE TABLE IF NOT EXISTS channel_context_facts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope TEXT NOT NULL,
  scope_name TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL,
  content TEXT NOT NULL,
  fact_type TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 0.5,
  metadata JSONB NOT NULL DEFAULT '{}',
  extracted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_channel_context_facts_scope
  ON channel_context_facts (scope, extracted_at DESC);
CREATE INDEX IF NOT EXISTS idx_channel_context_facts_type
  ON channel_context_facts (fact_type, extracted_at DESC);
`;

const CHANNEL_INFRASTRUCTURE_MIGRATION = `
ALTER TABLE ai_worker_channels ADD COLUMN IF NOT EXISTS workspace_id TEXT;
ALTER TABLE ai_worker_channels ADD COLUMN IF NOT EXISTS credentials JSONB NOT NULL DEFAULT '{}';
ALTER TABLE ai_worker_channels ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE ai_worker_channels ADD COLUMN IF NOT EXISTS verified BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE ai_worker_channels ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
UPDATE ai_worker_channels c SET workspace_id = w.workspace_id FROM ai_workers w WHERE c.worker_id = w.id AND (c.workspace_id IS NULL OR c.workspace_id = '');
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_worker_channels_channel_identifier ON ai_worker_channels(channel, identifier);
CREATE INDEX IF NOT EXISTS idx_ai_worker_channels_worker_enabled ON ai_worker_channels(worker_id) WHERE enabled = true;
CREATE TABLE IF NOT EXISTS channel_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES ai_workers(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL,
  channel TEXT NOT NULL,
  contact_id TEXT NOT NULL,
  thread_metadata JSONB NOT NULL DEFAULT '{}',
  last_message_at TIMESTAMPTZ,
  message_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_channel_threads_worker ON channel_threads(worker_id, channel, contact_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_channel_threads_unique ON channel_threads(worker_id, channel, contact_id);
CREATE TABLE IF NOT EXISTS widget_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES ai_workers(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL,
  session_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  contact_id TEXT NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_widget_sessions_token ON widget_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_widget_sessions_worker ON widget_sessions(worker_id, last_active_at DESC);
`;

/** Idempotent org-scoped billing columns for databases that predate hosted SaaS migrations. */
const ORG_SCOPED_COLUMNS_MIGRATION = `
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS org_id UUID;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS provisioning_source TEXT NOT NULL DEFAULT 'saas';
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE usage_records ADD COLUMN IF NOT EXISTS org_id UUID;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS org_id UUID;
ALTER TABLE tenant_provider_keys ADD COLUMN IF NOT EXISTS org_id UUID;
ALTER TABLE ops_credit_ledger ADD COLUMN IF NOT EXISTS org_id TEXT;
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

CREATE TABLE IF NOT EXISTS mcp_servers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  url TEXT NOT NULL,
  command TEXT,
  args JSONB,
  env JSONB,
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_ping TIMESTAMPTZ,
  last_ping_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mcp_servers_enabled_idx ON mcp_servers(enabled);
CREATE INDEX IF NOT EXISTS mcp_servers_last_ping_idx ON mcp_servers(last_ping DESC);
`;

const PLATFORM_PRICING_MIGRATION = `
CREATE TABLE IF NOT EXISTS platform_pricing (
  id         TEXT PRIMARY KEY,
  label      TEXT NOT NULL,
  monthly_gbp INTEGER,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO platform_pricing (id, label, monthly_gbp) VALUES
  ('aiva_starter',  'Aiva Starter',  49),
  ('aiva_team',     'Aiva Team',     99),
  ('aiva_business', 'Aiva Business', 299),
  ('scout_monitor', 'Scout Monitor', 49),
  ('scout_govern',  'Scout Govern',  79)
ON CONFLICT (id) DO NOTHING;
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
    await client.query(ORG_SCOPED_COLUMNS_MIGRATION);
  } catch {
    // org-scoped columns may already exist or tables may be absent in local-only setups
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
    await client.query(STANDING_ORDERS_MIGRATION);
  } catch {
    // standing orders table may already exist
  }
  try {
    await client.query(IDENTITY_LINKS_MIGRATION);
  } catch {
    // identity links table may already exist
  }
  try {
    await client.query(SCOUT_INVESTIGATIONS_MIGRATION);
  } catch {
    // scout investigations table may already exist
  }
  try {
    await client.query(AI_WORKERS_MIGRATION);
  } catch {
    // ai workers tables may already exist
  }
  try {
    await client.query(AIVA_SUBSCRIPTIONS_MIGRATION);
  } catch {
    // aiva subscriptions table may already exist
  }
  try {
    await client.query(AIVA_EMAIL_MIGRATION);
  } catch {
    // aiva email tables may already exist
  }
  try {
    await client.query(CHANNEL_INFRASTRUCTURE_MIGRATION);
  } catch {
    // channel infrastructure tables may already exist
  }
  try {
    await client.query(AIVA_USAGE_MIGRATION);
  } catch {
    // aiva usage tables may already exist
  }
  try {
    await client.query(AIVA_BILLING_MIGRATION);
  } catch {
    // aiva billing tables may already exist
  }
  try {
    await client.query(AIVA_ADMIN_MIGRATION);
  } catch {
    // aiva admin tables may already exist
  }
  try {
    await client.query(CHANNEL_CONTEXT_FACTS_MIGRATION);
  } catch {
    // channel context facts table may already exist
  }
  try {
    await client.query(AMBIENT_AGENT_MIGRATION);
  } catch {
    // ambient agent tables may already exist
  }
  try {
    await client.query(PLATFORM_PRICING_MIGRATION);
  } catch {
    // platform pricing table may already exist
  }
  try {
    await client.query(RAG_WORKSPACE_MIGRATION);
  } catch {
    // workspace_id column may already exist
  }
}

const RAG_WORKSPACE_MIGRATION = `
ALTER TABLE rag_chunks ADD COLUMN IF NOT EXISTS workspace_id uuid;
CREATE INDEX IF NOT EXISTS rag_chunks_workspace_idx ON rag_chunks(workspace_id);
CREATE INDEX IF NOT EXISTS rag_chunks_source_idx ON rag_chunks(source);
`;
