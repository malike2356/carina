import { describe, expect, it } from 'vitest';
import { getAivaPricingPlans, type AivaPlanPricing } from './aiva-pricing.js';
import { slotLimitForTier } from './aiva-stripe-checkout.js';
import { gbpToPence } from './platform-pricing-amounts.js';

describe('getAivaPricingPlans', () => {
  it('returns starter, team, and business with slot limits and catalog defaults', () => {
    const plans = getAivaPricingPlans();
    expect(plans.map((plan: AivaPlanPricing) => plan.tier)).toEqual(['starter', 'team', 'business']);
    expect(plans[0]?.monthlyAmountPence).toBe(gbpToPence(49));
    expect(plans[1]?.monthlyAmountPence).toBe(gbpToPence(99));
    expect(plans[2]?.monthlyAmountPence).toBe(gbpToPence(199));
    expect(plans[0]?.slotLimit).toBe(2);
    expect(plans[1]?.slotLimit).toBe(5);
    expect(slotLimitForTier('starter')).toBe(2);
    expect(slotLimitForTier('team')).toBe(5);
  });
});
