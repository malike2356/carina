import { createIncident, getPublishedIncidents, recordResearchRun } from './store.js';
import { generateSlug } from './slug.js';
import { runWebSearch } from '../tools/web-search-provider.js';

export interface ResearchFinding {
  title: string;
  company: string;
  damage: string;
  category: 'financial' | 'security' | 'brand' | 'legal';
  dateOccurred: string;
  bodyHtml: string;
  sources: Array<{ label: string; url: string }>;
  scoutFixHtml: string;
}

export function buildResearchPrompt(): string {
  return [
    'INCIDENT RESEARCH TASK',
    '',
    'Search the web for NEW AI agent incidents from the past 30 days.',
    'Use current, named sources. Skip duplicates, opinion-only pieces, and incidents without real source URLs.',
    'Draft only. Do not publish anything.',
  ].join('\n');
}

export async function processResearchFindings(findings: ResearchFinding[]): Promise<{
  found: number;
  drafted: number;
  skipped: number;
  errors: string[];
}> {
  const existing = await getPublishedIncidents();
  const existingSlugs = new Set(existing.map((incident) => incident.slug));
  let drafted = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const finding of findings) {
    const slug = generateSlug(finding.title);
    if (!slug || existingSlugs.has(slug)) {
      skipped++;
      continue;
    }
    try {
      await createIncident({
        ...finding,
        slug,
        status: 'draft',
      });
      drafted++;
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }

  const result = { found: findings.length, drafted, skipped: skipped + errors.length, errors };
  await recordResearchRun(result, 'carina-conversation');
  return result;
}

export async function runResearchDiscovery(query = 'AI agent incident 2026'): Promise<{
  found: number;
  drafted: number;
  skipped: number;
  errors: string[];
}> {
  const hits = await runWebSearch(query, 6);
  const findings: ResearchFinding[] = hits.slice(0, 4).map((hit, index) => ({
    title: hit.title || `Incident lead ${index + 1}`,
    company: hit.title?.split('-')[0]?.trim() || 'Unknown company',
    damage: hit.description.slice(0, 80) || 'Under review',
    category: 'security',
    dateOccurred: new Date().toISOString().slice(0, 10),
    bodyHtml: `<p>${hit.description}</p>`,
    sources: [{ label: hit.title || 'source', url: hit.url }],
    scoutFixHtml: 'Add governance, approvals, and audit trails before production use.',
  }));
  return processResearchFindings(findings);
}
