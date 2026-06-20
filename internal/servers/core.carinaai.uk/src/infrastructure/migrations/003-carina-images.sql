CREATE TABLE IF NOT EXISTS carina_images (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT '__operator__',
  prompt TEXT NOT NULL DEFAULT '',
  model TEXT,
  width INTEGER,
  height INTEGER,
  filepath TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS carina_images_tenant_idx ON carina_images (tenant_id, created_at DESC);
