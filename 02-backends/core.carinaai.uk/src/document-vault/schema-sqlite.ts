export const DOCUMENT_VAULT_SQLITE_SCHEMA = `
CREATE TABLE IF NOT EXISTS document_vault_items (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  parent_id TEXT,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  extension TEXT,
  content_authority TEXT NOT NULL DEFAULT 'workspace',
  storage_locator TEXT NOT NULL,
  byte_size INTEGER NOT NULL DEFAULT 0,
  checksum TEXT NOT NULL DEFAULT '',
  current_revision INTEGER NOT NULL DEFAULT 1,
  created_by TEXT,
  updated_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  favorite INTEGER NOT NULL DEFAULT 0,
  trashed_at TEXT,
  trash_parent_id TEXT,
  index_policy TEXT NOT NULL DEFAULT 'inherit',
  classification TEXT NOT NULL DEFAULT 'internal',
  inline_content TEXT
);

CREATE INDEX IF NOT EXISTS document_vault_items_ws_parent_idx
  ON document_vault_items (workspace_id, parent_id, trashed_at);
CREATE INDEX IF NOT EXISTS document_vault_items_ws_updated_idx
  ON document_vault_items (workspace_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS document_vault_revisions (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  checksum TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  storage_locator TEXT NOT NULL,
  created_by TEXT,
  created_at TEXT NOT NULL,
  note TEXT,
  inline_content TEXT,
  UNIQUE (item_id, revision)
);

CREATE TABLE IF NOT EXISTS document_vault_provider_mappings (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_item_id TEXT NOT NULL,
  provider_revision_token TEXT,
  sync_status TEXT NOT NULL DEFAULT 'pending',
  local_checksum TEXT,
  remote_checksum TEXT,
  last_synced_at TEXT,
  updated_at TEXT NOT NULL,
  UNIQUE (workspace_id, provider, provider_item_id)
);

CREATE TABLE IF NOT EXISTS document_vault_jobs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  item_id TEXT,
  idempotency_key TEXT,
  payload_json TEXT NOT NULL DEFAULT '{}',
  result_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'queued',
  attempts INTEGER NOT NULL DEFAULT 0,
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  last_error TEXT,
  dead_letter_reason TEXT,
  claimed_by TEXT,
  claimed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS document_vault_jobs_idempotency_idx
  ON document_vault_jobs (workspace_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS document_vault_jobs_ws_status_idx
  ON document_vault_jobs (workspace_id, status, created_at);

CREATE TABLE IF NOT EXISTS document_vault_audit_events (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  item_id TEXT,
  actor_id TEXT,
  action TEXT NOT NULL,
  detail_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS document_vault_legacy_mappings (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  legacy_source TEXT NOT NULL,
  legacy_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  checksum TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (workspace_id, legacy_source, legacy_id)
);

CREATE TABLE IF NOT EXISTS document_vault_quotas (
  workspace_id TEXT PRIMARY KEY,
  max_bytes INTEGER NOT NULL,
  used_bytes INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS document_vault_approvals (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  action TEXT NOT NULL,
  item_ids_json TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',
  created_by TEXT,
  created_at TEXT NOT NULL,
  consumed_at TEXT
);

CREATE TABLE IF NOT EXISTS document_vault_migration_runs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  mode TEXT NOT NULL,
  source TEXT NOT NULL,
  status TEXT NOT NULL,
  imported INTEGER NOT NULL DEFAULT 0,
  skipped INTEGER NOT NULL DEFAULT 0,
  checksum_ok INTEGER NOT NULL DEFAULT 0,
  detail_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS document_vault_channel_bindings (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  channel_user_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  audience TEXT NOT NULL DEFAULT 'private',
  grants_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (platform, channel_user_id)
);

CREATE INDEX IF NOT EXISTS document_vault_channel_bindings_ws_idx
  ON document_vault_channel_bindings (workspace_id, platform);

CREATE TABLE IF NOT EXISTS document_vault_channel_events (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  event_id TEXT NOT NULL,
  action TEXT NOT NULL,
  result_item_id TEXT,
  result_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  UNIQUE (workspace_id, platform, event_id, action)
);

CREATE TABLE IF NOT EXISTS document_vault_delivery_tokens (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_by TEXT,
  created_at TEXT NOT NULL,
  consumed_at TEXT
);

CREATE TABLE IF NOT EXISTS document_vault_index_entries (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  source_id TEXT NOT NULL,
  status TEXT NOT NULL,
  chunk_count INTEGER NOT NULL DEFAULT 0,
  content_checksum TEXT,
  indexed_at TEXT,
  error TEXT,
  UNIQUE (workspace_id, item_id, revision)
);

CREATE INDEX IF NOT EXISTS document_vault_index_entries_ws_idx
  ON document_vault_index_entries (workspace_id, status);

CREATE TABLE IF NOT EXISTS document_vault_index_chunks (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  chunk_index INTEGER NOT NULL,
  text TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS document_vault_index_chunks_ws_item_idx
  ON document_vault_index_chunks (workspace_id, item_id, revision);

CREATE INDEX IF NOT EXISTS document_vault_index_chunks_text_idx
  ON document_vault_index_chunks (workspace_id, text);
`;
