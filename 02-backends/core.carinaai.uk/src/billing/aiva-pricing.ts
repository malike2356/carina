import { slotLimitForTier } from './aiva-stripe-checkout.js';
import type { AivaPaidTier } from './aiva-tier.js';
import { resolveConfigValue } from './billing-config.js';

export interface AivaPlanPricing {
  tier: AivaPaidTier;
  label: string;
  slotLimit: number;
  monthlyPriceId: string | null;
  annualPriceId: string | null;
  monthlyAmountPence: number | null;
  annualAmountPence: number | null;
}

const MONTHLY_PENCE: Record<string, number> = {
  starter: 14900,
  growth: 34900,
};

const ANNUAL_PENCE: Record<string, number> = {
  starter: 149000,
  growth: 349000,
};

function envPrice(tier: string, interval: 'month' | 'year'): string | null {
  const key = `STRIPE_PRICE_AIVA_${tier.toUpperCase()}_${interval === 'year' ? 'ANNUAL' : 'MONTHLY'}`;
  const value = resolveConfigValue(key);
  if (value) return value;
  if (tier === 'growth') {
    const teamKey = `STRIPE_PRICE_AIVA_TEAM_${interval === 'year' ? 'ANNUAL' : 'MONTHLY'}`;
    return resolveConfigValue(teamKey) || null;
  }
  return null;
}

export function resolveAivaSeatPriceId(): string | null {
  return resolveConfigValue('STRIPE_PRICE_AIVA_SEAT_MONTHLY') || null;
}

export function getAivaPricingPlans(): AivaPlanPricing[] {
  const tiers: AivaPaidTier[] = ['starter', 'growth'];
  return tiers.map((tier) => ({
    tier,
    label: tier === 'growth' ? 'Growth' : 'Starter',
    slotLimit: slotLimitForTier(tier),
    monthlyPriceId: envPrice(tier, 'month'),
    annualPriceId: envPrice(tier, 'year'),
    monthlyAmountPence: MONTHLY_PENCE[tier] ?? null,
    annualAmountPence: ANNUAL_PENCE[tier] ?? null,
  }));
}
