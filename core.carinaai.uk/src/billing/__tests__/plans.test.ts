import { describe, expect, it } from 'vitest';
import {
  BILLING_PLANS,
  normalizePlanId,
  isScoutProPlan,
  resolveStripePriceId,
} from '../plans.js';

describe('billing plans', () => {
  it('exposes Monitor and Pro tiers', () => {
    expect(BILLING_PLANS.scout_monitor.monthlyPriceGbp).toBe(79);
    expect(BILLING_PLANS.scout_pro.monthlyPriceGbp).toBe(99);
    expect(BILLING_PLANS.enterprise.monthlyPriceGbp).toBeNull();
  });

  it('maps legacy scout_standard to scout_pro', () => {
    expect(normalizePlanId('scout_standard')).toBe('scout_pro');
  });

  it('classifies pro features correctly', () => {
    expect(isScoutProPlan('scout_monitor')).toBe(false);
    expect(isScoutProPlan('scout_pro')).toBe(true);
    expect(isScoutProPlan('scout_standard')).toBe(true);
    expect(isScoutProPlan('enterprise')).toBe(true);
  });

  it('reads Stripe price IDs from env vars', () => {
    process.env.STRIPE_PRICE_SCOUT_MONITOR = 'price_monitor';
    process.env.STRIPE_PRICE_SCOUT_PRO = 'price_pro';
    expect(resolveStripePriceId('scout_monitor')).toBe('price_monitor');
    expect(resolveStripePriceId('scout_pro')).toBe('price_pro');
  });
});
