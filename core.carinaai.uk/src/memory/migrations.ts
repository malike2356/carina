import type pg from 'pg';

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
    CREATE INDEX episodic_memories_tsv_idx ON episodic_memories USING GIN (content_tsv);
  END IF;
END $$;
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
}
