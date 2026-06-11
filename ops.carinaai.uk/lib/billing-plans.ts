export type BillingPlanId =
  | 'free'
  | 'scout_monitor'
  | 'scout_pro'
  | 'scout_standard'
  | 'enterprise';

export interface BillingPlan {
  id: BillingPlanId;
  name: string;
  monthlyPriceGbp: number | null;
  tokenLimit: number | null;
  features: string[];
}

export const BILLING_PLANS: Record<BillingPlanId, BillingPlan> = {
  free: {
    id: 'free',
    name: 'Carina Core',
    monthlyPriceGbp: 0,
    tokenLimit: 100_000,
    features: ['Full autonomous agent', '100K tokens/month', 'Daily message cap on free tier'],
  },
  scout_monitor: {
    id: 'scout_monitor',
    name: 'Scout Monitor',
    monthlyPriceGbp: 79,
    tokenLimit: 250_000,
    features: ['Scout visibility', '250K tokens/month', '14-day audit log'],
  },
  scout_pro: {
    id: 'scout_pro',
    name: 'Scout Pro',
    monthlyPriceGbp: 99,
    tokenLimit: 500_000,
    features: ['Kill switch and alerts', '500K tokens/month', '90-day audit log'],
  },
  scout_standard: {
    id: 'scout_standard',
    name: 'Scout Pro (legacy)',
    monthlyPriceGbp: 99,
    tokenLimit: 500_000,
    features: ['Legacy plan id; maps to Scout Pro'],
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    monthlyPriceGbp: null,
    tokenLimit: null,
    features: ['Custom limits', 'SOC2 attestation', 'Dedicated support'],
  },
};

export const ASSIGNABLE_PLANS: BillingPlanId[] = [
  'free',
  'scout_monitor',
  'scout_pro',
  'enterprise',
];

export function normalizePlanId(value: unknown): BillingPlanId {
  if (value === 'scout_monitor' || value === 'scout_pro' || value === 'enterprise') return value;
  if (value === 'scout_standard') return 'scout_pro';
  return 'free';
}

export function planTier(plan: BillingPlanId): 'free' | 'pro' {
  return plan === 'free' ? 'free' : 'pro';
}

export function formatTokenLimit(limit: number | null): string {
  if (limit === null) return 'Unlimited';
  if (limit >= 1_000_000) return `${Math.round(limit / 1_000_000)}M`;
  if (limit >= 1_000) return `${Math.round(limit / 1_000)}K`;
  return String(limit);
}

export function stripeConfigured(): boolean {
  return Boolean(
    process.env.STRIPE_SECRET_KEY
    || process.env.STRIPE_PRICE_SCOUT_MONITOR
    || process.env.STRIPE_PRICE_SCOUT_PRO
    || process.env.STRIPE_PRO_PRICE_ID,
  );
}
