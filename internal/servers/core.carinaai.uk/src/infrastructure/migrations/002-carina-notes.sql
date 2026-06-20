CREATE TABLE IF NOT EXISTS carina_notes (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT '__operator__',
  external_id TEXT,
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  format TEXT NOT NULL DEFAULT 'note',
  done INTEGER NOT NULL DEFAULT 0,
  remind_at TEXT,
  delivery_session_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS carina_notes_tenant_idx ON carina_notes (tenant_id, updated_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS carina_notes_external_idx
  ON carina_notes (tenant_id, external_id)
  WHERE external_id IS NOT NULL;
