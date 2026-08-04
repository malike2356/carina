import { describe, expect, it, vi } from 'vitest';
import {
  getAivaPricingPlans,
  getAivaSpecialPricingPlans,
  type AivaPlanPricing,
} from './aiva-pricing.js';
import { slotLimitForTier } from './aiva-stripe-checkout.js';

vi.mock('./platform-pricing-amounts.js', () => ({
  loadAivaMonthlyGbpFromPlatform: vi.fn(async () => ({
    starter: 69,
    team: 99,
    business: 199,
  })),
  gbpToPence: (gbp: number | null) => (gbp === null ? null : Math.round(gbp * 100)),
  annualTotalPenceFromMonthly: (monthlyPence: number | null) =>
    monthlyPence === null ? null : Math.round(monthlyPence * 12 * 0.8),
}));

describe('getAivaPricingPlans', () => {
  it('returns starter, team, and business with slot limits and ops pricing', async () => {
    const plans = await getAivaPricingPlans();
    expect(plans.map((plan: AivaPlanPricing) => plan.tier)).toEqual(['starter', 'team', 'business']);
    expect(plans[0]?.monthlyAmountPence).toBe(6900);
    expect(plans[1]?.monthlyAmountPence).toBe(9900);
    expect(plans[2]?.monthlyAmountPence).toBe(19900);
    expect(plans[0]?.slotLimit).toBe(1);
    expect(plans[1]?.slotLimit).toBe(5);
    expect(slotLimitForTier('starter')).toBe(1);
    expect(slotLimitForTier('team')).toBe(5);
  });

  it('keeps Prompt Rate off public marketing list', async () => {
    const publicTiers = (await getAivaPricingPlans()).map((p) => p.tier);
    expect(publicTiers).not.toContain('prompt_rate');
    const special = await getAivaSpecialPricingPlans();
    expect(special[0]?.tier).toBe('prompt_rate');
    expect(special[0]?.monthlyAmountPence).toBeNull();
    expect(special[0]?.slotLimit).toBe(2);
  });
});
