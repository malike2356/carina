const PLAN_ORDER: Record<string, number> = {
  trial: 0,
  starter: 1,
  growth: 2,
  team: 2,
  business: 3,
};

/** Active Aiva trials include Team-tier features (automations, analytics, etc.). */
export function effectiveAivaPlanTier(planTier: string, subscriptionStatus?: string): string {
  if (planTier === 'trial' && subscriptionStatus === 'trialing') {
    return 'growth';
  }
  return planTier;
}

export function hasAivaPlanTier(current: string, required: 'team' | 'business'): boolean {
  return (PLAN_ORDER[current] ?? 0) >= (PLAN_ORDER[required] ?? 0);
}

export function resolveAivaFeaturePlanTier(input: {
  planTier?: string | null;
  subscriptionStatus?: string | null;
  featurePlanTier?: string | null;
}): string {
  if (input.featurePlanTier) return input.featurePlanTier;
  const tier = input.planTier ?? 'trial';
  return effectiveAivaPlanTier(tier, input.subscriptionStatus ?? undefined);
}
