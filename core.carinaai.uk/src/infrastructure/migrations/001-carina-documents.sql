CREATE TABLE IF NOT EXISTS carina_documents (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT '__operator__',
  title TEXT NOT NULL DEFAULT 'Untitled',
  content TEXT NOT NULL DEFAULT '',
  format TEXT NOT NULL DEFAULT 'markdown',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS carina_documents_tenant_idx
  ON carina_documents (tenant_id, updated_at DESC);
