import pg from 'pg';
import { config } from '../../config/index.js';

export const hubPool = new pg.Pool({ connectionString: config.hub.databaseUrl });

const HUB_SCHEMA = `
CREATE TABLE IF NOT EXISTS skill_packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  version TEXT NOT NULL,
  description TEXT NOT NULL,
  author TEXT NOT NULL,
  skill_count INTEGER NOT NULL DEFAULT 0,
  download_count INTEGER NOT NULL DEFAULT 0,
  archive_path TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
`;

export async function initHubDb(): Promise<void> {
  await hubPool.query(HUB_SCHEMA);
}
