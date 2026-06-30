/** Paid Aiva plan tiers. `team` and `business` are legacy aliases kept for existing subscriptions. */
export type AivaPaidTier = 'starter' | 'growth' | 'team' | 'business';

export const AIVA_CHECKOUT_TIERS = ['starter', 'growth'] as const;
export type AivaCheckoutTier = (typeof AIVA_CHECKOUT_TIERS)[number];

/** Normalize legacy tier ids to canonical plan order keys. */
export function normalizeAivaTier(tier: string): AivaPaidTier | 'trial' {
  if (tier === 'team') return 'growth';
  return tier as AivaPaidTier | 'trial';
}

export function slotLimitForTier(tier: string): number {
  const normalized = normalizeAivaTier(tier);
  if (normalized === 'growth' || normalized === 'team') return 5;
  if (normalized === 'business') return 999;
  if (normalized === 'starter') return 1;
  return 1;
}

export function tierDisplayLabel(tier: string): string {
  const normalized = normalizeAivaTier(tier);
  if (normalized === 'growth') return 'Growth';
  if (normalized === 'starter') return 'Starter';
  if (normalized === 'business') return 'Business';
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

export function isAivaCheckoutTier(tier: string): tier is AivaCheckoutTier {
  return tier === 'starter' || tier === 'growth';
}
