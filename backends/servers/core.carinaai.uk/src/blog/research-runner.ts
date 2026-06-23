import { llm } from '../brain/llm.js';
import type { Message } from '../types/index.js';
import { runWebSearch } from '../tools/web-search-provider.js';
import { createIncident, getLastResearchRun, listIncidents, recordResearchRun } from './store.js';
import { generateSlug } from './slug.js';
import {
  buildResearchPrompt,
  isJunkSearchHit,
  parseCuratedFindings,
  RESEARCH_QUERIES,
  scoreSearchHit,
  uniqueByUrl,
  type ResearchFinding,
} from './research-filters.js';

export type { ResearchFinding } from './research-filters.js';
export { buildResearchPrompt, cleanPlainText, isJunkSearchHit, scoreSearchHit } from './research-filters.js';

export interface ResearchResult {
  found: number;
  drafted: number;
  skipped: number;
  errors: string[];
  candidates: number;
  curated: number;
}

export async function gatherResearchCandidates(extraQuery?: string) {
  const queries = extraQuery ? [extraQuery, ...RESEARCH_QUERIES.slice(0, 3)] : [...RESEARCH_QUERIES];
  const batches = await Promise.all(
    queries.map(async (query) => {
      try {
        return await runWebSearch(query, 5);
      } catch {
        return [];
      }
    }),
  );
  return uniqueByUrl(batches.flat())
    .filter((hit) => !isJunkSearchHit(hit))
    .sort((a, b) => scoreSearchHit(b) - scoreSearchHit(a))
    .slice(0, 12);
}

export async function curateFindingsWithLlm(
  hits: Awaited<ReturnType<typeof gatherResearchCandidates>>,
  existingTitles: string[],
): Promise<ResearchFinding[]> {
  if (hits.length === 0) return [];

  const payload = hits.map((hit, index) => ({
    id: index + 1,
    title: hit.title.slice(0, 160),
    url: hit.url,
    snippet: hit.description.slice(0, 320),
  }));

  const prompt = [
    'You curate AI incident blog drafts for a security publication.',
    'Return ONLY a JSON array. No markdown fences.',
    'Each item must describe a REAL incident with a named company, quantified or concrete harm, and one source URL from the input.',
    'Skip: trend reports, events, LinkedIn posts, marketing pages, generic industry reports, duplicates.',
    'Maximum 3 items.',
    '',
    `Existing titles to avoid duplicating: ${existingTitles.slice(0, 20).join(' | ') || 'none'}`,
    '',
    'JSON shape:',
    '[{"title":"","company":"","damage":"","category":"financial|security|brand|legal","dateOccurred":"","body":"","scoutFix":"","sourceUrl":"","sourceLabel":""}]',
    '',
    'Search results:',
    JSON.stringify(payload, null, 2),
  ].join('\n');

  const messages: Message[] = [{ role: 'user', content: prompt, timestamp: new Date() }];
  const response = await llm.chatCheap(messages);
  return parseCuratedFindings(response.content);
}

export async function processResearchFindings(
  findings: ResearchFinding[],
  triggeredBy = 'carina-conversation',
): Promise<ResearchResult> {
  const existing = await listIncidents({ limit: 500 });
  const existingSlugs = new Set(existing.map((incident) => incident.slug));
  const existingUrls = new Set(
    existing.flatMap((incident) => incident.sources.map((source) => source.url.toLowerCase())),
  );

  let drafted = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const finding of findings) {
    const slug = generateSlug(finding.title);
    const sourceUrl = finding.sources[0]?.url?.toLowerCase() ?? '';
    if (!slug || existingSlugs.has(slug) || (sourceUrl && existingUrls.has(sourceUrl))) {
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
      existingSlugs.add(slug);
      if (sourceUrl) existingUrls.add(sourceUrl);
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }

  const result: ResearchResult = {
    found: findings.length,
    curated: findings.length,
    candidates: findings.length,
    drafted,
    skipped: skipped + errors.length,
    errors,
  };
  await recordResearchRun(result, triggeredBy);
  return result;
}

export async function runResearchDiscovery(options: {
  query?: string;
  triggeredBy?: string;
} = {}): Promise<ResearchResult> {
  const triggeredBy = options.triggeredBy ?? 'admin-ui';
  const candidates = await gatherResearchCandidates(options.query);
  const existing = await listIncidents({ limit: 500 });
  const existingTitles = existing.map((incident) => incident.title);

  let findings: ResearchFinding[] = [];
  const errors: string[] = [];

  if (candidates.length > 0) {
    try {
      findings = await curateFindingsWithLlm(candidates, existingTitles);
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }

  if (findings.length === 0) {
    const result: ResearchResult = {
      found: 0,
      curated: 0,
      candidates: candidates.length,
      drafted: 0,
      skipped: candidates.length,
      errors: errors.length
        ? errors
        : candidates.length
          ? ['No credible incidents passed curation. Try again later or create manually.']
          : ['No search results returned. Check web search configuration.'],
    };
    await recordResearchRun(result, triggeredBy);
    return result;
  }

  const saved = await processResearchFindings(findings, triggeredBy);
  return {
    ...saved,
    candidates: candidates.length,
    curated: findings.length,
    errors: [...errors, ...saved.errors],
  };
}

export { getLastResearchRun };
