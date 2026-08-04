/**
 * Citation formatting helpers for the Research workspace UI.
 * Keep in sync with core.carinaai.uk/src/research/citation-styles.ts.
 */

import { marked } from 'marked';

export type CitationStyleId = 'apa7' | 'mla9' | 'chicago' | 'harvard';

marked.setOptions({ gfm: true, breaks: false });

function looksLikeHtml(value: string): boolean {
  const trimmed = value.trim();
  return /^<(?:p|h[1-6]|div|ul|ol|table|blockquote|pre|img|span|a|br|hr)\b/i.test(trimmed);
}

function markdownToHtml(markdown: string): string {
  const raw = marked.parse(markdown ?? '', { async: false });
  const html = typeof raw === 'string' ? raw.trim() : '';
  return html || '<p></p>';
}

export const CITATION_STYLES: Array<{
  id: CitationStyleId;
  label: string;
  shortLabel: string;
  hint: string;
}> = [
  { id: 'apa7', label: 'APA 7th edition', shortLabel: 'APA 7', hint: 'Author (Year) parentheticals' },
  { id: 'mla9', label: 'MLA 9th edition', shortLabel: 'MLA 9', hint: 'Author page style for web' },
  { id: 'chicago', label: 'Chicago', shortLabel: 'Chicago', hint: 'Notes and bibliography' },
  { id: 'harvard', label: 'Harvard', shortLabel: 'Harvard', hint: 'Author-date' },
];

export function parseCitationStyle(value: unknown): CitationStyleId {
  const raw = String(value ?? '').trim().toLowerCase();
  if (raw === 'apa' || raw === 'apa7') return 'apa7';
  if (raw === 'mla' || raw === 'mla9') return 'mla9';
  if (raw === 'chicago' || raw === 'chicago17') return 'chicago';
  if (raw === 'harvard') return 'harvard';
  return 'apa7';
}

export function citationStyleLabel(style: CitationStyleId): string {
  return CITATION_STYLES.find((item) => item.id === style)?.label ?? 'APA 7th edition';
}

export type CitationSource = {
  id?: string;
  title: string;
  url: string;
  snippet?: string;
  fetchedAt?: string;
};

function cleanTitle(title: string): string {
  return title.replace(/\s+/g, ' ').trim() || 'Untitled source';
}

function siteFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'Web';
  }
}

function yearFromFetchedAt(fetchedAt?: string): string {
  if (!fetchedAt) return 'n.d.';
  const year = new Date(fetchedAt).getFullYear();
  return Number.isFinite(year) ? String(year) : 'n.d.';
}

function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url.trim());
    parsed.hash = '';
    const path = parsed.pathname.replace(/\/+$/, '') || '/';
    return `${parsed.protocol}//${parsed.host.toLowerCase()}${path}${parsed.search}`;
  } catch {
    return url.trim().replace(/\/+$/, '');
  }
}

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/** Rough HTML to markdown so citation rewrite works after TipTap HTML saves. */
export function researchHtmlToMarkdown(html: string): string {
  let text = html.replace(/\r\n?/g, '\n');
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, (_, inner) => `# ${stripTags(inner).trim()}\n\n`);
  text = text.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, (_, inner) => `## ${stripTags(inner).trim()}\n\n`);
  text = text.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, (_, inner) => `### ${stripTags(inner).trim()}\n\n`);
  text = text.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, (_, inner) => `#### ${stripTags(inner).trim()}\n\n`);
  text = text.replace(
    /<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
    (_, href, inner) => `[${stripTags(inner).trim() || href}](${href})`,
  );
  text = text.replace(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi, '**$2**');
  text = text.replace(/<(em|i)[^>]*>([\s\S]*?)<\/\1>/gi, '*$2*');
  text = text.replace(/<u[^>]*>([\s\S]*?)<\/u>/gi, '$1');
  text = text.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, inner) => `- ${stripTags(inner).trim()}\n`);
  text = text.replace(/<\/(p|div|blockquote|tr)>/gi, '\n\n');
  text = text.replace(/<hr\s*\/?>/gi, '\n\n---\n\n');
  text = text.replace(/<[^>]+>/g, '');
  return decodeEntities(text).replace(/\n{3,}/g, '\n\n').trim();
}

function stripTags(value: string): string {
  return decodeEntities(value.replace(/<[^>]+>/g, ''));
}

export function inlineCitationLabel(source: CitationSource, index: number): string {
  const title = cleanTitle(source.title);
  const short = title.length > 48 ? `${title.slice(0, 45)}...` : title;
  return short || `Source ${index + 1}`;
}

