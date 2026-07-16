CREATE TABLE IF NOT EXISTS hub_marketplace_entries (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  description TEXT NOT NULL,
  author TEXT NOT NULL,
  category TEXT,
  publisher TEXT NOT NULL DEFAULT 'community',
  featured BOOLEAN NOT NULL DEFAULT false,
  verified BOOLEAN NOT NULL DEFAULT false,
  validation_status TEXT NOT NULL DEFAULT 'pending',
  risk TEXT NOT NULL DEFAULT 'low',
  install_source TEXT NOT NULL DEFAULT 'hub',
  install_ref TEXT,
  install_json JSONB NOT NULL DEFAULT '{}',
  metadata_json JSONB NOT NULL DEFAULT '{}',
  archive_path TEXT,
  download_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (kind, slug)
);

CREATE INDEX IF NOT EXISTS hub_marketplace_kind_idx ON hub_marketplace_entries(kind);
CREATE INDEX IF NOT EXISTS hub_marketplace_featured_idx ON hub_marketplace_entries(featured) WHERE featured = true;
CREATE INDEX IF NOT EXISTS hub_marketplace_verified_idx ON hub_marketplace_entries(verified) WHERE verified = true;
