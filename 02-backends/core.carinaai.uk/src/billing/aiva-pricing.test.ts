import { describe, expect, it } from 'vitest';
import { getAivaPricingPlans, type AivaPlanPricing } from './aiva-pricing.js';
import { slotLimitForTier } from './aiva-stripe-checkout.js';

describe('getAivaPricingPlans', () => {
  it('returns starter and growth tiers with slot limits', () => {
    const plans = getAivaPricingPlans();
    expect(plans.map((plan: AivaPlanPricing) => plan.tier)).toEqual(['starter', 'growth']);
    expect(plans[0]?.slotLimit).toBe(1);
    expect(plans[1]?.slotLimit).toBe(5);
    expect(slotLimitForTier('starter')).toBe(1);
    expect(slotLimitForTier('growth')).toBe(5);
  });
});
