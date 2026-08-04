/**
 * Citation formatting for deep research reports.
 * Styles: APA 7, MLA 9, Chicago notes-bibliography, Harvard.
 */

export type CitationStyleId = 'apa7' | 'mla9' | 'chicago' | 'harvard';

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
  id: string;
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

/** Short label used inside parentheticals / footnotes. */
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

export function formatReferenceEntry(
  style: CitationStyleId,
  source: CitationSource,
  index: number,
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
      return `${index + 1}. "${title}." ${site}. Accessed ${accessed}. ${source.url}.`;
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

export function citationStylePromptBlock(style: CitationStyleId): string {
  const label = citationStyleLabel(style);
  return [
    `Citation style: ${label}.`,
    'Use parenthetical or footnote-style inline citations that match the style.',
    'Do not dump raw citation ID lists under each section.',
    'Do not use em dashes (U+2014), en dashes (U+2013), or emojis anywhere in the report.',
    'Prefer commas, colons, parentheses, or hyphenated ranges instead of dashes.',
    'Format as a university research paper in Markdown:',
    '- One # title',
    '- ## Abstract',
    '- ## Introduction',
    '- Additional ## body sections with ### subheadings where useful',
    '- Use bullet lists and numbered lists where appropriate',
    '- Use **bold** and *italic* sparingly for emphasis',
    '- ## Conclusion',
    `- End with ## ${referencesHeading(style)} only if asked; the system will append the formatted list`,
  ].join('\n');
}
