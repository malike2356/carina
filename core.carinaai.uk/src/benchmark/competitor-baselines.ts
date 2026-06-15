import type { CompetitorReference } from './types.js';

/**
 * Published reference points for comparison charts only.
 * These are NOT measured by this harness against live Hermes/OpenClaw installs.
 */
export const COMPETITOR_REFERENCES: CompetitorReference[] = [
  {
    id: 'hermes',
    label: 'Hermes',
    source: 'published_reference',
    sourceNote: 'Public repo and CARINA_VS_THE_WORLD.md estimates; not executed in this benchmark run.',
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
    id: 'openclaw',
    label: 'OpenClaw',
    source: 'published_reference',
    sourceNote: 'Community claims (50+ channels, ClawHub scale); curated kernel features scored separately.',
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
    id: 'odysseus',
    label: 'Odysseus',
    source: 'published_reference',
    sourceNote: 'Odysseus gap analysis (2026-06); self-hosted workspace focus, lighter agent platform depth.',
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
