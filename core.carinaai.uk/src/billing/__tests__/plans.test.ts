import { describe, expect, it } from 'vitest';
import { BILLING_PLANS, normalizePlanId, resolveStripePriceId } from '../plans.js';

describe('billing plans', () => {
  it('getPlan returns Carina Ops Starter pricing', () => {
    const plan = BILLING_PLANS.carina_ops_starter;
    expect(plan.monthlyPriceGbp).toBe(49);
    expect(plan.tokenLimit).toBe(500_000);
  });

  it('normalizePlanId returns free for unknown ids', () => {
    expect(normalizePlanId('unknown-plan')).toBe('free');
  });

  it('resolveStripePriceId reads Carina Ops env vars', () => {
    process.env.STRIPE_PRICE_CARINA_OPS_TEAM = 'price_team_test';
    expect(resolveStripePriceId('carina_ops_team')).toBe('price_team_test');
  });

  it('getPlan helper returns plan metadata', () => {
    expect(BILLING_PLANS[normalizePlanId('carina_ops_team')].name).toBe('Carina Ops Team');
  });
});
