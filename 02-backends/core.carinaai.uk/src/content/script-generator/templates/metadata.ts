import type { ChannelNicheDefinition } from '../niches.js';
import type { StructuredScript } from './script-structure.js';

const MAX_TITLE_LENGTH = 100;

export function buildTitle(input: {
  niche: ChannelNicheDefinition;
  location: string;
  theme: string;
  primaryKeyword: string;
  dayIndex: number;
}): string {
  const variants = [
    `${input.theme}: ${input.primaryKeyword} in ${input.location}`,
    `${input.primaryKeyword} guide: ${input.theme.toLowerCase()} in ${input.location}`,
    `${input.location} ${input.niche.label.toLowerCase()}: ${input.theme.toLowerCase()}`,
  ];
  const title = variants[input.dayIndex % variants.length]!;
  if (title.length <= MAX_TITLE_LENGTH) return title;
  return `${title.slice(0, MAX_TITLE_LENGTH - 1).trimEnd()}\u2026`;
}

function timestampLine(script: StructuredScript): string[] {
  let elapsed = 0;
  return script.sections.map((section) => {
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    const stamp = `${minutes}:${String(seconds).padStart(2, '0')}`;
    elapsed += section.approxSeconds;
    const label = section.label === 'hook' ? 'Intro' : section.label === 'body' ? 'Main points' : 'Next steps';
    return `${stamp} ${label}`;
  });
}

export function buildDescription(input: {
  niche: ChannelNicheDefinition;
  location: string;
  theme: string;
  primaryKeyword: string;
  script: StructuredScript;
  tags: string[];
}): string {
  const { niche, location, theme, primaryKeyword, script, tags } = input;
  const focusWord = niche.domainId === 'property' ? 'in' : 'for';

  const paragraphs = [
    `${theme} ${focusWord} ${location}: a practical look at ${primaryKeyword} for ${niche.label.toLowerCase()}.`,
    `This video covers what ${primaryKeyword} means for ${location} right now, the steps to act on it, and the risks worth weighing before you commit. ` +
      `We break down ${niche.description.toLowerCase()} with clear context so you can apply it to your own plans in ${location} and beyond.`,
    `Topics covered: ${tags.slice(0, 6).join(', ')}.`,
    `Timestamps:`,
    ...timestampLine(script),
    `Subscribe for a new ${niche.label.toLowerCase()} video every day, focused on ${location}.`,
  ];

  let description = paragraphs.join('\n');
  while (description.split(/\s+/).filter(Boolean).length < 200) {
    description += `\n\nThis channel publishes daily content on ${niche.label.toLowerCase()}, ` +
      `combining practical steps and real examples so you can make informed decisions about ${primaryKeyword} ` +
      `without wading through jargon. Nothing here is professional advice; always do independent research or speak to a qualified adviser when needed.`;
  }
  return description;
}
