import type { CompetitorReference } from './types.js';

/**
 * Anonymized baselines from three reference agent platforms.
 * Competitor A: YAML/MD skill format, Electron desktop, Ink TUI
 * Competitor B: Native mobile sensors, Kotlin/Swift, background services
 * Competitor C: Entity anchors, window system, dark-themed UI
 *
 * These are NOT measured by this harness against live external agent installs.
 */
export const COMPETITOR_REFERENCES: CompetitorReference[] = [
  {
    id: 'competitor-a',
    label: 'Competitor A',
    source: 'published_reference',
    sourceNote: 'General-purpose agent platform (YAML/MD skills, Electron desktop, Ink TUI). Public repo estimates; not executed in this benchmark run.',
    asOf: '2026-03',
    dimensions: {
      tools: 99,
      skills: 115,
      channels: 20,
      memory: 70,
      routing: 85,
      sessions: 90,
      cron: 75,
      learning: 95,
      security: 40,
      marketplace: 10,
    },
  },
  {
    id: 'competitor-b',
    label: 'Competitor B',
    source: 'published_reference',
    sourceNote: 'Native-first agent platform (Kotlin/Swift mobile, sensor integration). Community claims (50+ channels, hub scale); curated kernel features scored separately.',
    asOf: '2026-03',
    dimensions: {
      tools: 85,
      skills: 60,
      channels: 95,
      memory: 65,
      routing: 70,
      sessions: 75,
      cron: 70,
      learning: 50,
      security: 15,
      marketplace: 80,
    },
  },
  {
    id: 'competitor-c',
    label: 'Competitor C',
    source: 'published_reference',
    sourceNote: 'UI-focused agent workspace (entity anchors, window system, dark theme). Gap analysis (2026-06); self-hosted workspace focus, lighter agent platform depth.',
    asOf: '2026-06',
    dimensions: {
      tools: 55,
      skills: 40,
      channels: 35,
      memory: 60,
      routing: 65,
      sessions: 70,
      cron: 45,
      learning: 35,
      security: 20,
      marketplace: 25,
    },
  },
];

export function referenceScoreForCategory(
  competitorId: string,
  category: keyof CompetitorReference['dimensions'],
): number | null {
  const row = COMPETITOR_REFERENCES.find((c) => c.id === competitorId);
  if (!row) return null;
  const value = row.dimensions[category];
  return value == null ? null : value;
}
