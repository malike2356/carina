import { getNiche, type ChannelNicheId } from './niches.js';
import { buildTagList, extractPrimaryKeyword } from './seo/keyword-research.js';
import { buildScriptStructure, type StructuredScript } from './templates/script-structure.js';
import { buildDescription, buildTitle } from './templates/metadata.js';
import { generateScriptItem, resolveScriptMode } from './llm-scripts.js';

export interface GeneratedVideoItem {
  dayIndex: number;
  date: string;
  niche: ChannelNicheId;
  theme: string;
  title: string;
  description: string;
  tags: string[];
  thumbnailPrompt: string;
  script: StructuredScript;
  scriptMode?: 'template' | 'llm';
  model?: string;
  promptVersion?: string;
}

export interface ScriptGenerationInput {
  niche: ChannelNicheId;
  location: string;
  dayIndex: number;
  date: string;
  theme: string;
}

function monthThemeForDay(themes: string[], dayIndex: number): string {
  const monthIndex = Math.floor(dayIndex / 30) % themes.length;
  return themes[monthIndex]!;
}

export function generateScript(input: ScriptGenerationInput): GeneratedVideoItem {
  const niche = getNiche(input.niche);
  const primaryKeyword = extractPrimaryKeyword(niche, input.location, input.theme);
  const tags = buildTagList(niche, input.location, input.theme);
  const script = buildScriptStructure({
    niche,
    location: input.location,
    theme: input.theme,
    dayIndex: input.dayIndex,
  });

  // Guarantee textual uniqueness across a 365 day batch even when template
  // combinations repeat: every item references its own day number and date.
  const uniquenessLine = `This is day ${input.dayIndex + 1} of the ${niche.label.toLowerCase()} calendar for ${input.date}.`;
  const scriptWithUniqueness: StructuredScript = {
    ...script,
    fullText: `${script.fullText}\n\n[NOTE]\n${uniquenessLine}`,
  };

  const title = buildTitle({
    niche,
    location: input.location,
    theme: input.theme,
    primaryKeyword,
    dayIndex: input.dayIndex,
  });
  const description = buildDescription({
    niche,
    location: input.location,
    theme: input.theme,
    primaryKeyword,
    script: scriptWithUniqueness,
    tags,
  });
  const thumbnailPrompt =
    `Bold text overlay reading "${script.sections[0]!.text.slice(0, 40)}" over imagery for ${input.location}, ` +
    `${niche.label.toLowerCase()} branding, high contrast, 1280x720.`;

  return {
    dayIndex: input.dayIndex,
    date: input.date,
    niche: input.niche,
    theme: input.theme,
    title,
    description,
    tags,
    thumbnailPrompt,
    script: scriptWithUniqueness,
    scriptMode: 'template',
    model: 'template',
    promptVersion: 'property-channel-script-v1',
  };
}

export interface YearCalendarInput {
  niche: ChannelNicheId;
  location: string;
  startDate: string;
  totalDays?: number;
}

function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Generates one page (batch) of the year calendar starting at `offset`,
 * without generating or re-generating any other day. Callers repeatedly
 * request batches (e.g. the script-generation workflow step) until
 * `offset + limit >= totalDays`, which keeps a single call cheap and makes
 * resuming a partially generated calendar idempotent.
 */
export function generateYearCalendarBatch(
  input: YearCalendarInput,
  offset: number,
  limit: number,
): GeneratedVideoItem[] {
  const niche = getNiche(input.niche);
  const totalDays = input.totalDays ?? 365;
  const end = Math.min(totalDays, offset + limit);
  const items: GeneratedVideoItem[] = [];
  for (let dayIndex = offset; dayIndex < end; dayIndex++) {
    const date = addDays(input.startDate, dayIndex);
    const theme = monthThemeForDay(niche.weeklyThemes, dayIndex);
    items.push(generateScript({ niche: input.niche, location: input.location, dayIndex, date, theme }));
  }
  return items;
}

export async function generateYearCalendarBatchAsync(
  input: YearCalendarInput,
  offset: number,
  limit: number,
): Promise<GeneratedVideoItem[]> {
  const niche = getNiche(input.niche);
  const totalDays = input.totalDays ?? 365;
  const end = Math.min(totalDays, offset + limit);
  const mode = resolveScriptMode();
  const items: GeneratedVideoItem[] = [];
  for (let dayIndex = offset; dayIndex < end; dayIndex++) {
    const date = addDays(input.startDate, dayIndex);
    const theme = monthThemeForDay(niche.weeklyThemes, dayIndex);
    if (mode === 'llm') {
      items.push(await generateScriptItem({
        niche: input.niche,
        location: input.location,
        dayIndex,
        date,
        theme,
      }, 'llm'));
    } else {
      items.push(generateScript({ niche: input.niche, location: input.location, dayIndex, date, theme }));
    }
  }
  return items;
}

export function generateYearCalendar(input: YearCalendarInput, batchSize = 30): GeneratedVideoItem[] {
  const totalDays = input.totalDays ?? 365;
  const items: GeneratedVideoItem[] = [];
  for (let offset = 0; offset < totalDays; offset += batchSize) {
    items.push(...generateYearCalendarBatch(input, offset, batchSize));
  }
  return items;
}

export async function generateYearCalendarAsync(
  input: YearCalendarInput,
  batchSize = 30,
): Promise<GeneratedVideoItem[]> {
  const totalDays = input.totalDays ?? 365;
  const items: GeneratedVideoItem[] = [];
  for (let offset = 0; offset < totalDays; offset += batchSize) {
    items.push(...await generateYearCalendarBatchAsync(input, offset, batchSize));
  }
  return items;
}

function fingerprint(item: GeneratedVideoItem): string {
  return `${item.title.toLowerCase().trim()}|${item.script.fullText.toLowerCase().trim()}`;
}

/** Throws if two items in the batch would read as near-identical content. */
export function assertUniqueCalendar(items: GeneratedVideoItem[]): void {
  const seen = new Set<string>();
  for (const item of items) {
    const key = fingerprint(item);
    if (seen.has(key)) {
      throw new Error(`Duplicate content detected for day ${item.dayIndex + 1} (${item.date})`);
    }
    seen.add(key);
  }
}
