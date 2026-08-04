/**
 * Convert model markdown into Telegram-friendly text.
 * Prefer HTML parse_mode for final messages; use readable plain while streaming.
 */
import { markdownTablesToBullets } from './markdown-for-channels.js';

const FENCE_TOKEN = '\u0000FENCE';
const CODE_TOKEN = '\u0000CODE';

export type TelegramOutbound = {
  text: string;
  parseMode?: 'HTML';
  /** Plain fallback if HTML parse_mode is rejected by Telegram. */
  plain?: string;
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function collapseBlankLines(text: string): string {
  return text
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Drop tool/progress noise that should never reach the user as final copy. */
export function stripTelegramToolStatus(raw: string): string {
  return raw
    .replace(/^[ \t]*\[using [^\]]+\][ \t]*\n?/gim, '')
    .replace(/\n[ \t]*\[using [^\]]+\][ \t]*(?=\n|$)/gim, '\n')
    .replace(/^[ \t]*\[Called tools:[^\]]*\][ \t]*\n?/gim, '')
    .replace(/\n[ \t]*\[Called tools:[^\]]*\][ \t]*(?=\n|$)/gim, '\n')
    .replace(/^[ \t]*\[Channel note:[^\]]*\][ \t]*\n?/gim, '')
    .replace(/\n[ \t]*\[Channel note:[^\]]*\][ \t]*(?=\n|$)/gim, '\n');
}

/**
 * Restore paragraph air when the model (or stream assembler) left only single newlines
 * between prose blocks.
 */
export function ensureTelegramParagraphSpacing(raw: string): string {
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];

  const isListOrQuote = (line: string) =>
    /^\s*([-*+]|\d+[.)]|[>•])\s+/.test(line) || /^\s*>/.test(line);
  const isTableRow = (line: string) => /^\s*\|.+\|\s*$/.test(line);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const prev = out.length > 0 ? out[out.length - 1]! : null;

    if (line.trim() === '') {
      if (prev !== '') out.push('');
      continue;
    }

    if (
      prev !== null
      && prev !== ''
      && !isListOrQuote(prev)
      && !isListOrQuote(line)
      && !isTableRow(prev)
      && !isTableRow(line)
      && !/^(#{1,6})\s+/.test(line)
    ) {
      // Two prose lines back-to-back: give them a blank line.
      out.push('');
    }

    out.push(line);
  }

  return collapseBlankLines(out.join('\n'));
}

function prepareTelegramSource(raw: string): string {
  const stripped = stripTelegramToolStatus(raw);
  const withTables = markdownTablesToBullets(stripped);
  return ensureTelegramParagraphSpacing(withTables);
}

function protectSegments(
  text: string,
  pattern: RegExp,
  tokenPrefix: string,
  bucket: string[],
): string {
  return text.replace(pattern, (match, ...groups) => {
    const captured = typeof groups[0] === 'string' ? groups[0] : match;
    const idx = bucket.length;
    bucket.push(captured);
    return `${tokenPrefix}${idx}\u0000`;
  });
}

function restoreSegments(
  text: string,
  tokenPrefix: string,
  bucket: string[],
  wrap: (value: string) => string,
): string {
  return text.replace(new RegExp(`${tokenPrefix}(\\d+)\u0000`, 'g'), (_, idx: string) => {
    const value = bucket[Number(idx)] ?? '';
    return wrap(value);
  });
}

/** Structure markdown into scannable plain text (no raw # / ** left behind). */
export function markdownToTelegramReadable(raw: string): string {
  let text = prepareTelegramSource(raw);

  const fences: string[] = [];
  text = protectSegments(text, /```[\w+-]*\n?([\s\S]*?)```/g, FENCE_TOKEN, fences);

  const lines = text.split('\n');
  const out: string[] = [];
  for (const line of lines) {
    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      if (out.length > 0 && out[out.length - 1] !== '') out.push('');
      out.push(heading[2]!.trim());
      out.push('');
      continue;
    }
    const hr = /^(-{3,}|\*{3,}|_{3,})\s*$/.test(line.trim());
    if (hr) {
      if (out.length > 0 && out[out.length - 1] !== '') out.push('');
      continue;
    }
    out.push(
      line
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/__([^_]+)__/g, '$1')
        .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '$1')
        .replace(/(?<!_)_([^_]+)_(?!_)/g, '$1')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)'),
    );
  }

  let joined = out.join('\n');
  joined = restoreSegments(joined, FENCE_TOKEN, fences, (code) => code.trimEnd());
  return collapseBlankLines(joined);
}

