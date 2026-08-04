import { marked } from 'marked';

marked.setOptions({
  gfm: true,
  breaks: true,
});

export function looksLikeHtml(value: string): boolean {
  const trimmed = value.trim();
  return /^<(?:p|h[1-6]|div|ul|ol|table|blockquote|pre|img|span|a|br|hr)\b/i.test(trimmed);
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

/** Turn stored HTML back into plain text while keeping paragraph breaks. */
export function htmlToPlainText(html: string, options?: { keepHeadingMarkers?: boolean }): string {
  const keepHeadingMarkers = options?.keepHeadingMarkers !== false;
  let out = html
    .replace(/\r\n?/g, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|tr|blockquote|pre)>/gi, '\n')
    .replace(/<\/(ul|ol|table)>/gi, '\n\n')
    .replace(/<li[^>]*>/gi, '- ');
  if (keepHeadingMarkers) {
    out = out
      .replace(/<(h1)[^>]*>/gi, '# ')
      .replace(/<(h2)[^>]*>/gi, '## ')
      .replace(/<(h3)[^>]*>/gi, '### ')
      .replace(/<(h4)[^>]*>/gi, '#### ');
  }
  return decodeEntities(
    out
      .replace(/<[^>]+>/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim(),
  );
}

/**
 * Detect HTML that still contains literal markdown markers
 * (from the first Documents migration that escaped markdown instead of parsing it).
 */
export function htmlContainsLiteralMarkdown(html: string): boolean {
  const text = htmlToPlainText(html, { keepHeadingMarkers: false });
  if (!text) return false;
  return (
    /^#{1,6}\s+\S/m.test(text)
    || /^\*\*[^*\n]+\*\*/m.test(text)
    || /__[^_\n]+__/m.test(text)
    || /^---+$/m.test(text)
    || /^\*\s+\S/m.test(text)
    || /^[-*+]\s+\*\*[^*\n]+\*\*/m.test(text)
    || /\[[^\]]+\]\([^)]+\)/.test(text)
  );
}

/**
 * Research citation reformats sometimes nest markdown links:
 * `[[(label)](url "t")](url "t")`. Unwrap to a single link before marked.
 */
export function unwrapNestedMarkdownLinks(markdown: string): string {
  let out = markdown ?? '';
  // Repeat until stable; each pass peels one nesting level.
  for (let i = 0; i < 6; i += 1) {
    const next = out.replace(
      /\[\[([^\]]*)\]\((https?:\/\/[^)\s]+)(?:\s+"[^"]*")?\)\]\((https?:\/\/[^)\s]+)(?:\s+"[^"]*")?\)/g,
      (_full, label: string, innerUrl: string) => `[${label}](${innerUrl})`,
    );
    if (next === out) break;
    out = next;
  }
  return out;
}

/**
 * True when TipTap/assist collapsed a structured report into giant paragraphs
 * with no real headings (common after stripHtml + plain-text replace).
 */
export function looksLikeCollapsedDocumentWall(html: string): boolean {
  const trimmed = (html ?? '').trim();
  if (!trimmed || !looksLikeHtml(trimmed)) return false;
  const headings = (trimmed.match(/<h[1-6]\b/gi) ?? []).length;
  if (headings > 0) return false;
  const plain = htmlToPlainText(trimmed);
  if (plain.length < 400) return false;
  const paragraphs = (trimmed.match(/<p\b/gi) ?? []).length;
  const hasReportCue = /\b(Executive Summary|Abstract|References|Bibliography)\b/i.test(plain);
  const hasNumberedSections = /(?:^|\n)\s*-?\s*\d+\.\s+[A-Z]/.test(plain)
    || /(?:^|[.!?]\s+)\d+\.\s+[A-Z][^.!?\n]{12,120}/.test(plain);
  if (paragraphs <= 4 && plain.length > 1500) return true;
  if (hasReportCue && !/^#{1,3}\s/m.test(plain)) return true;
  if (hasNumberedSections && plain.length > 1500) return true;
  return false;
}

/**
 * Best-effort restore of research-style section headings from a collapsed wall.
 * Used when HTML lost h1/h2 but still has recognizable section labels.
 */
export function restoreResearchHeadingsFromPlain(text: string): string {
  let body = (text ?? '').replace(/\r\n?/g, '\n').trim();
  if (!body) return '';

  // If already markdown-structured, keep it.
  if (/^#{1,3}\s+\S/m.test(body)) return body;

  // Flatten list markers that used to be numbered headings.
  body = body.replace(/(?:^|\n)\s*-\s+(\d+)\.\s+/g, '\n\n$1. ');

  // Split glued "Title Executive Summary ..." into markdown.
  body = body.replace(
    /^(.+?)(?=\s+(?:Executive Summary|Abstract)\b)/i,
    (title) => `# ${title.trim()}\n\n`,
  );
  body = body.replace(
    /\s+(Executive Summary|Abstract)\b\s+/gi,
    '\n\n## $1\n\n',
  );
  // Numbered sections glued inside a paragraph: "projections. 1. Current Deployed Count ... Estimating"
  body = body.replace(
    /(?:^|[.!?]\s+|\n\s*)(\d+)\.\s+([A-Z][^.\n]{8,140}?)(?=\s+[A-Z((]|\s*$)/g,
    '\n\n## $1. $2\n\n',
  );
  body = body.replace(
    /\s+((?:References|Bibliography|Works Cited|Sources))\b\s+/gi,
    '\n\n## $1\n\n',
  );

  body = body.replace(/\n{3,}/g, '\n\n').trim();
  if (!/^#\s/m.test(body)) {
    const firstBreak = body.indexOf('\n\n');
    if (firstBreak > 0 && firstBreak < 180) {
      body = `# ${body.slice(0, firstBreak).trim()}\n\n${body.slice(firstBreak + 2).trim()}`;
    }
  }
  return body;
}

export function markdownToHtml(markdown: string): string {
  const cleaned = unwrapNestedMarkdownLinks(markdown ?? '');
  const raw = marked.parse(cleaned, { async: false });
  const html = typeof raw === 'string' ? raw.trim() : '';
  return html || '<p></p>';
}

/**
 * Normalize document content for the HTML TipTap editor:
 * real HTML stays HTML; markdown (or escaped-markdown HTML) becomes rendered HTML.
 * Collapsed text-walls from assist/stripHtml are rebuilt into headed sections when possible.
 */
export function normalizeDocumentHtml(value: string): string {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return '<p></p>';

  if (looksLikeHtml(trimmed)) {
    if (htmlContainsLiteralMarkdown(trimmed)) {
      return markdownToHtml(htmlToPlainText(trimmed));
    }
    if (looksLikeCollapsedDocumentWall(trimmed)) {
      return markdownToHtml(restoreResearchHeadingsFromPlain(htmlToPlainText(trimmed)));
    }
    return trimmed;
  }

  return markdownToHtml(trimmed);
}
