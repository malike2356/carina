/**
 * Enforce Carina prose rules on outbound text: no em/en dashes, no emojis.
 * Mirrors verlox/scripts/fix-writing-style.py for runtime agent output.
 */

const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F600}-\u{1F64F}\uFE0F\u200D]+/gu;

const EMOJI_LABELS: Record<string, string> = {
  '\u2705': 'Done',
  '\u274C': 'Failed',
  '\u26A0\uFE0F': 'WARNING',
  '\u26A0': 'WARNING',
  '\u2139\uFE0F': 'Note',
  '\u2139': 'Note',
  '\u2728': '',
  '\u{1F41B}': 'BUG',
  '\u{1F525}': '',
  '\u2B50': '',
};

function stripEmojis(text: string): string {
  return text.replace(EMOJI_RE, (value) => {
    const label = EMOJI_LABELS[value];
    if (label === undefined) return '';
    return label ? `${label}: ` : '';
  });
}

function replaceDashes(text: string): string {
  return text
    .replace(/\u2014/g, ';')
    .replace(/\u2013/g, '-');
}

export function sanitizeCarinaProse(
  text: string,
  options?: { preserveWhitespace?: boolean },
): string {
  let out = replaceDashes(text);
  out = stripEmojis(out);
  out = out.replace(/[ \t]+;/g, ';');
  out = out.replace(/;{2,}/g, ';');
  out = out.replace(/; +/g, '; ');
  if (!options?.preserveWhitespace) {
    out = out.replace(/ {2,}/g, ' ');
  }
  return out;
}
