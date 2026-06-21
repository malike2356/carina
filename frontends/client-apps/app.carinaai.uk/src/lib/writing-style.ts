/**
 * Enforce Carina prose rules on outbound text: no em/en dashes, no emojis.
 * Mirrors core.carinaai.uk/src/security/writing-style.ts for cloud BYOK streams.
 */

const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F600}-\u{1F64F}\uFE0F\u200D]+/gu;

const EMOJI_LABELS: Record<string, string> = {
  '\u2705': 'Done',
  '\u274C': 'Failed',
  '\u26A0\uFE0F': 'WARNING',
  '\u26A0': 'WARNING',
  '\u2139\uFE0F': 'Note',
  '\u2139': 'Note',
};

function stripEmojis(text: string): string {
  return text.replace(EMOJI_RE, (value) => {
    const label = EMOJI_LABELS[value];
    if (label === undefined) return '';
    return label ? `${label}: ` : '';
  });
}

function replaceDashes(text: string): string {
  return text.replace(/\u2014/g, ';').replace(/\u2013/g, '-');
}

export function sanitizeCarinaProse(text: string): string {
  let out = replaceDashes(text);
  out = stripEmojis(out);
  out = out.replace(/ {2,}/g, ' ');
  return out;
}
