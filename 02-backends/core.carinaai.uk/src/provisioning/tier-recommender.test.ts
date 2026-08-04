import { describe, expect, it } from 'vitest';
import {
  complexityFromToolCount,
  recommendTier,
  tierRank,
} from './tier-recommender.js';

describe('tier-recommender', () => {
  it('maps simple roles to starter', () => {
    expect(recommendTier('simple', 'customer_support')).toBe('starter');
  });

  it('maps finance admin to business', () => {
    expect(recommendTier('simple', 'finance_admin')).toBe('business');
  });

  it('maps property simple to growth minimum', () => {
    expect(recommendTier('simple', 'property_management')).toBe('growth');
  });

  it('derives complexity from tool count', () => {
    expect(complexityFromToolCount(2)).toBe('simple');
    expect(complexityFromToolCount(4)).toBe('moderate');
    expect(complexityFromToolCount(7)).toBe('complex');
  });

  it('orders tiers for upgrade checks', () => {
    expect(tierRank('trial')).toBeLessThan(tierRank('starter'));
    expect(tierRank('business')).toBeGreaterThan(tierRank('growth'));
  });
});