export function formatInlineCitation(
  style: CitationStyleId,
  source: CitationSource,
  index: number,
): string {
  const label = inlineCitationLabel(source, index);
  const year = yearFromFetchedAt(source.fetchedAt);
  switch (style) {
    case 'mla9':
      return `(${label})`;
    case 'chicago':
      return `(${index + 1})`;
    case 'harvard':
      return `(${label}, ${year})`;
    case 'apa7':
    default:
      return `(${label}, ${year})`;
  }
}

/** Bibliography line without leading enumeration (caller may number for Chicago notes). */
export function formatReferenceEntry(
  style: CitationStyleId,
  source: CitationSource,
  _index: number,
): string {
  const title = cleanTitle(source.title);
  const site = siteFromUrl(source.url);
  const year = yearFromFetchedAt(source.fetchedAt);
  const accessed = source.fetchedAt
    ? new Date(source.fetchedAt).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : 'n.d.';

  switch (style) {
    case 'mla9':
      return `"${title}." ${site}, ${year === 'n.d.' ? 'n.d.' : year}, ${source.url}.`;
    case 'chicago':
      return `"${title}." ${site}. Accessed ${accessed}. ${source.url}.`;
    case 'harvard':
      return `${title} (${year}) Available at: ${source.url} (Accessed: ${accessed}).`;
    case 'apa7':
    default:
      return `${title}. (${year}). ${site}. ${source.url}`;
  }
}

export function referencesHeading(style: CitationStyleId): string {
  switch (style) {
    case 'mla9':
      return 'Works Cited';
    case 'chicago':
      return 'Bibliography';
    case 'harvard':
      return 'Reference List';
    case 'apa7':
    default:
      return 'References';
  }
}