/** Convert markdown to Telegram HTML for parse_mode=HTML. */
export function markdownToTelegramHtml(raw: string): string {
  let text = prepareTelegramSource(raw);

  const fences: string[] = [];
  const inlines: string[] = [];
  text = protectSegments(text, /```[\w+-]*\n?([\s\S]*?)```/g, FENCE_TOKEN, fences);
  text = protectSegments(text, /`([^`\n]+)`/g, CODE_TOKEN, inlines);

  const lines = text.split('\n');
  const out: string[] = [];
  for (const line of lines) {
    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      if (out.length > 0 && out[out.length - 1] !== '') out.push('');
      out.push(`<b>${escapeHtml(heading[2]!.trim())}</b>`);
      out.push('');
      continue;
    }
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line.trim())) {
      if (out.length > 0 && out[out.length - 1] !== '') out.push('');
      continue;
    }

    out.push(formatInlineHtml(line));
  }

  let joined = out.join('\n');
  joined = restoreSegments(joined, CODE_TOKEN, inlines, (code) => `<code>${escapeHtml(code)}</code>`);
  joined = restoreSegments(
    joined,
    FENCE_TOKEN,
    fences,
    (code) => `<pre>${escapeHtml(code.replace(/\n$/, ''))}</pre>`,
  );
  return collapseBlankLines(joined);
}

function formatInlineHtml(line: string): string {
  // Tokenize bold/italic/links on the raw line, escaping literal segments.
  const tokens: Array<{ type: 'text' | 'html'; value: string }> = [];
  let rest = line;

  const pushText = (value: string) => {
    if (!value) return;
    tokens.push({ type: 'text', value });
  };

  while (rest.length > 0) {
    const link = /^\[([^\]]+)\]\(([^)\s]+)\)/.exec(rest);
    if (link) {
      tokens.push({
        type: 'html',
        value: `<a href="${escapeHtml(link[2]!)}">${escapeHtml(link[1]!)}</a>`,
      });
      rest = rest.slice(link[0].length);
      continue;
    }
    const bold = /^\*\*([^*]+)\*\*/.exec(rest) || /^__([^_]+)__/.exec(rest);
    if (bold) {
      tokens.push({ type: 'html', value: `<b>${escapeHtml(bold[1]!)}</b>` });
      rest = rest.slice(bold[0].length);
      continue;
    }
    const italic = /^\*([^*]+)\*/.exec(rest) || /^_([^_]+)_/.exec(rest);
    if (italic) {
      tokens.push({ type: 'html', value: `<i>${escapeHtml(italic[1]!)}</i>` });
      rest = rest.slice(italic[0].length);
      continue;
    }
    // Consume until next special marker
    const next = rest.search(/(\*\*|__|\*|_|\[)/);
    if (next === -1) {
      pushText(rest);
      break;
    }
    if (next === 0) {
      pushText(rest[0]!);
      rest = rest.slice(1);
      continue;
    }
    pushText(rest.slice(0, next));
    rest = rest.slice(next);
  }

  return tokens
    .map((token) => (token.type === 'html' ? token.value : escapeHtml(token.value)))
    .join('');
}

export function formatTelegramOutbound(
  raw: string,
  opts: { html?: boolean } = {},
): TelegramOutbound {
  const useHtml = opts.html !== false;
  const plain = markdownToTelegramReadable(raw);
  if (useHtml) {
    return {
      text: markdownToTelegramHtml(raw),
      parseMode: 'HTML',
      plain,
    };
  }
  return { text: plain, plain };
}

/**
 * Keep one Telegram message when possible.
 * Only split when the formatted reply would exceed Telegram's length limit.
 */
export function chunkTelegramOutbound(
  raw: string,
  maxLen = 3800,
): TelegramOutbound[] {
  const prose = prepareTelegramSource(raw);
  if (!prose) return [{ text: ' ', parseMode: 'HTML', plain: ' ' }];

  const full = formatTelegramOutbound(prose, { html: true });
  if (full.text.length <= maxLen) return [full];

  const parts = prose.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
  const groups: string[] = [];
  let buffer = '';
  for (const part of parts) {
    const candidate = buffer ? `${buffer}\n\n${part}` : part;
    if (markdownToTelegramHtml(candidate).length <= maxLen) {
      buffer = candidate;
      continue;
    }
    if (buffer) groups.push(buffer);
    if (markdownToTelegramHtml(part).length <= maxLen) {
      buffer = part;
      continue;
    }
    const readable = markdownToTelegramReadable(part);
    let rest = readable;
    while (rest.length > maxLen) {
      const cutAt = Math.max(rest.lastIndexOf('\n', maxLen), rest.lastIndexOf(' ', maxLen));
      const cut = cutAt > maxLen * 0.5 ? cutAt : maxLen;
      groups.push(rest.slice(0, cut).trimEnd());
      rest = rest.slice(cut).trimStart();
    }
    buffer = rest;
  }
  if (buffer) groups.push(buffer);

  return groups.map((group) => formatTelegramOutbound(group, { html: true }));
}
