import { config } from '../config/index.js';
import type { BudgetStatus } from './cost-tracker.js';
import { checkMonthlyBudget, estimateCost } from './cost-tracker.js';
import { getResolvedBudgetConfig } from '../config/runtime-config.js';
import type { ModelClass } from '../billing/rate-card.js';
import {
  getModelMetadata,
  isExpensiveModelTier,
  formatModelMetadataLine,
  type ModelMetadata,
} from './model-metadata.js';

export type PreflightDecision = 'allow' | 'warn' | 'block';

export type PreflightResult = {
  decision: PreflightDecision;
  estimateUsd: number;
  tier: ModelClass;
  message?: string;
};

const DEFAULT_TURN_TOKEN_ESTIMATE = 6_000;

function turnWarnUsd(): number {
  return getResolvedBudgetConfig().turnWarnUsd;
}

export function estimateTurnCostUsd(
  provider: string,
  model: string,
  tokenEstimate = DEFAULT_TURN_TOKEN_ESTIMATE,
): number {
  const meta = getModelMetadata(provider, model);
  const blended = estimateCost(provider, tokenEstimate);
  const metadataEstimate = meta.usdPerToken * tokenEstimate;
  return Math.max(blended, metadataEstimate);
}

export function preflightProviderChoice(
  provider: string,
  model: string,
  budget: BudgetStatus,
  tokenEstimate = DEFAULT_TURN_TOKEN_ESTIMATE,
): PreflightResult {
  const meta = getModelMetadata(provider, model);
  const estimateUsd = estimateTurnCostUsd(provider, model, tokenEstimate);

  if (budget.status === 'blocked') {
    return {
      decision: 'block',
      estimateUsd,
      tier: meta.tier,
      message: budget.message,
    };
  }

  const expensiveModel = isExpensiveModelTier(meta.tier);
  const expensiveTurn = estimateUsd >= turnWarnUsd();
  const budgetTight = budget.status === 'warn';
  const blockExpensive = getResolvedBudgetConfig().blockExpensiveOnWarn && budgetTight && expensiveModel;

  if (blockExpensive) {
    return {
      decision: 'block',
      estimateUsd,
      tier: meta.tier,
      message: `Expensive model blocked while monthly budget is in warning state. ${budget.message ?? 'Choose a cheaper model or raise the budget.'}`,
    };
  }

  if (expensiveModel || expensiveTurn || budgetTight) {
    const parts: string[] = [];
    if (expensiveModel) {
      parts.push(`model tier is ${meta.tier}`);
    }
    if (expensiveTurn) {
      parts.push(`estimated turn cost is about $${estimateUsd.toFixed(4)}`);
    }
    if (budgetTight && budget.message) {
      parts.push(budget.message);
    }
    return {
      decision: 'warn',
      estimateUsd,
      tier: meta.tier,
      message: `Cost preflight: ${parts.join('; ')}. Prefer a cheaper model or smaller tool payloads when possible.`,
    };
  }

  return { decision: 'allow', estimateUsd, tier: meta.tier };
}

export async function preflightProviderChoiceAsync(
  provider: string,
  model: string,
  tokenEstimate = DEFAULT_TURN_TOKEN_ESTIMATE,
): Promise<PreflightResult> {
  const budget = await checkMonthlyBudget();
  return preflightProviderChoice(provider, model, budget, tokenEstimate);
}

export function formatBudgetVisibility(budget: BudgetStatus): string | null {
  if (!budget.budgetLimit || budget.budgetLimit <= 0) return null;
  const remaining = Math.max(0, budget.budgetLimit - budget.totalCost);
  const pct = Math.min(100, Math.round((budget.totalCost / budget.budgetLimit) * 100));
  const status = budget.status === 'blocked' ? 'BLOCKED' : budget.status === 'warn' ? 'WARN' : 'OK';
  const warnAt = getResolvedBudgetConfig().warnAtPercent;
  return `LLM budget (${status}): $${budget.totalCost.toFixed(2)} used of $${budget.budgetLimit.toFixed(2)} (${pct}%, warn at ${warnAt}%), about $${remaining.toFixed(2)} remaining this month.`;
}

export function buildProviderCostContext(
  provider: string,
  model: string,
  budget: BudgetStatus,
): string | null {
  const meta = getModelMetadata(provider, model);
  const budgetLine = formatBudgetVisibility(budget);
  const lines = [
    'Provider cost context:',
    formatModelMetadataLine(meta),
  ];
  if (budgetLine) lines.push(budgetLine);
  if (config.carina.llmMonthlyBudgetUsd) {
    lines.push('Expensive tiers (premium/frontier) should be used only when the task needs deep reasoning.');
  }
  return lines.join('\n');
}

export function buildPreflightWarning(result: PreflightResult, meta?: ModelMetadata): string | null {
  if (result.decision !== 'warn' || !result.message) return null;
  const modelLine = meta ? formatModelMetadataLine(meta) : '';
  return modelLine ? `${result.message}\n${modelLine}` : result.message;
}
