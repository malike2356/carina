import type { PropertyNicheDefinition } from '../niches.js';

export interface RankedKeyword {
  keyword: string;
  score: number;
}

/**
 * Deterministic keyword ranking over the niche keyword bank plus the
 * location and weekly theme in play. There is no live search-volume API
 * wired in this slice (see docs/features/property-channel-youtube-setup.md
 * gaps); ranking instead favours specificity (location-qualified terms) and
 * theme relevance, which is a reasonable proxy until a real keyword volume
 * source is connected.
 */
export function rankKeywords(
  niche: PropertyNicheDefinition,
  location: string,
  theme: string,
): RankedKeyword[] {
  const themeWords = theme.toLowerCase().split(/\s+/).filter(Boolean);
  const scored = niche.keywords.map((keyword) => {
    let score = 50;
    const lower = keyword.toLowerCase();
    if (themeWords.some((word) => lower.includes(word))) score += 25;
    score += Math.min(15, keyword.split(' ').length * 3);
    return { keyword, score };
  });

  const locationQualified = niche.keywords.slice(0, 4).map((keyword, index) => ({
    keyword: `${keyword} ${location}`.trim(),
    score: 70 - index * 5,
  }));

  return [...locationQualified, ...scored].sort((a, b) => b.score - a.score);
}

export function extractPrimaryKeyword(
  niche: PropertyNicheDefinition,
  location: string,
  theme: string,
): string {
  const ranked = rankKeywords(niche, location, theme);
  return ranked[0]?.keyword ?? niche.keywords[0] ?? niche.label;
}

export function buildTagList(
  niche: PropertyNicheDefinition,
  location: string,
  theme: string,
  count = 15,
): string[] {
  const ranked = rankKeywords(niche, location, theme).map((r) => r.keyword);
  const fillers = [
    niche.label,
    location,
    theme,
    `${niche.label} tips`,
    `${niche.label} guide`,
    `${location} ${niche.label}`,
    'explainers',
    'how to',
    'beginners',
    'playbook',
    'case study',
    'daily tips',
  ];
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const tag of [...ranked, ...fillers]) {
    const normalized = tag.trim();
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(normalized);
    if (tags.length >= count) break;
  }
  return tags;
}
