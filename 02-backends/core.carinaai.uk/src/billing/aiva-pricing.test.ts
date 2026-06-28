import { describe, expect, it } from 'vitest';
import { getAivaPricingPlans, type AivaPlanPricing } from './aiva-pricing.js';
import { slotLimitForTier } from './aiva-stripe-checkout.js';

describe('getAivaPricingPlans', () => {
  it('returns starter, team, and business tiers with slot limits', () => {
    const plans = getAivaPricingPlans();
    expect(plans.map((plan: AivaPlanPricing) => plan.tier)).toEqual(['starter', 'team', 'business']);
    expect(plans[0]?.slotLimit).toBe(slotLimitForTier('starter'));
    expect(plans[1]?.slotLimit).toBe(5);
    expect(plans[2]?.slotLimit).toBe(999);
  });
});
