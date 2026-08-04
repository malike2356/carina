import { describe, expect, it } from 'vitest';
import { jaccardSimilarity } from './store.js';

describe('jaccardSimilarity', () => {
  it('returns 1 for identical keyword sets', () => {
    expect(jaccardSimilarity(['yield', 'roi'], ['yield', 'roi'])).toBe(1);
  });

  it('returns 0 for disjoint sets', () => {
    expect(jaccardSimilarity(['yield'], ['hmo'])).toBe(0);
  });

  it('is case-insensitive', () => {
    expect(jaccardSimilarity(['BRR'], ['brr'])).toBe(1);
  });
});
