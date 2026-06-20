import { estimateCost } from '../brain/cost-tracker.js';
import { estimateTokensFromText } from '../hosted/ai-platform-models.js';
import { BILLING_PLANS, type BillingPlanId } from './plans.js';
import { checkCreditGate, getAllowedModelClasses, isModelClassAllowedOnPlan } from './credit-gate.js';
import { getMonthlyBalance, getModelMixForMonth } from './credit-ledger.js';
import {
  classifyModel,
  estimateCreditsForCall,
  getCurrentRateCard,
  getRateCardsForClasses,
} from './rate-card.js';

export const DEFAULT_WORKBENCH_OUTPUT_TOKEN_ESTIMATE = 1000;

export interface WorkbenchUsageEstimate {
  modelClass: string;
  allowed: boolean;
  gateReason?: string;
  estimatedCredits: number;
  estimatedProviderCostUsd: number;
  remainingCredits: number | null;
  percentUsed: number | null;
  byok: boolean;
  inferenceMode?: 'byok' | 'managed';
}

export function billingPlanIdFromOrgPlan(orgPlan: string): BillingPlanId {
  if (orgPlan === 'carina_ops_starter' || orgPlan === 'carina_ops_team') {
    return orgPlan;
  }
  if (orgPlan === 'enterprise') {
    return 'enterprise';
  }

  return 'free';
}

export async function estimateWorkbenchUsage(input: {
  orgId: string;
  planId: BillingPlanId;
  provider: string;
  model: string;
  prompt: string;
  estimatedOutputTokens?: number;
  byok?: boolean;
}): Promise<WorkbenchUsageEstimate> {
  const modelClass = classifyModel(input.model);
  const byok = input.byok ?? true;
  const allowedOnPlan = await isModelClassAllowedOnPlan(input.planId, modelClass);

  if (!allowedOnPlan) {
    return {
      modelClass,
      allowed: false,
      gateReason: 'model class not available on your plan',
      estimatedCredits: 0,
      estimatedProviderCostUsd: 0,
      remainingCredits: 0,
      percentUsed: null,
      byok,
    };
  }

  const rateCard = await getCurrentRateCard(modelClass);
  const prompt = input.prompt.trim();
  const tokensIn = prompt === '' ? 0 : estimateTokensFromText(prompt);
  const tokensOut = input.estimatedOutputTokens ?? DEFAULT_WORKBENCH_OUTPUT_TOKEN_ESTIMATE;
  const estimatedCredits = estimateCreditsForCall(rateCard, tokensIn, tokensOut);
  const estimatedProviderCostUsd = estimateCost(input.provider, tokensIn + tokensOut);

  const plan = BILLING_PLANS[input.planId];
  if (plan.includedCredits === null) {
    return {
      modelClass,
      allowed: true,
      estimatedCredits,
      estimatedProviderCostUsd,
      remainingCredits: null,
      percentUsed: null,
      byok,
    };
  }

  const balance = await getMonthlyBalance(input.orgId, input.planId);
  const effectiveLimit = plan.includedCredits + balance.topups;
  const remainingCredits = balance.remaining ?? 0;
  const percentUsed = effectiveLimit > 0
    ? Math.round((balance.used / effectiveLimit) * 1000) / 10
    : 0;

  if (!byok) {
    const gate = await checkCreditGate(input.orgId, input.planId, modelClass, estimatedCredits, {
      managedInference: true,
      estimatedProviderCostUsd,
    });
    if (!gate.allowed) {
      return {
        modelClass,
        allowed: false,
        gateReason: gate.reason,
        estimatedCredits,
        estimatedProviderCostUsd,
        remainingCredits: gate.remainingCredits,
        percentUsed,
        byok: false,
      };
    }

    return {
      modelClass,
      allowed: true,
      gateReason: gate.reason,
      estimatedCredits,
      estimatedProviderCostUsd,
      remainingCredits: gate.remainingCredits,
      percentUsed,
      byok: false,
    };
  }

  return {
    modelClass,
    allowed: true,
    estimatedCredits,
    estimatedProviderCostUsd,
    remainingCredits,
    percentUsed,
    byok: true,
  };
}

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
