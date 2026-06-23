import fs from 'fs/promises';
import path from 'path';
import { resolveCarinaHome } from '../../../config/paths.js';
import type { SkillSearchResult } from './types.js';

const INDEX_PATH = () => path.join(resolveCarinaHome(), 'skills-index.json');

export async function writeSearchIndex(results: SkillSearchResult[]): Promise<void> {
  const file = INDEX_PATH();
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(
    file,
    JSON.stringify({ indexedAt: new Date().toISOString(), results }, null, 2),
    'utf8',
  );
}

export async function readSearchIndex(): Promise<SkillSearchResult[]> {
  try {
    const raw = await fs.readFile(INDEX_PATH(), 'utf8');
    const parsed = JSON.parse(raw) as { results?: SkillSearchResult[] };
    return parsed.results ?? [];
  } catch {
    return [];
  }
}

export async function searchLocalIndex(query: string, limit = 50): Promise<SkillSearchResult[]> {
  const q = query.toLowerCase();
  const rows = await readSearchIndex();
  return rows
    .filter((r) =>
      r.name.toLowerCase().includes(q)
      || r.description.toLowerCase().includes(q)
      || r.tags.some((t) => t.toLowerCase().includes(q)),
    )
    .slice(0, limit);
}

export async function indexAllSources(
  searchFn: (query: string) => Promise<SkillSearchResult[]>,
): Promise<number> {
  const seeds = ['security', 'scanner', 'agent', 'productivity', 'development', 'api', 'database'];
  const merged = new Map<string, SkillSearchResult>();
  for (const seed of seeds) {
    const rows = await searchFn(seed);
    for (const row of rows) {
      merged.set(`${row.source}:${row.name}`, row);
    }
  }
  const results = [...merged.values()];
  await writeSearchIndex(results);
  return results.length;
}
