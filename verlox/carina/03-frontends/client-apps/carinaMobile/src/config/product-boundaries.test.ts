import { describe, expect, it } from 'vitest';
import {
  assertPackAllowedOnMobile,
  DEFAULT_AGENT_MODE,
  filterMarketplacePacks,
  isPackAllowedOnMobile,
} from './product-boundaries';

describe('product-boundaries', () => {
  it('defaults to general agent mode', () => {
    expect(DEFAULT_AGENT_MODE).toBe('general');
  });

  it('blocks property-uk on mobile', () => {
    expect(isPackAllowedOnMobile('property-uk')).toBe(false);
  });

  it('allows other marketplace packs', () => {
    expect(isPackAllowedOnMobile('legal-uk')).toBe(true);
  });

  it('filters proprietary packs from marketplace lists', () => {
    expect(filterMarketplacePacks(['general', 'property-uk', 'research'])).toEqual([
      'general',
      'research',
    ]);
  });

  it('blocks property-uk at install boundary', () => {
    expect(() => assertPackAllowedOnMobile('property-uk')).toThrow(
      'not available on Carina mobile',
    );
    expect(() => assertPackAllowedOnMobile('research')).not.toThrow();
  });
});
