import { getNiche } from '../../../../content/script-generator/niches.js';
import type { PropertyChannelRun } from '../types.js';

export interface NicheResearchOutput extends Record<string, unknown> {
  researchMode: 'heuristic' | 'live';
  monthlyThemes: string[];
  themeMap12Months: Array<{ monthIndex: number; theme: string; rationale: string }>;
  highPerformingFormats: string[];
  competitorNotes: string[];
  sources: Array<{ label: string; kind: 'heuristic' | 'live'; note: string }>;
}

const HIGH_PERFORMING_FORMATS = [
  'Numbered list videos (e.g. "5 signs this is worth your attention")',
  'Before/after case studies with real numbers',
  'Data breakdown videos referencing current figures',
  'Myth-busting videos correcting common misconceptions',
  'Walkthrough style videos with a running narration',
];

async function tryLiveYouTubeSignals(query: string): Promise<{
  ok: boolean;
  notes: string[];
}> {
  if (process.env.PROPERTY_CHANNEL_LIVE_RESEARCH !== 'true') {
    return { ok: false, notes: [] };
  }
  const key = process.env.YOUTUBE_DATA_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim();
  if (!key) return { ok: false, notes: [] };
  try {
    const url = new URL('https://www.googleapis.com/youtube/v3/search');
    url.searchParams.set('part', 'snippet');
    url.searchParams.set('type', 'video');
    url.searchParams.set('maxResults', '5');
    url.searchParams.set('q', query);
    url.searchParams.set('key', key);
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(8_000) });
    if (!res.ok) return { ok: false, notes: [] };
    const body = await res.json() as {
      items?: Array<{ snippet?: { title?: string; channelTitle?: string } }>;
    };
    const notes = (body.items ?? [])
      .map((item) => {
        const title = item.snippet?.title?.trim();
        const channel = item.snippet?.channelTitle?.trim();
        if (!title) return null;
        return `Live search hit: "${title}"${channel ? ` (${channel})` : ''} [source: youtube.search]`;
      })
      .filter((n): n is string => Boolean(n));
    return { ok: notes.length > 0, notes };
  } catch {
    return { ok: false, notes: [] };
  }
}

/**
 * Niche research with an explicit 12-month theme map. Default mode is
 * heuristic (labelled). When PROPERTY_CHANNEL_LIVE_RESEARCH=true and a YouTube
 * Data API key is present, live search titles are appended as sourced notes
 * (never presented as competitor metrics without a source tag).
 */
export async function runNicheResearch(run: PropertyChannelRun): Promise<NicheResearchOutput> {
  const niche = getNiche(run.input.niche);
  const focusKind = niche.domainId === 'property' ? 'location' : 'audience focus';
  const monthlyThemes = niche.weeklyThemes;
  const themeMap12Months = Array.from({ length: 12 }, (_, monthIndex) => {
    const theme = monthlyThemes[monthIndex % monthlyThemes.length]!;
    return {
      monthIndex,
      theme,
      rationale:
        `Month ${monthIndex + 1} leans on "${theme}" so the calendar rotates niche angles for ${run.input.location}.`,
    };
  });

  const live = await tryLiveYouTubeSignals(`${niche.label} ${run.input.location}`);
  const researchMode: 'heuristic' | 'live' = live.ok ? 'live' : 'heuristic';

  const competitorNotes = [
    `Top ${niche.label.toLowerCase()} channels publish consistently (daily or near-daily) rather than in bursts. [source: heuristic]`,
    `Thumbnails favour bold, high-contrast text over a single clear visual. [source: heuristic]`,
    `Titles that name a ${focusKind} (${run.input.location}) alongside a concrete number outperform vague titles. [source: heuristic]`,
    ...live.notes,
  ];

  return {
    researchMode,
    monthlyThemes,
    themeMap12Months,
    highPerformingFormats: HIGH_PERFORMING_FORMATS,
    competitorNotes,
    sources: [
      {
        label: 'curated-niche-themes',
        kind: 'heuristic',
        note: 'Themes come from the niche catalogue, not live charts.',
      },
      ...(live.ok
        ? [{ label: 'youtube-search', kind: 'live' as const, note: 'Titles only; not view or competitor metric claims.' }]
        : [{ label: 'youtube-search', kind: 'heuristic' as const, note: 'Live research disabled or unavailable.' }]),
    ],
  };
}
