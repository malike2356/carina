import type { BillingPlanId } from './plans.js';

/** Customer-facing commercial packaging for white-label resellers. */
export type WhiteLabelCommercialTier = 'starter' | 'agency' | 'enterprise';

export interface WhiteLabelCommercialPlan {
  tier: WhiteLabelCommercialTier;
  /** Internal platform label; not shown to end customers by default. */
  platformLabel: string;
  /** Default customer-facing label before brand override. */
  customerLabel: string;
  monthlyPriceGbp: number | null;
  maxClientWorkspaces: number;
  includesPartnerConsole: boolean;
  includesCustomDomains: boolean;
  includesUsageExports: boolean;
  mapsToBillingPlan: BillingPlanId;
  mapsToWorkspacePlan: 'free' | 'starter' | 'team';
  features: string[];
}

export const WHITE_LABEL_COMMERCIAL_PLANS: Record<WhiteLabelCommercialTier, WhiteLabelCommercialPlan> = {
  starter: {
    tier: 'starter',
    platformLabel: 'White-label Starter',
    customerLabel: 'Starter',
    monthlyPriceGbp: 99,
    maxClientWorkspaces: 5,
    includesPartnerConsole: true,
    includesCustomDomains: false,
    includesUsageExports: false,
    mapsToBillingPlan: 'carina_ops_starter',
    mapsToWorkspacePlan: 'starter',
    features: [
      'Up to 5 client workspaces',
      'Branded workspace shell',
      'Per-workspace usage reporting',
      'Stripe checkout for client upgrades',
    ],
  },
  agency: {
    tier: 'agency',
    platformLabel: 'White-label Agency',
    customerLabel: 'Agency',
    monthlyPriceGbp: 299,
    maxClientWorkspaces: 25,
    includesPartnerConsole: true,
    includesCustomDomains: true,
    includesUsageExports: true,
    mapsToBillingPlan: 'carina_ops_team',
    mapsToWorkspacePlan: 'team',
    features: [
      'Up to 25 client workspaces',
      'Custom domains and sender identity',
      'Partner usage allocation dashboard',
      'Client workspace provisioning',
    ],
  },
  enterprise: {
    tier: 'enterprise',
    platformLabel: 'White-label Enterprise',
    customerLabel: 'Enterprise',
    monthlyPriceGbp: null,
    maxClientWorkspaces: 500,
    includesPartnerConsole: true,
    includesCustomDomains: true,
    includesUsageExports: true,
    mapsToBillingPlan: 'enterprise',
    mapsToWorkspacePlan: 'team',
    features: [
      'High-volume client workspace pool',
      'Dedicated partner support',
      'Enterprise kernel support alignment',
      'Contract billing separate from client workspaces',
    ],
  },
};

export function normalizeWhiteLabelTier(value: unknown): WhiteLabelCommercialTier {
  if (value === 'agency' || value === 'enterprise') return value;
  return 'starter';
}

export function brandedPlanLabel(
  tier: WhiteLabelCommercialTier,
  productName?: string | null,
): string {
  const base = WHITE_LABEL_COMMERCIAL_PLANS[tier].customerLabel;
  if (!productName?.trim()) return base;
  return `${productName.trim()} ${base}`;
}

export function workspacePlanLabel(
  plan: 'free' | 'starter' | 'team',
  productName?: string | null,
): string {
  const labels: Record<'free' | 'starter' | 'team', string> = {
    free: 'Free',
    starter: 'Starter',
    team: 'Team',
  };
  const base = labels[plan];
  if (!productName?.trim()) return base;
  return `${productName.trim()} ${base}`;
}

export function commercialTierForWorkspacePlan(plan: 'free' | 'starter' | 'team'): WhiteLabelCommercialTier {
  if (plan === 'team') return 'agency';
  if (plan === 'starter') return 'starter';
  return 'starter';
}

export function commercialTierForBillingPlan(plan: BillingPlanId): WhiteLabelCommercialTier {
  if (plan === 'enterprise') return 'enterprise';
  if (plan === 'carina_ops_team') return 'agency';
  return 'starter';
}