const REF_HEADING_RE =
  /^(#{1,4}\s*)?(References|Works Cited|Bibliography|Reference List|Sources|Source Provenance)\s*$/i;

function stripReferenceSections(markdown: string): string {
  const lines = markdown.split('\n');
  let cutAt = -1;

  for (let i = 0; i < lines.length; i += 1) {
    const trimmed = lines[i]?.trim() ?? '';
    if (REF_HEADING_RE.test(trimmed) || /^<h[1-4][^>]*>\s*(References|Works Cited|Bibliography|Reference List|Sources|Source Provenance)\s*<\/h[1-4]>$/i.test(trimmed)) {
      cutAt = i;
      break;
    }
  }

  const kept = cutAt >= 0 ? lines.slice(0, cutAt) : [...lines];

  while (kept.length > 0) {
    const last = kept[kept.length - 1]?.trim() ?? '';
    if (
      last === ''
      || last === '---'
      || /^\*Generated\b/i.test(last)
      || /^\*Citation style:/i.test(last)
      || /^Generated:/i.test(last)
      || /^Search queries:/i.test(last)
      || /^Rounds:/i.test(last)
      || /^Sources verified:/i.test(last)
    ) {
      kept.pop();
      continue;
    }
    break;
  }

  return kept.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function withSourceIds(sources: CitationSource[]): Array<CitationSource & { id: string }> {
  return sources.map((source, index) => ({
    ...source,
    id: source.id?.trim() || `src-${index + 1}`,
  }));
}

function sortSourcesForStyle(
  sources: Array<CitationSource & { id: string }>,
  style: CitationStyleId,
): Array<CitationSource & { id: string }> {
  // Chicago notes keep discovery order for numbered footnotes; bibliographies sort A-Z.
  if (style === 'chicago') return sources;
  return [...sources].sort((a, b) =>
    cleanTitle(a.title).localeCompare(cleanTitle(b.title), 'en', { sensitivity: 'base' }),
  );
}

function buildReferencesMarkdown(
  style: CitationStyleId,
  sources: Array<CitationSource & { id: string }>,
): string {
  const heading = referencesHeading(style);
  const lines: string[] = ['', `## ${heading}`, ''];

  sources.forEach((source, index) => {
    const entry = formatReferenceEntry(style, source, index);
    if (style === 'chicago') {
      lines.push(`${index + 1}. [${entry}](${source.url})`);
    } else {
      lines.push(`[${entry}](${source.url})`);
    }
    lines.push('');
  });

  lines.push('---', '');
  lines.push(
    `*Citation style: ${citationStyleLabel(style)} · ${sources.length} source${sources.length === 1 ? '' : 's'}*`,
  );
  return lines.join('\n');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildReferencesHtml(
  style: CitationStyleId,
  sources: Array<CitationSource & { id: string }>,
): string {
  const heading = referencesHeading(style);
  const parts = [
    `<section class="research-paper-refs">`,
    `<h2>${escapeHtml(heading)}</h2>`,
  ];
  sources.forEach((source, index) => {
    const entry = formatReferenceEntry(style, source, index);
    const label = style === 'chicago' ? `${index + 1}. ${entry}` : entry;
    parts.push(
      `<p class="research-paper-ref-hanging"><a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a></p>`,
    );
  });
  parts.push(
    `<hr />`,
    `<p><em>Citation style: ${escapeHtml(citationStyleLabel(style))} · ${sources.length} source${sources.length === 1 ? '' : 's'}</em></p>`,
    `</section>`,
  );
  return parts.join('\n');
}

/**
 * Rewrite an existing research document into the selected citation style.
 * Accepts markdown or HTML; returns the same format family as the input.
 */
export function reformatResearchDocument(
  content: string,
  sources: CitationSource[],
  style: CitationStyleId,
): string {
  const original = content ?? '';
  const asHtml = looksLikeHtml(original);
  let body = asHtml ? researchHtmlToMarkdown(original) : original;
  body = stripReferenceSections(body);

  const usable = withSourceIds(
    sources.filter((source) => String(source.url ?? '').trim().length > 0),
  );

  if (usable.length === 0) {
    return asHtml ? markdownToHtml(body) : body.trim();
  }

  const ordered = sortSourcesForStyle(usable, style);
  // Chicago inline numbers follow original discovery order, not A-Z.
  const inlineOrder = style === 'chicago' ? usable : ordered;

  const byUrl = new Map<string, { source: CitationSource & { id: string }; index: number }>();
  const byId = new Map<string, { source: CitationSource & { id: string }; index: number }>();
  inlineOrder.forEach((source, index) => {
    byUrl.set(normalizeUrl(source.url), { source, index });
    byId.set(source.id.toLowerCase(), { source, index });
    byId.set(`s${index + 1}`, { source, index });
    byId.set(`src-${index + 1}`, { source, index });
  });

  // Markdown links to known sources.
  body = body.replace(
    /\[([^\]]*)\]\((https?:\/\/[^)\s]+)(?:\s+"[^"]*")?\)/g,
    (full, _label: string, href: string) => {
      const hit = byUrl.get(normalizeUrl(href));
      if (!hit) return full;
      const citation = formatInlineCitation(style, hit.source, hit.index);
      const title = cleanTitle(hit.source.title).replace(/"/g, "'");
      return `[${citation}](${hit.source.url} "${title}")`;
    },
  );

  // Bare [src-1] / [S1] tokens (not already part of a markdown link).
  body = body.replace(/(^|[^[])\[((?:src-|s)?\d+)\](?!\()/gi, (full, prefix: string, token: string) => {
    const key = String(token).toLowerCase();
    const hit = byId.get(key) ?? byId.get(key.replace(/^s(?=\d)/, 'src-'));
    if (!hit) return full;
    const citation = formatInlineCitation(style, hit.source, hit.index);
    const title = cleanTitle(hit.source.title).replace(/"/g, "'");
    return `${prefix}[${citation}](${hit.source.url} "${title}")`;
  });

  // Prior parenthetical citations that already wrap a known title/url label.
  ordered.forEach((source, index) => {
    const label = inlineCitationLabel(source, index).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const year = yearFromFetchedAt(source.fetchedAt).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const patterns = [
      new RegExp(`\\(\\s*${label}\\s*,\\s*(?:n\\.d\\.|\\d{4})\\s*\\)`, 'gi'),
      new RegExp(`\\(\\s*${label}\\s*\\)`, 'gi'),
      year === 'n\\.d\\.' ? null : new RegExp(`\\(\\s*${label}\\s*,\\s*${year}\\s*\\)`, 'gi'),
    ].filter(Boolean) as RegExp[];
    const citation = formatInlineCitation(style, source, index);
    const title = cleanTitle(source.title).replace(/"/g, "'");
    const linked = `[${citation}](${source.url} "${title}")`;
    for (const pattern of patterns) {
      body = body.replace(pattern, linked);
    }
  });

  const refsMd = buildReferencesMarkdown(style, ordered);
  const markdown = `${body.trim()}\n${refsMd}`.trim();
  if (!asHtml) return markdown;

  const bodyHtml = markdownToHtml(body.trim());
  return `${bodyHtml}\n${buildReferencesHtml(style, ordered)}`;
}
