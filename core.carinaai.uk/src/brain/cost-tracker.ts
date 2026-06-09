import { config } from '../config/index.js';
import { pool } from '../memory/db.js';
import { buildUsdPerTokenMap } from './provider-registry.js';

type UsageRow = {
  provider: string;
  model: string;
  tokens_used: string | number;
  estimated_cost: string | number;
};

export type BudgetStatus =
  | { status: 'ok'; totalCost: number; budgetLimit: number | null; message?: string }
  | { status: 'warn'; totalCost: number; budgetLimit: number; message: string }
  | { status: 'blocked'; totalCost: number; budgetLimit: number; message: string };

export interface UsageBreakdown {
  provider: string;
  model: string;
  tokensUsed: number;
  estimatedCost: number;
}

export interface CostReport {
  month: string;
  totalTokens: number;
  totalCost: number;
  breakdown: UsageBreakdown[];
  budget: BudgetStatus;
}

// Estimated blended USD-per-token rates. These are intentionally env-overridable
// because provider list prices drift and token direction is collapsed upstream.
const DEFAULT_USD_PER_TOKEN: Record<string, number> = buildUsdPerTokenMap();

export function estimateCost(provider: string, tokensUsed: number): number {
  const envKey = `CARINA_LLM_${provider.toUpperCase()}_USD_PER_TOKEN`;
  const rate = Number(process.env[envKey] ?? DEFAULT_USD_PER_TOKEN[provider] ?? 0);
  return roundCost(tokensUsed * rate);
}

export async function recordUsage(
  sessionId: string,
  provider: string,
  tokensUsed: number,
  model = '',
): Promise<void> {
  if (tokensUsed <= 0) return;
  await pool.query(
    `INSERT INTO model_usage (session_id, provider, model, tokens_used, estimated_cost)
     VALUES ($1, $2, $3, $4, $5)`,
    [sessionId, provider, model, tokensUsed, estimateCost(provider, tokensUsed)],
  );
}

export async function getSessionCost(sessionId: string): Promise<CostReport> {
  const rows = await aggregateUsage('WHERE session_id = $1', [sessionId]);
  return buildReport(currentMonth(), rows);
}

export async function getMonthlyReport(month = currentMonth()): Promise<CostReport> {
  const rows = await aggregateUsage(
    `WHERE created_at >= $1::date
       AND created_at < ($1::date + INTERVAL '1 month')`,
    [`${month}-01`],
  );
  return buildReport(month, rows);
}

export async function checkMonthlyBudget(month = currentMonth()): Promise<BudgetStatus> {
  const rows = await aggregateUsage(
    `WHERE created_at >= $1::date
       AND created_at < ($1::date + INTERVAL '1 month')`,
    [`${month}-01`],
  );
  return budgetStatus(totalCost(rows), config.carina.llmMonthlyBudgetUsd);
}

export function formatCostReport(report: CostReport): string {
  const lines = [
    `Usage for ${report.month}`,
    `Total: ${report.totalTokens} tokens, $${report.totalCost.toFixed(6)} estimated`,
  ];
  if (report.budget.budgetLimit !== null) {
    lines.push(`Budget: $${report.budget.budgetLimit.toFixed(2)}, ${report.budget.status}`);
  }
  if (report.breakdown.length === 0) {
    lines.push('No model usage recorded.');
    return lines.join('\n');
  }
  for (const item of report.breakdown) {
    lines.push(
      `${item.provider}/${item.model || 'default'}: ${item.tokensUsed} tokens, $${item.estimatedCost.toFixed(6)}`,
    );
  }
  if (report.budget.message) lines.push(report.budget.message);
  return lines.join('\n');
}

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

async function aggregateUsage(whereClause: string, params: unknown[]): Promise<UsageBreakdown[]> {
  const result = await pool.query<UsageRow>(
    `SELECT provider, model, SUM(tokens_used) AS tokens_used, SUM(estimated_cost) AS estimated_cost
     FROM model_usage
     ${whereClause}
     GROUP BY provider, model
     ORDER BY estimated_cost DESC, provider ASC, model ASC`,
    params,
  );
  return result.rows.map((row) => ({
    provider: row.provider,
    model: row.model,
    tokensUsed: Number(row.tokens_used),
    estimatedCost: Number(row.estimated_cost),
  }));
}

function buildReport(month: string, breakdown: UsageBreakdown[]): CostReport {
  const cost = totalCost(breakdown);
  return {
    month,
    totalTokens: breakdown.reduce((sum, row) => sum + row.tokensUsed, 0),
    totalCost: cost,
    breakdown,
    budget: budgetStatus(cost, config.carina.llmMonthlyBudgetUsd),
  };
}

function totalCost(rows: UsageBreakdown[]): number {
  return roundCost(rows.reduce((sum, row) => sum + row.estimatedCost, 0));
}

function budgetStatus(totalCost: number, budgetLimit: number | null): BudgetStatus {
  if (!budgetLimit || budgetLimit <= 0) return { status: 'ok', totalCost, budgetLimit: null };
  if (totalCost >= budgetLimit) {
    return {
      status: 'blocked',
      totalCost,
      budgetLimit,
      message: `Monthly LLM budget reached: $${totalCost.toFixed(2)} of $${budgetLimit.toFixed(2)}. New requests are blocked until the next month or the budget is raised.`,
    };
  }
  if (totalCost >= budgetLimit * 0.8) {
    return {
      status: 'warn',
      totalCost,
      budgetLimit,
      message: `Monthly LLM budget warning: $${totalCost.toFixed(2)} of $${budgetLimit.toFixed(2)} used.`,
    };
  }
  return { status: 'ok', totalCost, budgetLimit };
}

function roundCost(value: number): number {
  return Math.round(value * 1_000_000_000) / 1_000_000_000;
}
