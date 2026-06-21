import { pool } from '../memory/db.js';
import { BILLING_PLANS, type BillingPlanId, resolveCreditUsdRate } from './plans.js';
import { getMonthlyBalance } from './credit-ledger.js';
import { impliedGrossMargin, MARGIN_FLOOR } from './margin-report.js';
import type { ModelClass } from './rate-card.js';

export interface CreditGateResult {
  allowed: boolean;
  reason?: string;
  remainingCredits: number;
  modelClassAllowed: boolean;
  impliedMargin?: number | null;
}

export interface CreditGateOptions {
  managedInference?: boolean;
  estimatedProviderCostUsd?: number;
}

export async function getAllowedModelClasses(planId: BillingPlanId): Promise<ModelClass[]> {
  const result = await pool.query<{ model_class: string }>(
    'SELECT model_class FROM ops_plan_model_classes WHERE plan_id = $1 ORDER BY model_class',
    [planId],
  );
  return result.rows.map((row) => row.model_class as ModelClass);
}

export async function isModelClassAllowedOnPlan(
  planId: BillingPlanId,
  modelClass: ModelClass,
): Promise<boolean> {
  const result = await pool.query(
    'SELECT 1 FROM ops_plan_model_classes WHERE plan_id = $1 AND model_class = $2 LIMIT 1',
    [planId, modelClass],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function checkCreditGate(
  orgId: string,
  planId: BillingPlanId,
  modelClass: ModelClass,
  estimatedCredits: number,
  options?: CreditGateOptions,
): Promise<CreditGateResult> {
  const plan = BILLING_PLANS[planId];

  if (plan.includedCredits === null) {
    return {
      allowed: true,
      remainingCredits: Number.POSITIVE_INFINITY,
      modelClassAllowed: true,
    };
  }

  const modelClassAllowed = await isModelClassAllowedOnPlan(planId, modelClass);
  if (!modelClassAllowed) {
    return {
      allowed: false,
      reason: 'model class not available on your plan',
      remainingCredits: 0,
      modelClassAllowed: false,
    };
  }

  const balance = await getMonthlyBalance(orgId, planId);
  const remainingCredits = balance.remaining ?? 0;
  const hardCap = plan.includedCredits + (plan.maxTopupCredits ?? 0);

  if (balance.used >= hardCap) {
    return {
      allowed: false,
      reason: 'monthly credit hard cap reached. Contact support to raise your limit.',
      remainingCredits,
      modelClassAllowed: true,
    };
  }

  if (remainingCredits <= 0) {
    return {
      allowed: false,
      reason: 'monthly credit allowance exhausted. Top up or upgrade.',
      remainingCredits,
      modelClassAllowed: true,
    };
  }

  if (options?.managedInference && options.estimatedProviderCostUsd != null) {
    const creditUsdRate = resolveCreditUsdRate(planId);
    if (creditUsdRate > 0) {
      const revenueUsd = estimatedCredits * creditUsdRate;
      const margin = impliedGrossMargin(revenueUsd, options.estimatedProviderCostUsd);
      if (margin !== null && margin < MARGIN_FLOOR) {
        return {
          allowed: false,
          reason: 'call would fall below minimum gross margin threshold',
          remainingCredits,
          modelClassAllowed: true,
          impliedMargin: margin,
        };
      }
    }
  }

  if (estimatedCredits > remainingCredits) {
    return {
      allowed: true,
      reason: 'warning: this call may exhaust remaining credits',
      remainingCredits,
      modelClassAllowed: true,
    };
  }

  return {
    allowed: true,
    remainingCredits,
    modelClassAllowed: true,
  };
}
