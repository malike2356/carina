import { slotLimitForTier } from './aiva-stripe-checkout.js';

export interface AivaPlanPricing {
  tier: 'starter' | 'team' | 'business';
  label: string;
  slotLimit: number;
  monthlyPriceId: string | null;
  annualPriceId: string | null;
  monthlyAmountPence: number | null;
  annualAmountPence: number | null;
}

const MONTHLY_PENCE: Record<string, number> = {
  starter: 4900,
  team: 9900,
  business: 29900,
};

function envPrice(tier: string, interval: 'month' | 'year'): string | null {
  const key = `STRIPE_PRICE_AIVA_${tier.toUpperCase()}_${interval === 'year' ? 'ANNUAL' : 'MONTHLY'}`;
  return process.env[key]?.trim() || null;
}

export function getAivaPricingPlans(): AivaPlanPricing[] {
  const tiers: Array<'starter' | 'team' | 'business'> = ['starter', 'team', 'business'];
  return tiers.map((tier) => ({
    tier,
    label: tier.charAt(0).toUpperCase() + tier.slice(1),
    slotLimit: slotLimitForTier(tier),
    monthlyPriceId: envPrice(tier, 'month'),
    annualPriceId: envPrice(tier, 'year'),
    monthlyAmountPence: MONTHLY_PENCE[tier] ?? null,
    annualAmountPence: MONTHLY_PENCE[tier] ? MONTHLY_PENCE[tier] * 10 : null,
  }));
}
