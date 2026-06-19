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
ALTER TABLE hub_skills ADD COLUMN IF NOT EXISTS security_verdict TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE hub_skills ADD COLUMN IF NOT EXISTS security_flags JSONB NOT NULL DEFAULT '[]';
ALTER TABLE skill_packs ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE skill_packs ADD COLUMN IF NOT EXISTS security_verdict TEXT NOT NULL DEFAULT 'pending';
`;

const HUB_REVIEWS_SCHEMA = `
ALTER TABLE hub_skills ADD COLUMN IF NOT EXISTS rating_avg NUMERIC(3,2) NOT NULL DEFAULT 0;
ALTER TABLE hub_skills ADD COLUMN IF NOT EXISTS review_count INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS hub_skill_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_name TEXT NOT NULL,
  skill_name TEXT NOT NULL,
  author_id TEXT NOT NULL,
  rating SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  body TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT hub_skill_reviews_unique_author UNIQUE (pack_name, skill_name, author_id),
  CONSTRAINT hub_skill_reviews_skill_fk FOREIGN KEY (pack_name, skill_name)
    REFERENCES hub_skills (pack_name, name) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS hub_skill_reviews_skill_idx
  ON hub_skill_reviews (pack_name, skill_name);

CREATE OR REPLACE FUNCTION hub_update_skill_rating()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE hub_skills
  SET
    rating_avg = (
      SELECT COALESCE(AVG(rating), 0)
      FROM hub_skill_reviews
      WHERE pack_name = NEW.pack_name AND skill_name = NEW.skill_name
    ),
    review_count = (
      SELECT COUNT(*)
      FROM hub_skill_reviews
      WHERE pack_name = NEW.pack_name AND skill_name = NEW.skill_name
    )
  WHERE pack_name = NEW.pack_name AND name = NEW.skill_name;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS hub_skill_rating_trigger ON hub_skill_reviews;
CREATE TRIGGER hub_skill_rating_trigger
  AFTER INSERT OR UPDATE OR DELETE ON hub_skill_reviews
  FOR EACH ROW EXECUTE FUNCTION hub_update_skill_rating();
`;

export async function initHubDb(): Promise<void> {
  await hubPool.query(HUB_SCHEMA);
  await hubPool.query(HUB_ALTER);
  await hubPool.query(HUB_REVIEWS_SCHEMA);
  const premiumSql = await fs.readFile(
    path.join(__dirname, 'migrations/002-premium-packs.sql'),
    'utf8',
  );
  await hubPool.query(premiumSql);
  const marketplaceSql = await fs.readFile(
    path.join(__dirname, 'migrations/003-marketplace.sql'),
    'utf8',
  );
  await hubPool.query(marketplaceSql);
}
