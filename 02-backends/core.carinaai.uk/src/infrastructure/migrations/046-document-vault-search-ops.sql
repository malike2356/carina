-- 044: Document Vault search index, job dead-letter, and ops (prompt 714).

ALTER TABLE document_vault_jobs
  ADD COLUMN IF NOT EXISTS item_id UUID,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS result_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS retry_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_retries INT NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS dead_letter_reason TEXT,
  ADD COLUMN IF NOT EXISTS claimed_by TEXT,
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS document_vault_jobs_idempotency_idx
  ON document_vault_jobs (workspace_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS document_vault_jobs_ws_status_idx
  ON document_vault_jobs (workspace_id, status, created_at);

CREATE TABLE IF NOT EXISTS document_vault_index_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  item_id UUID NOT NULL,
  revision INT NOT NULL,
  source_id TEXT NOT NULL,
  status TEXT NOT NULL,
  chunk_count INT NOT NULL DEFAULT 0,
  content_checksum TEXT,
  indexed_at TIMESTAMPTZ,
  error TEXT,
  UNIQUE (workspace_id, item_id, revision)
);

CREATE INDEX IF NOT EXISTS document_vault_index_entries_ws_idx
  ON document_vault_index_entries (workspace_id, status);

CREATE TABLE IF NOT EXISTS document_vault_index_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  item_id UUID NOT NULL,
  revision INT NOT NULL,
  chunk_index INT NOT NULL,
  text TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS document_vault_index_chunks_ws_item_idx
  ON document_vault_index_chunks (workspace_id, item_id, revision);
