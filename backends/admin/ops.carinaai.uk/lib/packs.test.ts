import { describe, expect, it } from 'vitest';
import { parseSelectedPacks } from './packs.js';

describe('parseSelectedPacks', () => {
  it('parses checkbox arrays from form posts', () => {
    expect(parseSelectedPacks({ packs: ['finance', 'property-uk'] })).toEqual([
      'finance',
      'property-uk',
    ]);
  });

  it('parses comma-separated strings', () => {
    expect(parseSelectedPacks({ packs: 'finance, property-uk' })).toEqual([
      'finance',
      'property-uk',
    ]);
  });

  it('returns empty list when nothing selected', () => {
    expect(parseSelectedPacks({})).toEqual([]);
  });
});
