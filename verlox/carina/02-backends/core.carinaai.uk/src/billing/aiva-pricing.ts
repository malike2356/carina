import { slotLimitForTier } from './aiva-stripe-checkout.js';
import type { AivaPaidTier } from './aiva-tier.js';
import { resolveConfigValue } from './billing-config.js';

export interface AivaPlanPricing {
  tier: AivaPaidTier;
  label: string;
  slotLimit: number | null;
  monthlyPriceId: string | null;
  annualPriceId: string | null;
  monthlyAmountPence: number | null;
  annualAmountPence: number | null;
}

const MONTHLY_PENCE: Record<string, number> = {
  starter: 4900,
  team: 9900,
  business: 19900,
};

const ANNUAL_PENCE: Record<string, number> = {
  starter: 49000,
  team: 99000,
  business: 199000,
};

function envPrice(tier: string, interval: 'month' | 'year'): string | null {
  const key = `STRIPE_PRICE_AIVA_${tier.toUpperCase()}_${interval === 'year' ? 'ANNUAL' : 'MONTHLY'}`;
  const value = resolveConfigValue(key);
  if (value) return value;
  if (tier === 'team') {
    const growthKey = `STRIPE_PRICE_AIVA_GROWTH_${interval === 'year' ? 'ANNUAL' : 'MONTHLY'}`;
    return resolveConfigValue(growthKey) || null;
  }
  return null;
}

export function resolveAivaSeatPriceId(): string | null {
  return resolveConfigValue('STRIPE_PRICE_AIVA_SEAT_MONTHLY') || null;
}

export function getAivaPricingPlans(): AivaPlanPricing[] {
  const tiers: AivaPaidTier[] = ['starter', 'team', 'business'];
  return tiers.map((tier) => ({
    tier,
    label: tier === 'business' ? 'Business' : tier === 'team' ? 'Team' : 'Starter',
    slotLimit: slotLimitForTier(tier),
    monthlyPriceId: envPrice(tier, 'month'),
    annualPriceId: envPrice(tier, 'year'),
    monthlyAmountPence: MONTHLY_PENCE[tier] ?? null,
    annualAmountPence: ANNUAL_PENCE[tier] ?? null,
  }));
}

export const loadAivaPricingPlans = getAivaPricingPlans;
