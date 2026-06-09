import { describe, expect, it } from 'vitest';
import { BILLING_PLANS, resolveStripePriceId } from '../plans.js';

describe('billing plans', () => {
  it('matches the public pricing tiers', () => {
    expect(BILLING_PLANS.free.monthlyPriceGbp).toBe(0);
    expect(BILLING_PLANS.scout_standard.monthlyPriceGbp).toBe(79);
    expect(BILLING_PLANS.enterprise.monthlyPriceGbp).toBeNull();
  });

  it('reads Stripe price IDs from env vars only', () => {
    process.env.STRIPE_PRICE_SCOUT_STANDARD = 'price_test';
    expect(resolveStripePriceId('scout_standard')).toBe('price_test');
  });
});
