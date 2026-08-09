-- 043: Canonical Aiva Document Vault tables (prompt 708).
-- Metadata for tenant-scoped virtual filesystem. Content bodies live in
-- object/sandbox storage locators; small text may be inlined by the service.

CREATE TABLE IF NOT EXISTS document_vault_items (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL,
  parent_id UUID,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  extension TEXT,
  content_authority TEXT NOT NULL DEFAULT 'workspace'
    CHECK (content_authority IN ('workspace', 'google')),
  storage_locator JSONB NOT NULL DEFAULT '{"scheme":"inline"}'::jsonb,
  byte_size BIGINT NOT NULL DEFAULT 0,
  checksum TEXT NOT NULL DEFAULT '',
  current_revision INT NOT NULL DEFAULT 1,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  favorite BOOLEAN NOT NULL DEFAULT FALSE,
  trashed_at TIMESTAMPTZ,
  trash_parent_id UUID,
  index_policy TEXT NOT NULL DEFAULT 'inherit'
    CHECK (index_policy IN ('inherit', 'index', 'no_index')),
  classification TEXT NOT NULL DEFAULT 'internal'
    CHECK (classification IN ('internal', 'confidential', 'public_ready', 'restricted')),
  inline_content TEXT
);

CREATE INDEX IF NOT EXISTS document_vault_items_ws_parent_idx
  ON document_vault_items (workspace_id, parent_id, trashed_at);
CREATE INDEX IF NOT EXISTS document_vault_items_ws_updated_idx
  ON document_vault_items (workspace_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS document_vault_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES document_vault_items(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL,
  revision INT NOT NULL,
  checksum TEXT NOT NULL,
  byte_size BIGINT NOT NULL,
  storage_locator JSONB NOT NULL,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  note TEXT,
  inline_content TEXT,
  UNIQUE (item_id, revision)
);

CREATE TABLE IF NOT EXISTS document_vault_provider_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  item_id UUID NOT NULL REFERENCES document_vault_items(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_item_id TEXT NOT NULL,
  provider_revision_token TEXT,
  sync_status TEXT NOT NULL DEFAULT 'pending',
  local_checksum TEXT,
  remote_checksum TEXT,
  last_synced_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, provider, provider_item_id)
);

CREATE TABLE IF NOT EXISTS document_vault_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  kind TEXT NOT NULL,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'queued',
  attempts INT NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS document_vault_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  item_id UUID,
  actor_id TEXT,
  action TEXT NOT NULL,
  detail_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS document_vault_legacy_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  legacy_source TEXT NOT NULL,
  legacy_id TEXT NOT NULL,
  item_id UUID NOT NULL REFERENCES document_vault_items(id) ON DELETE CASCADE,
  checksum TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, legacy_source, legacy_id)
);

CREATE TABLE IF NOT EXISTS document_vault_quotas (
  workspace_id UUID PRIMARY KEY,
  max_bytes BIGINT NOT NULL,
  used_bytes BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS document_vault_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  action TEXT NOT NULL,
  item_ids_json JSONB NOT NULL,
  token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  consumed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS document_vault_migration_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  mode TEXT NOT NULL,
  source TEXT NOT NULL,
  status TEXT NOT NULL,
  imported INT NOT NULL DEFAULT 0,
  skipped INT NOT NULL DEFAULT 0,
  checksum_ok INT NOT NULL DEFAULT 0,
  detail_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
