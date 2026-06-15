import pg from 'pg';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../../config/index.js';

export const hubPool = new pg.Pool({ connectionString: config.hub.databaseUrl });

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const HUB_SCHEMA = `
CREATE TABLE IF NOT EXISTS skill_packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  version TEXT NOT NULL,
  description TEXT NOT NULL,
  author TEXT NOT NULL,
  category TEXT,
  skill_count INTEGER NOT NULL DEFAULT 0,
  download_count INTEGER NOT NULL DEFAULT 0,
  archive_path TEXT NOT NULL,
  featured BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hub_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_name TEXT NOT NULL REFERENCES skill_packs(name) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  triggers TEXT[] NOT NULL DEFAULT '{}',
  tools_used TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (pack_name, name)
);

CREATE INDEX IF NOT EXISTS hub_skills_pack_idx ON hub_skills(pack_name);
CREATE INDEX IF NOT EXISTS hub_skills_name_idx ON hub_skills(name);
`;

const HUB_ALTER = `
ALTER TABLE skill_packs ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE skill_packs ADD COLUMN IF NOT EXISTS featured BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE skill_packs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
`;

export async function initHubDb(): Promise<void> {
  await hubPool.query(HUB_SCHEMA);
  await hubPool.query(HUB_ALTER);
  const premiumSql = await fs.readFile(
    path.join(__dirname, 'migrations/002-premium-packs.sql'),
    'utf8',
  );
  await hubPool.query(premiumSql);
}
