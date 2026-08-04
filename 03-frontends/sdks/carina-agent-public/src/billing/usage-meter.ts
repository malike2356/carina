import { pool } from '../memory/db.js';
import { BILLING_PLANS, type BillingPlanId } from './plans.js';

export interface UsageRecord {
  tenant_id: string;
  date: Date;
  tokens_used: number;
  model: string;
  cost_estimate: number;
}

export interface UsageStatus {
  tokensUsed: number;
  limit: number | null;
  warning?: string;
  blocked?: string;
}

export function estimateTokenCost(tokensUsed: number): number {
  return (tokensUsed / 1000) * 0.002;
}

export class UsageMeter {
  async recordUsage(input: { tenantId: string; tokensUsed: number; model: string }): Promise<void> {
    await pool.query(
      `INSERT INTO usage_records (tenant_id, date, tokens_used, model, cost_estimate)
       VALUES ($1, CURRENT_DATE, $2, $3, $4)`,
      [input.tenantId, input.tokensUsed, input.model, estimateTokenCost(input.tokensUsed)],
    );
  }

  async getMonthlyUsage(tenantId: string): Promise<number> {
    const result = await pool.query<{ total: string }>(
      `SELECT COALESCE(SUM(tokens_used), 0)::TEXT AS total
       FROM usage_records
       WHERE tenant_id = $1
         AND date >= date_trunc('month', CURRENT_DATE)::DATE`,
      [tenantId],
    );
    return Number(result.rows[0]?.total ?? 0);
  }

  async status(tenantId: string, plan: BillingPlanId): Promise<UsageStatus> {
    const tokensUsed = await this.getMonthlyUsage(tenantId);
    const limit = BILLING_PLANS[plan].tokenLimit;
    if (!limit) return { tokensUsed, limit };
    if (tokensUsed >= limit) {
      return {
        tokensUsed,
        limit,
        blocked: `You've used ${formatTokens(limit)} of ${formatTokens(limit)} tokens this month. Upgrade to continue.`,
      };
    }
    if (tokensUsed >= limit * 0.8) {
      return {
        tokensUsed,
        limit,
        warning: `You've used ${formatTokens(tokensUsed)} of ${formatTokens(limit)} tokens this month`,
      };
    }
    return { tokensUsed, limit };
  }
}

export function formatTokens(value: number): string {
  if (value >= 1_000_000) return `${Math.round(value / 1_000_000)}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`;
  return String(value);
}
