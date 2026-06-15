export type SessionSearchSort = 'relevance' | 'newest' | 'oldest';

export type SessionMatchStrategy = 'fts' | 'prefix' | 'fuzzy' | 'semantic' | 'fallback_ilike';

export interface RawSessionMatch {
  sessionId: string;
  messageId: string;
  role: string;
  content: string;
  createdAt: Date;
  snippet: string;
  ftsRank: number;
  prefixRank: number;
  fuzzyRank: number;
  semanticRank: number;
  matchStrategy: SessionMatchStrategy;
}

const MS_PER_DAY = 86_400_000;

export function computeRecencyBoost(createdAt: Date, now = new Date()): number {
  const ageDays = Math.max(0, (now.getTime() - createdAt.getTime()) / MS_PER_DAY);
  return Math.exp(-ageDays / 30);
}

export function combineMatchScore(match: Pick<RawSessionMatch, 'ftsRank' | 'prefixRank' | 'fuzzyRank' | 'semanticRank'>, recency: number): number {
  return (
    match.ftsRank * 1.0
    + match.prefixRank * 0.35
    + match.fuzzyRank * 0.25
    + match.semanticRank * 0.5
    + recency * 0.15
  );
}

export function pickPrimaryStrategy(match: Pick<RawSessionMatch, 'ftsRank' | 'prefixRank' | 'fuzzyRank' | 'semanticRank' | 'matchStrategy'>): SessionMatchStrategy {
  if (match.ftsRank > 0) return 'fts';
  if (match.semanticRank > 0) return 'semantic';
  if (match.prefixRank > 0) return 'prefix';
  if (match.fuzzyRank > 0) return 'fuzzy';
  return match.matchStrategy;
}

export function mergeBestPerSession(rows: RawSessionMatch[]): RawSessionMatch[] {
  const best = new Map<string, RawSessionMatch>();
  for (const row of rows) {
    const score = combineMatchScore(row, computeRecencyBoost(row.createdAt));
    const prior = best.get(row.sessionId);
    if (!prior) {
      best.set(row.sessionId, row);
      continue;
    }
    const priorScore = combineMatchScore(prior, computeRecencyBoost(prior.createdAt));
    if (score > priorScore) best.set(row.sessionId, row);
  }
  return [...best.values()];
}

/** Collapse continuation chains so search returns one hit per conversation lineage. */
export function mergeBestPerLineageRoot(
  rows: RawSessionMatch[],
  rootOf: (sessionId: string) => string,
): RawSessionMatch[] {
  const best = new Map<string, RawSessionMatch>();
  for (const row of rows) {
    const key = rootOf(row.sessionId);
    const score = combineMatchScore(row, computeRecencyBoost(row.createdAt));
    const prior = best.get(key);
    if (!prior) {
      best.set(key, row);
      continue;
    }
    const priorScore = combineMatchScore(prior, computeRecencyBoost(prior.createdAt));
    if (score > priorScore) best.set(key, row);
  }
  return [...best.values()];
}

export function sortSessionMatches(
  rows: RawSessionMatch[],
  sort: SessionSearchSort,
  now = new Date(),
): RawSessionMatch[] {
  const scored = rows.map((row) => ({
    row,
    score: combineMatchScore(row, computeRecencyBoost(row.createdAt, now)),
  }));
  if (sort === 'newest') {
    return scored.sort((a, b) => b.row.createdAt.getTime() - a.row.createdAt.getTime()).map((s) => s.row);
  }
  if (sort === 'oldest') {
    return scored.sort((a, b) => a.row.createdAt.getTime() - b.row.createdAt.getTime()).map((s) => s.row);
  }
  return scored.sort((a, b) => b.score - a.score).map((s) => s.row);
}

export function paginate<T>(items: T[], offset: number, limit: number): { page: T[]; total: number } {
  const safeOffset = Math.max(0, offset);
  const safeLimit = Math.max(1, limit);
  return {
    total: items.length,
    page: items.slice(safeOffset, safeOffset + safeLimit),
  };
}

export function escapeIlikePattern(input: string): string {
  return input.replace(/[%_\\]/g, '\\$&');
}
