import { BILLING_PLANS, type BillingPlanId } from './plans.js';
import { getMonthlyBalance, getModelMixForMonth } from './credit-ledger.js';
import { getAllowedModelClasses } from './credit-gate.js';
import { getRateCardsForClasses } from './rate-card.js';

export interface OpsCreditUsageSummary {
  creditsUsed: number;
  creditsIncluded: number;
  creditsRemaining: number;
  percentUsed: number;
  modelMix: Array<{ modelClass: string; creditsUsed: number; providerCostUsd: number }>;
  warningThreshold: number;
  blocked: boolean;
}

export async function getOpsCreditUsageSummary(
  orgId: string,
  planId: BillingPlanId,
): Promise<OpsCreditUsageSummary | null> {
  const plan = BILLING_PLANS[planId];
  if (plan.includedCredits === null) return null;

  const balance = await getMonthlyBalance(orgId, planId);
  const modelMix = await getModelMixForMonth(orgId);
  const effectiveLimit = plan.includedCredits + balance.topups;

  return {
    creditsUsed: balance.used,
    creditsIncluded: plan.includedCredits,
    creditsRemaining: balance.remaining ?? 0,
    percentUsed: effectiveLimit > 0
      ? Math.round((balance.used / effectiveLimit) * 1000) / 10
      : 0,
    modelMix,
    warningThreshold: 80,
    blocked: (balance.remaining ?? 0) <= 0,
  };
}

export async function getOpsModelMetering(orgId: string, planId: BillingPlanId): Promise<{
  allowedClasses: string[];
  rateCard: Record<string, { inputWeight: number; outputWeight: number; cacheWeight: number }>;
}> {
  const allowedClasses = await getAllowedModelClasses(planId);
  const rateCard = await getRateCardsForClasses(allowedClasses);
  return { allowedClasses, rateCard };
}
