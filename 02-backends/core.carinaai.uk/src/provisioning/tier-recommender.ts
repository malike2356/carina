import type { AivaPaidTier } from '../billing/aiva-tier.js';
import { normalizeAivaTier, slotLimitForTier, tierDisplayLabel } from '../billing/aiva-tier.js';

export type MarketplaceDomain =
  | 'property_management'
  | 'customer_support'
  | 'sales_outreach'
  | 'finance_admin'
  | 'calendar_management';

export type RoleComplexity = 'simple' | 'moderate' | 'complex';

export function complexityFromToolCount(toolCount: number): RoleComplexity {
  if (toolCount <= 2) return 'simple';
  if (toolCount <= 5) return 'moderate';
  return 'complex';
}

/**
 * Maps role complexity and domain to existing Aiva paid tiers.
 * Domain overrides match the provisioning wizard (Prompt 37).
 */
export function recommendTier(complexity: RoleComplexity | string, domain: string): AivaPaidTier {
  if (domain === 'finance_admin') return 'business';
  if (domain === 'property_management' && complexity === 'simple') return 'growth';

  if (complexity === 'complex') return 'business';
  if (complexity === 'moderate') return 'growth';
  return 'starter';
}

export function tierRank(tier: string): number {
  const normalized = normalizeAivaTier(tier);
  if (normalized === 'trial') return 0;
  if (normalized === 'starter') return 1;
  if (normalized === 'growth' || normalized === 'team') return 2;
  if (normalized === 'business') return 3;
  return 0;
}

export function meetsRecommendedTier(currentTier: string, recommendedTier: AivaPaidTier): boolean {
  return tierRank(currentTier) >= tierRank(recommendedTier);
}

export function getTierDisplayInfo(tier: AivaPaidTier): {
  label: string;
  slotLimit: number | null;
} {
  return {
    label: tierDisplayLabel(tier),
    slotLimit: slotLimitForTier(tier),
  };
}
