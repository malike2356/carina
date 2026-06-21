import { describe, expect, it } from 'vitest';
import {
  combineMatchScore,
  computeRecencyBoost,
  mergeBestPerLineageRoot,
  mergeBestPerSession,
  paginate,
  pickPrimaryStrategy,
  sortSessionMatches,
  type RawSessionMatch,
} from './session-search-ranking.js';

function row(overrides: Partial<RawSessionMatch> & Pick<RawSessionMatch, 'sessionId'>): RawSessionMatch {
  return {
    messageId: 'm1',
    role: 'user',
    content: 'hello',
    createdAt: new Date('2026-06-01'),
    snippet: 'hello',
    ftsRank: 0,
    prefixRank: 0,
    fuzzyRank: 0,
    semanticRank: 0,
    matchStrategy: 'fallback_ilike',
    ...overrides,
  };
}

describe('session-search-ranking', () => {
  it('boosts newer sessions in recency score', () => {
    const recent = computeRecencyBoost(new Date('2026-06-14'));
    const older = computeRecencyBoost(new Date('2026-01-01'));
    expect(recent).toBeGreaterThan(older);
  });

  it('prefers fts over prefix and fuzzy in combined score', () => {
    const fts = combineMatchScore({ ftsRank: 0.5, prefixRank: 0, fuzzyRank: 0, semanticRank: 0 }, 0);
    const prefix = combineMatchScore({ ftsRank: 0, prefixRank: 0.5, fuzzyRank: 0, semanticRank: 0 }, 0);
    expect(fts).toBeGreaterThan(prefix);
  });

  it('mergeBestPerSession keeps highest scoring row per session', () => {
    const merged = mergeBestPerSession([
      row({ sessionId: 'a', ftsRank: 0.2 }),
      row({ sessionId: 'a', ftsRank: 0.9, messageId: 'm2' }),
      row({ sessionId: 'b', ftsRank: 0.4 }),
    ]);
    expect(merged).toHaveLength(2);
    expect(merged.find((m) => m.sessionId === 'a')?.messageId).toBe('m2');
  });

  it('mergeBestPerLineageRoot keeps best hit per conversation chain', () => {
    const rootOf = (id: string) => (id === 'other' ? 'other' : 'root-1');
    const merged = mergeBestPerLineageRoot([
      row({ sessionId: 'root-1', ftsRank: 0.3 }),
      row({ sessionId: 'child-2', ftsRank: 0.95, messageId: 'best' }),
      row({ sessionId: 'other', ftsRank: 0.5 }),
    ], rootOf);
    expect(merged).toHaveLength(2);
    expect(merged.find((m) => m.sessionId === 'child-2')?.messageId).toBe('best');
  });

  it('sortSessionMatches orders by relevance score by default', () => {
    const sorted = sortSessionMatches([
      row({ sessionId: 'low', ftsRank: 0.1 }),
      row({ sessionId: 'high', ftsRank: 0.9 }),
    ], 'relevance');
    expect(sorted[0]?.sessionId).toBe('high');
  });

  it('sortSessionMatches orders by newest timestamp', () => {
    const sorted = sortSessionMatches([
      row({ sessionId: 'old', createdAt: new Date('2026-01-01') }),
      row({ sessionId: 'new', createdAt: new Date('2026-06-10') }),
    ], 'newest');
    expect(sorted[0]?.sessionId).toBe('new');
  });

  it('paginate returns stable slices', () => {
    const { page, total } = paginate([1, 2, 3, 4, 5], 1, 2);
    expect(total).toBe(5);
    expect(page).toEqual([2, 3]);
  });

  it('pickPrimaryStrategy reflects strongest signal', () => {
    expect(pickPrimaryStrategy({
      ftsRank: 0.2,
      prefixRank: 0,
      fuzzyRank: 0,
      semanticRank: 0,
      matchStrategy: 'fallback_ilike',
    })).toBe('fts');
  });
});
