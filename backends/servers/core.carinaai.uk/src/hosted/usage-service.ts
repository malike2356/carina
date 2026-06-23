import { pool } from '../memory/db.js';
import { orgOrTenantWhere, queryForOrg } from '../hosted/scoped-query.js';
import { checkOrgUsageQuota } from '../api/hosted-billing.js';
import { sendUsageWarningEmail } from './usage-warning-email.js';
import { resolveEmailIdentityForOrg } from './brand-email.js';
import { BILLING_PLANS, type BillingPlanId } from '../billing/plans.js';
import { getMonthlyBalance, getModelMixForMonth } from '../billing/credit-ledger.js';
import { getAllowedModelClasses } from '../billing/credit-gate.js';
import { billingPlanIdFromOrgPlan } from '../billing/ops-metering-service.js';
import { highestAllowedModelClass, type ModelClass } from '../billing/rate-card.js';
import { getOrgPlan } from './plan-gates.js';

export type UsageWarningThreshold = 80 | 90 | 95 | 100;

interface OrgWarningEmailState {
  lastEmailedThreshold: UsageWarningThreshold | null;
  billingMonth: string;
}

const orgWarningEmailState = new Map<string, OrgWarningEmailState>();

function currentBillingMonth(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function getUsageWarningThreshold(used: number, limit: number): UsageWarningThreshold | null {
  if (limit <= 0) return null;
  if (used >= limit) return 100;
  if (used >= limit * 0.95) return 95;
  if (used >= limit * 0.9) return 90;
  if (used >= limit * 0.8) return 80;
  return null;
}

export function resetUsageWarningEmailState(): void {
  orgWarningEmailState.clear();
}

async function getOrgOwnerContact(orgId: string): Promise<{ orgName: string; ownerEmail: string } | null> {
  const result = await pool.query<{ name: string; email: string }>(
    `SELECT o.name, hu.email
     FROM organizations o
     JOIN hosted_users hu ON hu.id = o.owner_user_id
     WHERE o.id = $1`,
    [orgId],
  );
  const row = result.rows[0];
  if (!row) return null;
  return { orgName: String(row.name), ownerEmail: String(row.email) };
}

async function resolveUsageQuotaForWarnings(
  orgId: string,
  tenantId: string,
): Promise<{ used: number; limit: number; unit: 'credits' | 'tokens' }> {
  const orgPlan = await getOrgPlan(orgId);
  const billingPlanId = billingPlanIdFromOrgPlan(orgPlan);
  const plan = BILLING_PLANS[billingPlanId];
  if (plan.includedCredits !== null) {
    const balance = await getMonthlyBalance(orgId, billingPlanId);
    const limit = plan.includedCredits + balance.topups;
    return { used: balance.used, limit, unit: 'credits' };
  }
  const quota = await checkOrgUsageQuota(orgId, tenantId, orgPlan);
  return { used: quota.used, limit: quota.limit, unit: 'tokens' };
}

export async function maybeNotifyUsageWarning(
  orgId: string,
  tenantId: string,
  quotaOverride?: { used: number; limit: number; unit?: 'credits' | 'tokens' },
): Promise<void> {
  const quota = quotaOverride ?? await resolveUsageQuotaForWarnings(orgId, tenantId);
  if (quota.limit <= 0) return;

  const threshold = getUsageWarningThreshold(quota.used, quota.limit);
  if (!threshold) return;

  const month = currentBillingMonth();
  let state = orgWarningEmailState.get(orgId);
  if (!state || state.billingMonth !== month) {
    state = { lastEmailedThreshold: null, billingMonth: month };
    orgWarningEmailState.set(orgId, state);
  }

  const last = state.lastEmailedThreshold;
  if (last !== null && threshold <= last) return;

  const owner = await getOrgOwnerContact(orgId);
  if (!owner) return;

  const identity = await resolveEmailIdentityForOrg(orgId);
  const sent = await sendUsageWarningEmail({
    orgName: owner.orgName,
    ownerEmail: owner.ownerEmail,
    threshold,
    used: quota.used,
    limit: quota.limit,
    unit: quota.unit ?? quotaOverride?.unit ?? 'credits',
    identity,
    billingUrl: `https://${identity.appHost}/ops/billing`,
  });
  if (sent) {
    state.lastEmailedThreshold = threshold;
  }
}

export interface UsageSummary {
  totalTokens: number;
  totalCost: number;
  daily: Array<{ date: string; tokens: number; cost: number }>;
}

export interface ModelUsage {
  provider: string;
  model: string;
  tokens: number;
  cost: number;
  requests: number;
}

export interface CreditsStatus {
  unit: 'credits' | 'tokens';
  monthlyLimit: number;
  usedThisMonth: number;
  remaining: number;
  percentUsed: number;
  warning: boolean;
  creditsIncluded: number | null;
  topups: number;
  modelMix: Array<{ modelClass: string; creditsUsed: number; providerCostUsd: number }>;
  allowedClasses: string[];
  highestModelClass: string | null;
}

function daysAgo(days: number): Date {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

export async function getUsageSummary(orgId: string, tenantId: string, days = 30): Promise<UsageSummary> {
  const windowDays = Math.min(Math.max(days, 1), 90);
  const since = daysAgo(windowDays - 1);

  const dailyResult = await queryForOrg(
    orgId,
    `SELECT date, COALESCE(SUM(tokens_used), 0)::TEXT AS tokens,
            COALESCE(SUM(cost_estimate), 0)::TEXT AS cost
     FROM usage_records
     WHERE ${orgOrTenantWhere()} AND date >= $3
     GROUP BY date
     ORDER BY date ASC`,
    [tenantId, since],
  );

  const daily = dailyResult.rows.map((row) => ({
    date: String(row.date),
    tokens: Number(row.tokens),
    cost: Number(row.cost),
  }));

  const totalTokens = daily.reduce((sum, row) => sum + row.tokens, 0);
  const totalCost = daily.reduce((sum, row) => sum + row.cost, 0);

  return { totalTokens, totalCost, daily };
}

export async function getUsageByModel(
  orgId: string,
  tenantId: string,
  days = 30,
): Promise<ModelUsage[]> {
  const windowDays = Math.min(Math.max(days, 1), 90);
  const since = daysAgo(windowDays - 1);

  const result = await queryForOrg(
    orgId,
    `SELECT model,
            COALESCE(SUM(tokens_used), 0)::TEXT AS tokens,
            COALESCE(SUM(cost_estimate), 0)::TEXT AS cost,
            COUNT(*)::TEXT AS requests
     FROM usage_records
     WHERE ${orgOrTenantWhere()} AND date >= $3
     GROUP BY model
     ORDER BY tokens DESC`,
    [tenantId, since],
  );

  return result.rows.map((row) => {
    const modelName = String(row.model);
    const slash = modelName.indexOf('/');
    return {
      provider: slash > 0 ? modelName.slice(0, slash) : 'unknown',
      model: slash > 0 ? modelName.slice(slash + 1) : modelName,
      tokens: Number(row.tokens),
      cost: Number(row.cost),
      requests: Number(row.requests),
    };
  });
}

export async function getCreditsStatus(orgId: string, tenantId: string): Promise<CreditsStatus> {
  const orgPlan = await getOrgPlan(orgId);
  const billingPlanId: BillingPlanId = billingPlanIdFromOrgPlan(orgPlan);
  const plan = BILLING_PLANS[billingPlanId];
  if (plan.includedCredits !== null) {
    const [balance, modelMix, allowedClasses] = await Promise.all([
      getMonthlyBalance(orgId, billingPlanId),
      getModelMixForMonth(orgId),
      getAllowedModelClasses(billingPlanId),
    ]);
    const effectiveLimit = plan.includedCredits + balance.topups;
    const used = balance.used;
    const remaining = balance.remaining ?? 0;
    const percentUsed = effectiveLimit > 0 ? Math.round((used / effectiveLimit) * 100) : 0;
    const highestModelClass = allowedClasses.length > 0
      ? highestAllowedModelClass(allowedClasses as ModelClass[])
      : null;
    return {
      unit: 'credits',
      monthlyLimit: effectiveLimit,
      usedThisMonth: used,
      remaining,
      percentUsed,
      warning: percentUsed >= 80,
      creditsIncluded: plan.includedCredits,
      topups: balance.topups,
      modelMix,
      allowedClasses,
      highestModelClass,
    };
  }

  const quota = await checkOrgUsageQuota(orgId, tenantId, orgPlan);
  const percentUsed = quota.limit > 0 ? Math.round((quota.used / quota.limit) * 100) : 0;

  return {
    unit: 'tokens',
    monthlyLimit: quota.limit,
    usedThisMonth: quota.used,
    remaining: Math.max(0, quota.limit - quota.used),
    percentUsed,
    warning: quota.warning,
    creditsIncluded: null,
    topups: 0,
    modelMix: [],
    allowedClasses: [],
    highestModelClass: null,
  };
}

export async function getTodayUsage(orgId: string, tenantId: string): Promise<{
  tokens: number;
  cost: number;
}> {
  const result = await queryForOrg<{ tokens: string; cost: string }>(
    orgId,
    `SELECT COALESCE(SUM(tokens_used), 0)::TEXT AS tokens,
            COALESCE(SUM(cost_estimate), 0)::TEXT AS cost
     FROM usage_records
     WHERE ${orgOrTenantWhere()} AND date = CURRENT_DATE`,
    [tenantId],
  );
  return {
    tokens: Number(result.rows[0]?.tokens ?? 0),
    cost: Number(result.rows[0]?.cost ?? 0),
  };
}

const CSV_EXPORT_LIMIT = 10_000;

function csvCell(value: unknown): string {
  const raw = value == null ? '' : String(value);
  if (/[",\n\r]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

export async function exportUsageCsv(
  orgId: string,
  tenantId: string,
  days = 30,
): Promise<string> {
  const windowDays = Math.min(Math.max(days, 1), 90);
  const since = daysAgo(windowDays - 1);

  const result = await queryForOrg(
    orgId,
    `SELECT date, model,
            COALESCE(tokens_used, 0)::TEXT AS tokens_used,
            COALESCE(cost_estimate, 0)::TEXT AS cost_estimate
     FROM usage_records
     WHERE ${orgOrTenantWhere()} AND date >= $3
     ORDER BY date DESC, model ASC
     LIMIT $4`,
    [tenantId, since, CSV_EXPORT_LIMIT],
  );

  const header = 'date,model,tokens_used,cost_estimate';
  const lines = result.rows.map((row) => [
    csvCell(row.date),
    csvCell(row.model),
    csvCell(row.tokens_used),
    csvCell(row.cost_estimate),
  ].join(','));
  return [header, ...lines].join('\n');
}
