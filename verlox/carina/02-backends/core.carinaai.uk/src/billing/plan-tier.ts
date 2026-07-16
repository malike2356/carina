const PLAN_ORDER: Record<string, number> = {
  trial: 0,
  starter: 1,
  growth: 2,
  team: 2,
  business: 3,
};

/** Active Aiva trials include Team-tier features (automations, analytics, etc.). */
export function effectivePlanTier(planTier: string, subscriptionStatus?: string): string {
  if (planTier === 'trial' && subscriptionStatus === 'trialing') {
    return 'growth';
  }
  return planTier;
}

export function hasPlanTier(current: string, required: 'team' | 'business'): boolean {
  return (PLAN_ORDER[current] ?? 0) >= (PLAN_ORDER[required] ?? 0);
}

export function isBusinessPlan(planTier: string): boolean {
  return hasPlanTier(planTier, 'business');
}

export function isTeamPlan(planTier: string): boolean {
  return hasPlanTier(planTier, 'team');
}
