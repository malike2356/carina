import type { PackManifest } from '../pack-loader.js';
import type { PackSkillInput } from '../packs/property-uk/skills.js';
import { hubPool } from './migrations.js';

export interface HubPackRow {
  name: string;
  version: string;
  description: string;
  author: string;
  category: string | null;
  skill_count: number;
  download_count: number;
  featured: boolean;
  created_at: string;
  updated_at: string;
}

export interface HubSkillRow {
  id: string;
  pack_name: string;
  name: string;
  description: string;
  triggers: string[];
  tools_used: string[];
  created_at: string;
}

export interface RegistrySummary {
  packCount: number;
  skillCount: number;
  categories: string[];
  totalDownloads: number;
}

export interface PackFilters {
  category?: string;
  q?: string;
  featured?: boolean;
}

export interface SkillFilters {
  pack?: string;
  category?: string;
  q?: string;
  limit?: number;
  offset?: number;
}

export async function getRegistrySummary(): Promise<RegistrySummary> {
  const packs = await hubPool.query<{ count: string; downloads: string }>(
    `SELECT COUNT(*)::text AS count, COALESCE(SUM(download_count), 0)::text AS downloads FROM skill_packs`,
  );
  const skills = await hubPool.query<{ count: string }>(
    'SELECT COUNT(*)::text AS count FROM hub_skills',
  );
  const cats = await hubPool.query<{ category: string }>(
    `SELECT DISTINCT category FROM skill_packs WHERE category IS NOT NULL ORDER BY category`,
  );
  return {
    packCount: Number(packs.rows[0]?.count ?? 0),
    skillCount: Number(skills.rows[0]?.count ?? 0),
    categories: cats.rows.map((r) => r.category),
    totalDownloads: Number(packs.rows[0]?.downloads ?? 0),
  };
}

export async function listHubPacks(filters: PackFilters = {}): Promise<HubPackRow[]> {
  const clauses: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (filters.category) {
    clauses.push(`category = $${idx++}`);
    params.push(filters.category);
  }
  if (filters.featured) {
    clauses.push('featured = true');
  }
  if (filters.q?.trim()) {
    clauses.push(`(name ILIKE $${idx} OR description ILIKE $${idx} OR author ILIKE $${idx})`);
    params.push(`%${filters.q.trim()}%`);
    idx++;
  }

  const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  const result = await hubPool.query<HubPackRow>(
    `SELECT name, version, description, author, category, skill_count, download_count,
            featured, created_at, updated_at
     FROM skill_packs ${where}
     ORDER BY featured DESC, download_count DESC, name ASC`,
    params,
  );
  return result.rows;
}

export async function getHubPack(name: string): Promise<HubPackRow | null> {
  const result = await hubPool.query<HubPackRow>(
    `SELECT name, version, description, author, category, skill_count, download_count,
            featured, created_at, updated_at
     FROM skill_packs WHERE name = $1`,
    [name],
  );
  return result.rows[0] ?? null;
}

export async function listHubSkills(filters: SkillFilters = {}): Promise<HubSkillRow[]> {
  const clauses: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (filters.pack) {
    clauses.push(`s.pack_name = $${idx++}`);
    params.push(filters.pack);
  }
  if (filters.category) {
    clauses.push(`p.category = $${idx++}`);
    params.push(filters.category);
  }
  if (filters.q?.trim()) {
    const pattern = `%${filters.q.trim()}%`;
    clauses.push(`(
      s.name ILIKE $${idx} OR s.description ILIKE $${idx}
      OR $${idx + 1} = ANY(s.triggers)
      OR EXISTS (SELECT 1 FROM unnest(s.triggers) t WHERE t ILIKE $${idx})
    )`);
    params.push(pattern, filters.q.trim().toLowerCase());
    idx += 2;
  }

  const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  const limit = Math.min(Math.max(filters.limit ?? 100, 1), 500);
  const offset = Math.max(filters.offset ?? 0, 0);

  const result = await hubPool.query<HubSkillRow>(
    `SELECT s.id, s.pack_name, s.name, s.description, s.triggers, s.tools_used, s.created_at
     FROM hub_skills s
     LEFT JOIN skill_packs p ON p.name = s.pack_name
     ${where}
     ORDER BY s.pack_name, s.name
     LIMIT ${limit} OFFSET ${offset}`,
    params,
  );
  return result.rows;
}

export async function getHubSkill(packName: string, skillName: string): Promise<HubSkillRow | null> {
  const result = await hubPool.query<HubSkillRow>(
    `SELECT id, pack_name, name, description, triggers, tools_used, created_at
     FROM hub_skills WHERE pack_name = $1 AND name = $2`,
    [packName, skillName],
  );
  return result.rows[0] ?? null;
}

export async function getPackArchivePath(name: string): Promise<string | null> {
  const result = await hubPool.query<{ archive_path: string }>(
    'SELECT archive_path FROM skill_packs WHERE name = $1',
    [name],
  );
  return result.rows[0]?.archive_path ?? null;
}

export async function recordPackDownload(name: string): Promise<void> {
  await hubPool.query(
    'UPDATE skill_packs SET download_count = download_count + 1, updated_at = NOW() WHERE name = $1',
    [name],
  );
}

export async function upsertHubPack(
  manifest: PackManifest,
  archivePath: string,
  featured = false,
): Promise<void> {
  await hubPool.query(
    `INSERT INTO skill_packs (
      name, version, description, author, category, skill_count, archive_path, featured, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
    ON CONFLICT (name) DO UPDATE SET
      version = EXCLUDED.version,
      description = EXCLUDED.description,
      author = EXCLUDED.author,
      category = EXCLUDED.category,
      skill_count = EXCLUDED.skill_count,
      archive_path = EXCLUDED.archive_path,
      featured = EXCLUDED.featured,
      updated_at = NOW()`,
    [
      manifest.name,
      manifest.version,
      manifest.description,
      manifest.author,
      manifest.category ?? null,
      manifest.skillCount,
      archivePath,
      featured,
    ],
  );
}

export async function replacePackSkills(packName: string, skills: PackSkillInput[]): Promise<void> {
  await hubPool.query('DELETE FROM hub_skills WHERE pack_name = $1', [packName]);
  for (const skill of skills) {
    await hubPool.query(
      `INSERT INTO hub_skills (pack_name, name, description, triggers, tools_used)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (pack_name, name) DO UPDATE SET
         description = EXCLUDED.description,
         triggers = EXCLUDED.triggers,
         tools_used = EXCLUDED.tools_used`,
      [
        packName,
        skill.name,
        skill.description,
        skill.trigger ?? [],
        skill.toolsUsed ?? [],
      ],
    );
  }
}
