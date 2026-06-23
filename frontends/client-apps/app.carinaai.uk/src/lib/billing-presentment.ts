import type { WorkspacePlan } from '@/db/schema';
import { PLAN_LIMITS } from '@/lib/plans';
import { workspacePlanLabel } from '@/lib/white-label-plans';

export interface BrandedPlanOption {
  id: WorkspacePlan;
  name: string;
  priceAmount: string;
  pricePeriod?: string;
  description: string;
  active: boolean;
}

export function buildBrandedPlanOptions(input: {
  currentPlan: WorkspacePlan;
  productName?: string | null;
}): BrandedPlanOption[] {
  const productName = input.productName?.trim() || null;
  const plans: WorkspacePlan[] = ['free', 'starter', 'team'];
  return plans.map((plan) => {
    const meta = PLAN_LIMITS[plan];
    const priceAmount = meta.priceGbp == null ? 'Custom' : `GBP ${meta.priceGbp}`;
    const description = plan === 'free'
      ? '50k tokens per day, BYOK only, 1 user.'
      : plan === 'starter'
        ? '500k tokens per month, BYOK, no Scout.'
        : 'Unlimited tokens, BYOK, optional Scout pairing.';
    return {
      id: plan,
      name: workspacePlanLabel(plan, productName),
      priceAmount,
      pricePeriod: meta.priceGbp == null ? undefined : plan === 'free' ? undefined : 'per month',
      description,
      active: input.currentPlan === plan,
    };
  });
}
