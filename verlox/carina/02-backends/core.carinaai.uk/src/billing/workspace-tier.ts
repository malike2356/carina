/** Paid Aiva plan tiers. `growth` is a legacy alias for `team`. */
export type AivaPaidTier = 'starter' | 'growth' | 'team' | 'business';

export const AIVA_CHECKOUT_TIERS = ['starter', 'team', 'business'] as const;
export type AivaCheckoutTier = (typeof AIVA_CHECKOUT_TIERS)[number];

/** Stored in aiva_subscriptions.aiva_slot_limit (NOT NULL) to represent unlimited. */
export const UNLIMITED_SLOT_DB_VALUE = 999;

/** Normalize legacy tier ids to canonical plan order keys. */
export function normalizeAivaTier(tier: string): AivaPaidTier | 'trial' {
  if (tier === 'growth') return 'team';
  return tier as AivaPaidTier | 'trial';
}

export function slotLimitForTier(tier: string): number | null {
  const normalized = normalizeAivaTier(tier);
  if (normalized === 'business') return null;
  if (normalized === 'team') return 5;
  if (normalized === 'starter') return 2;
  return 1;
}

/** Slot limit as persisted in the database, where unlimited is a sentinel value. */
export function slotLimitDbValue(tier: string): number {
  return slotLimitForTier(tier) ?? UNLIMITED_SLOT_DB_VALUE;
}

export function isAivaBusinessTier(tier: string): boolean {
  return normalizeAivaTier(tier) === 'business';
}

export function tierAllowsCustomDomain(tier: string): boolean {
  return normalizeAivaTier(tier) === 'business';
}

export function tierAllowsUnlimitedChannels(tier: string): boolean {
  return normalizeAivaTier(tier) === 'business';
}

export function tierDisplayLabel(tier: string): string {
  const normalized = normalizeAivaTier(tier);
  if (normalized === 'team') return 'Team';
  if (normalized === 'starter') return 'Starter';
  if (normalized === 'business') return 'Business';
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

export function isAivaCheckoutTier(tier: string): tier is AivaCheckoutTier {
  return (AIVA_CHECKOUT_TIERS as readonly string[]).includes(tier);
}
