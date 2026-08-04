import { describe, expect, it } from 'vitest';
import {
  ASSIGNABLE_PLANS,
  formatTokenLimit,
  normalizePlanId,
  planTier,
} from './billing-plans.js';

describe('billing-plans', () => {
  it('normalizes legacy scout_standard to scout_pro', () => {
    expect(normalizePlanId('scout_standard')).toBe('scout_pro');
  });

  it('maps paid plans to pro tier', () => {
    expect(planTier('scout_monitor')).toBe('pro');
    expect(planTier('free')).toBe('free');
  });

  it('formats token limits for display', () => {
    expect(formatTokenLimit(100_000)).toBe('100K');
    expect(formatTokenLimit(null)).toBe('Unlimited');
  });

  it('includes assignable plans for ops forms', () => {
    expect(ASSIGNABLE_PLANS).toContain('free');
    expect(ASSIGNABLE_PLANS).toContain('scout_pro');
    expect(ASSIGNABLE_PLANS).toContain('carina_ops_starter');
    expect(ASSIGNABLE_PLANS).toContain('carina_ops_team');
  });

  it('normalizes carina ops plan ids', () => {
    expect(normalizePlanId('carina_ops_starter')).toBe('carina_ops_starter');
    expect(normalizePlanId('carina_ops_team')).toBe('carina_ops_team');
  });
});
