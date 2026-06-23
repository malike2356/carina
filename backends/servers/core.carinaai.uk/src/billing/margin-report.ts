import { pool } from '../memory/db.js';
import { billingPlanIdFromOrgPlan } from './ops-metering-service.js';
import {
  BILLING_PLANS,
  type BillingPlanId,
  resolveCreditUsdRate,
} from './plans.js';

export const MARGIN_FLOOR = 0.65;

export function impliedGrossMargin(creditRevenueUsd: number, providerCostUsd: number): number | null {
  if (creditRevenueUsd <= 0) return null;
  return (creditRevenueUsd - providerCostUsd) / creditRevenueUsd;
}

export function marginBelowFloor(margin: number | null, floor = MARGIN_FLOOR): boolean {
  return margin !== null && margin < floor;
}

export interface OrgMarginSummary {
  orgId: string;
  orgName: string;
  planId: BillingPlanId;
  creditsBilled: number;
  providerCostUsd: number;
  creditRevenueUsd: number;
  grossMargin: number | null;
  belowFloor: boolean;
  byokCostOnly: boolean;
}

export interface PlatformMarginSummary {
  floor: number;
  month: string;
  orgs: OrgMarginSummary[];
  totals: {
    creditsBilled: number;
    providerCostUsd: number;
    creditRevenueUsd: number;
    grossMargin: number | null;
  };
}

function currentMonthLabel(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

function summarizeOrgRow(row: {
  orgId: string;
  orgName: string;
  planId: BillingPlanId;
  creditsBilled: number;
  providerCostUsd: number;
}): OrgMarginSummary {
  const creditUsdRate = resolveCreditUsdRate(row.planId);
  const creditRevenueUsd = row.creditsBilled * creditUsdRate;
  const grossMargin = impliedGrossMargin(creditRevenueUsd, row.providerCostUsd);
  const byokCostOnly = row.creditsBilled === 0 && row.providerCostUsd > 0;
  return {
    orgId: row.orgId,
    orgName: row.orgName,
    planId: row.planId,
    creditsBilled: row.creditsBilled,
    providerCostUsd: row.providerCostUsd,
    creditRevenueUsd,
    grossMargin,
    belowFloor: marginBelowFloor(grossMargin),
    byokCostOnly,
  };
}

export async function getOrgMarginSummary(orgId: string): Promise<OrgMarginSummary | null> {
  const result = await pool.query<{
    id: string;
    name: string;
    plan: string;
    credits_billed: string;
    provider_cost: string;
  }>(
    `SELECT o.id, o.name, o.plan,
            COALESCE(SUM(CASE WHEN l.event_type = 'usage' THEN ABS(l.credits) ELSE 0 END), 0)::TEXT AS credits_billed,
            COALESCE(SUM(l.provider_cost_usd), 0)::TEXT AS provider_cost
     FROM organizations o
     LEFT JOIN ops_credit_ledger l
       ON l.org_id = o.id::text
      AND l.created_at >= date_trunc('month', NOW())
      AND l.event_type IN ('usage', 'byok_usage')
     WHERE o.id = $1
     GROUP BY o.id, o.name, o.plan`,
    [orgId],
  );
  const row = result.rows[0];
  if (!row) return null;
  const planId = billingPlanIdFromOrgPlan(String(row.plan));
  if (BILLING_PLANS[planId].includedCredits === null) return null;
  return summarizeOrgRow({
    orgId: String(row.id),
    orgName: String(row.name),
    planId,
    creditsBilled: Number(row.credits_billed),
    providerCostUsd: Number(row.provider_cost),
  });
}

export async function getPlatformMarginSummary(): Promise<PlatformMarginSummary> {
  const result = await pool.query<{
    id: string;
    name: string;
    plan: string;
    credits_billed: string;
    provider_cost: string;
  }>(
    `SELECT o.id, o.name, o.plan,
            COALESCE(SUM(CASE WHEN l.event_type = 'usage' THEN ABS(l.credits) ELSE 0 END), 0)::TEXT AS credits_billed,
            COALESCE(SUM(l.provider_cost_usd), 0)::TEXT AS provider_cost
     FROM organizations o
     LEFT JOIN ops_credit_ledger l
       ON l.org_id = o.id::text
      AND l.created_at >= date_trunc('month', NOW())
      AND l.event_type IN ('usage', 'byok_usage')
     WHERE o.plan IN ('carina_ops_starter', 'carina_ops_team', 'free')
     GROUP BY o.id, o.name, o.plan
     HAVING COALESCE(SUM(CASE WHEN l.event_type = 'usage' THEN ABS(l.credits) ELSE 0 END), 0) > 0
         OR COALESCE(SUM(l.provider_cost_usd), 0) > 0
     ORDER BY o.name`,
  );

  const orgs = result.rows.map((row) => summarizeOrgRow({
    orgId: String(row.id),
    orgName: String(row.name),
    planId: billingPlanIdFromOrgPlan(String(row.plan)),
    creditsBilled: Number(row.credits_billed),
    providerCostUsd: Number(row.provider_cost),
  }));

  const creditsBilled = orgs.reduce((sum, row) => sum + row.creditsBilled, 0);
  const providerCostUsd = orgs.reduce((sum, row) => sum + row.providerCostUsd, 0);
  const creditRevenueUsd = orgs.reduce((sum, row) => sum + row.creditRevenueUsd, 0);

  return {
    floor: MARGIN_FLOOR,
    month: currentMonthLabel(),
    orgs,
    totals: {
      creditsBilled,
      providerCostUsd,
      creditRevenueUsd,
      grossMargin: impliedGrossMargin(creditRevenueUsd, providerCostUsd),
    },
  };
}
