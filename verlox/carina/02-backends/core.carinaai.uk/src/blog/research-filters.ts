import type { WebSearchHit } from '../tools/web-search-provider.js';

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

export const RESEARCH_QUERIES = [
  'AI chatbot lawsuit settlement 2026',
  'LLM data leak company fine',
  'AI coding agent production outage',
  'prompt injection attack breach',
  'autonomous AI agent financial loss',
  'AI agent customer harm lawsuit',
] as const;

const JUNK_URL_PATTERNS = [
  /linkedin\.com/i,
  /facebook\.com/i,
  /twitter\.com/i,
  /x\.com/i,
  /reddit\.com/i,
  /youtube\.com/i,
  /eventbrite/i,
  /\/events?\//i,
  /\/webinar/i,
  /\/whitepaper/i,
  /state-of-ai/i,
  /\/report\b/i,
  /gravitee\.io/i,
  /gartner\.com/i,
  /forrester\.com/i,
];

const JUNK_TITLE_PATTERNS = [
  /\b20\d{2}\s+report\b/i,
  /\btrends?\s+report\b/i,
  /\bkey trends\b/i,
  /\|\s*\d+\s+comments/i,
  /\bevent\s+20\d{2}\b/i,
  /\bregister now\b/i,
  /\bwhitepaper\b/i,
  /\brisk\s*&\s*action\s*report\b/i,
];

const INCIDENT_SIGNAL_PATTERNS = [
  /\blawsuit\b/i,
  /\bfine\b/i,
  /\bbreach\b/i,
  /\bleak\b/i,
  /\blost\b/i,
  /\$[\d,]+/,
  /\bsettlement\b/i,
  /\bshutdown\b/i,
  /\bharm\b/i,
  /\bexposed\b/i,
  /\battack\b/i,
  /\bincident\b/i,
  /\bchatbot\b/i,
  /\bagent\b/i,
];

export function cleanPlainText(input: string, maxLen = 240): string {
  return input
    .replace(/<[^>]+>/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\[[^\]]+\]/g, ' ')
    .replace(/[#*_`>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

export function isJunkDamageText(input: string): boolean {
  const plain = cleanPlainText(input, 400).toLowerCase();
  if (!plain || plain.length < 8) return true;
  if (/^(menu|report this post|share|subscribe|read more|sign in)\b/.test(plain)) return true;
  if (plain.includes('report this post')) return true;
  if (/\b(risk report|trends report|whitepaper|register now)\b/.test(plain) && !/\$[\d,]+/.test(plain)) return true;
  return false;
}

export function isJunkSearchHit(hit: WebSearchHit): boolean {
  const haystack = `${hit.title} ${hit.url} ${hit.description}`.toLowerCase();
  if (JUNK_URL_PATTERNS.some((pattern) => pattern.test(haystack))) return true;
  if (JUNK_TITLE_PATTERNS.some((pattern) => pattern.test(hit.title))) return true;
  if (hit.title.length > 140) return true;
  if (!hit.url.startsWith('http')) return true;
  const plain = cleanPlainText(hit.description, 400);
  if (plain.startsWith('#') || plain.includes('[Menu]')) return true;
  return false;
}

export function scoreSearchHit(hit: WebSearchHit): number {
  if (isJunkSearchHit(hit)) return -100;
  const text = `${hit.title} ${hit.description}`;
  let score = 0;
  for (const pattern of INCIDENT_SIGNAL_PATTERNS) {
    if (pattern.test(text)) score += 2;
  }
  if (/news|reuters|bbc|techcrunch|wired|arstechnica|theregister|bleepingcomputer/i.test(hit.url)) {
    score += 3;
  }
  if (hit.title.length <= 90) score += 1;
  return score;
}

export function buildResearchPrompt(existingSummary = 'None yet.'): string {
  return [
    'INCIDENT RESEARCH TASK',
    '',
    'Search the web for NEW AI agent incidents from the past 30 days.',
    'Use current, named sources. Skip duplicates, opinion-only pieces, and incidents without real source URLs.',
    '',
    'Search queries to try:',
    ...RESEARCH_QUERIES.map((query) => `- "${query}"`),
    '',
    'EXISTING INCIDENTS (do NOT duplicate):',
    existingSummary,
    '',
    'IMPORTANT: Drafts ONLY. The operator reviews and approves all drafts. Do not publish anything.',
  ].join('\n');
}

export function uniqueByUrl(hits: WebSearchHit[]): WebSearchHit[] {
  const seen = new Set<string>();
  const out: WebSearchHit[] = [];
  for (const hit of hits) {
    const key = hit.url.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(hit);
  }
  return out;
}

export function parseCuratedFindings(raw: string): ResearchFinding[] {
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[0]) as unknown;
    if (!Array.isArray(parsed)) return [];
    const findings: ResearchFinding[] = [];
    for (const entry of parsed) {
      if (!entry || typeof entry !== 'object') continue;
      const row = entry as Record<string, unknown>;
      const title = cleanPlainText(String(row.title ?? ''), 120);
      const company = cleanPlainText(String(row.company ?? ''), 80);
      const damage = cleanPlainText(String(row.damage ?? ''), 80);
      const category = String(row.category ?? 'security').toLowerCase();
      const body = cleanPlainText(String(row.body ?? row.summary ?? ''), 1200);
      const scoutFix = cleanPlainText(String(row.scoutFix ?? row.scout_fix ?? ''), 240);
      const sourceUrl = String(row.sourceUrl ?? row.source_url ?? '').trim();
      const sourceLabel = cleanPlainText(String(row.sourceLabel ?? row.source_label ?? title), 80);
      if (!title || !company || !damage || !sourceUrl.startsWith('http')) continue;
      if (isJunkDamageText(damage)) continue;
      if (!['financial', 'security', 'brand', 'legal'].includes(category)) continue;
      findings.push({
        title,
        company,
        damage,
        category: category as ResearchFinding['category'],
        dateOccurred: cleanPlainText(String(row.dateOccurred ?? row.date_occurred ?? ''), 40) || 'Recent',
        bodyHtml: `<p>${body}</p>`,
        sources: [{ label: sourceLabel || company, url: sourceUrl }],
        scoutFixHtml: scoutFix || 'Add governance, approvals, and audit trails before production use.',
      });
    }
    return findings;
  } catch {
    return [];
  }
}
