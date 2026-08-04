import { slotLimitForTier } from './aiva-stripe-checkout.js';
import type { AivaPaidTier } from './aiva-tier.js';
import type { AivaBillingDisplayTier } from './platform-pricing-amounts.js';
import { resolveConfigValue } from './billing-config.js';
import {
  annualTotalPenceFromMonthly,
  gbpToPence,
  loadAivaMonthlyGbpFromPlatform,
} from './platform-pricing-amounts.js';

export interface AivaPlanPricing {
  tier: AivaPaidTier;
  label: string;
  slotLimit: number | null;
  monthlyPriceId: string | null;
  annualPriceId: string | null;
  monthlyAmountPence: number | null;
  annualAmountPence: number | null;
}

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

export async function getAivaPricingPlans(): Promise<AivaPlanPricing[]> {
  const tiers: AivaPaidTier[] = ['starter', 'team', 'business'];
  const monthlyGbp = await loadAivaMonthlyGbpFromPlatform();
  return tiers.map((tier) => {
    const tierKey: AivaBillingDisplayTier =
      tier === 'business' ? 'business' : tier === 'team' ? 'team' : 'starter';
    return {
      tier,
      label: tier === 'business' ? 'Business' : tier === 'team' ? 'Team' : 'Starter',
      slotLimit: slotLimitForTier(tier),
      monthlyPriceId: envPrice(tier, 'month'),
      annualPriceId: envPrice(tier, 'year'),
      monthlyAmountPence: gbpToPence(monthlyGbp[tierKey]),
      annualAmountPence: annualTotalPenceFromMonthly(gbpToPence(monthlyGbp[tierKey])),
    };
  });
}

/** Special client rates (not shown on public billing marketing). */
export async function getAivaSpecialPricingPlans(): Promise<AivaPlanPricing[]> {
  return [
    {
      tier: 'prompt_rate',
      label: 'Prompt Rate',
      slotLimit: slotLimitForTier('prompt_rate'),
      monthlyPriceId: envPrice('prompt_rate', 'month'),
      annualPriceId: null,
      monthlyAmountPence: null,
      annualAmountPence: null,
    },
  ];
}

export const loadAivaPricingPlans = getAivaPricingPlans;
