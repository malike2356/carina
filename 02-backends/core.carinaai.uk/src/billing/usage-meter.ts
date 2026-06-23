/**
 * Legacy token usage meter. Credit-based Ops plans delegate allowance checks to
 * ops_credit_ledger via getMonthlyBalance(); this class still records usage_records
 * for backward-compatible reporting and non-credit plans.
 */
import { pool } from '../memory/db.js';
import { BILLING_PLANS, type BillingPlanId } from './plans.js';
import { getMonthlyBalance } from './credit-ledger.js';
import { orgOrTenantWhere, queryForOrg } from '../hosted/scoped-query.js';

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

  async getMonthlyUsageForOrg(orgId: string, tenantId: string): Promise<number> {
    const result = await queryForOrg<{ total: string }>(
      orgId,
      `SELECT COALESCE(SUM(tokens_used), 0)::TEXT AS total
       FROM usage_records
       WHERE ${orgOrTenantWhere()}
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

  async statusForOrg(orgId: string, tenantId: string, plan: BillingPlanId): Promise<UsageStatus> {
    const planMeta = BILLING_PLANS[plan];
    const tokensUsed = await this.getMonthlyUsageForOrg(orgId, tenantId);
    if (planMeta.includedCredits !== null) {
      const balance = await getMonthlyBalance(orgId, plan);
      const limit = planMeta.includedCredits + balance.topups;
      const creditUsed = balance.used;
      if (limit > 0 && creditUsed >= limit) {
        return {
          tokensUsed,
          limit,
          blocked: `You've used ${formatTokens(limit)} of ${formatTokens(limit)} credits this month. Upgrade or top up to continue.`,
        };
      }
      if (limit > 0 && creditUsed >= limit * 0.8) {
        return {
          tokensUsed,
          limit,
          warning: `You've used ${formatTokens(creditUsed)} of ${formatTokens(limit)} credits this month`,
        };
      }
      return { tokensUsed, limit };
    }

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
