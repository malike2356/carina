import { pool } from '../memory/db.js';
import { BILLING_PLANS, type BillingPlanId } from './plans.js';
import type { ModelClass } from './rate-card.js';
import { maybeNotifyUsageWarning } from '../hosted/usage-service.js';

export interface MonthlyBalance {
  used: number;
  remaining: number | null;
  percentUsed: number | null;
  topups: number;
  netLedger: number;
}

export interface ModelMixRow {
  modelClass: string;
  creditsUsed: number;
  providerCostUsd: number;
}

async function sumMonthlyLedger(orgId: string): Promise<{ net: number; topups: number; usage: number }> {
  const result = await pool.query<{ event_type: string; total: string }>(
    `SELECT event_type, COALESCE(SUM(credits), 0)::TEXT AS total
     FROM ops_credit_ledger
     WHERE org_id = $1
       AND created_at >= date_trunc('month', NOW())
     GROUP BY event_type`,
    [orgId],
  );
  let net = 0;
  let topups = 0;
  let usage = 0;
  for (const row of result.rows) {
    const total = Number(row.total);
    net += total;
    if (row.event_type === 'topup' || row.event_type === 'grant') {
      topups += total;
    }
    if (row.event_type === 'usage') {
      usage += Math.abs(total);
    }
  }
  return { net, topups, usage };
}

export async function getMonthlyBalance(
  orgId: string,
  planId: BillingPlanId,
): Promise<MonthlyBalance> {
  const included = BILLING_PLANS[planId].includedCredits;
  if (included === null) {
    return { used: 0, remaining: null, percentUsed: null, topups: 0, netLedger: 0 };
  }
  const { net, topups, usage } = await sumMonthlyLedger(orgId);
  const remaining = Math.max(0, included + net);
  const percentUsed = included > 0 ? Math.round((usage / included) * 1000) / 10 : null;
  return { used: usage, remaining, percentUsed, topups, netLedger: net };
}

export async function getModelMixForMonth(orgId: string): Promise<ModelMixRow[]> {
  const result = await pool.query<{ model_class: string; credits: string; cost: string }>(
    `SELECT model_class,
            COALESCE(SUM(ABS(credits)), 0)::TEXT AS credits,
            COALESCE(SUM(provider_cost_usd), 0)::TEXT AS cost
     FROM ops_credit_ledger
     WHERE org_id = $1
       AND event_type = 'usage'
       AND created_at >= date_trunc('month', NOW())
     GROUP BY model_class
     ORDER BY credits DESC`,
    [orgId],
  );
  return result.rows.map((row) => ({
    modelClass: String(row.model_class ?? 'unknown'),
    creditsUsed: Number(row.credits),
    providerCostUsd: Number(row.cost),
  }));
}

export async function debitCredits(input: {
  orgId: string;
  tenantId?: string;
  sessionId: string;
  model: string;
  modelClass: ModelClass;
  rateCardId: number;
  credits: number;
  providerCostUsd: number;
}): Promise<void> {
  await pool.query(
    `INSERT INTO ops_credit_ledger
      (org_id, event_type, credits, provider_cost_usd, model, model_class, session_id, rate_card_id)
     VALUES ($1, 'usage', $2, $3, $4, $5, $6, $7)`,
    [
      input.orgId,
      -Math.abs(input.credits),
      input.providerCostUsd,
      input.model,
      input.modelClass,
      input.sessionId,
      input.rateCardId,
    ],
  );

  if (!input.tenantId) return;
  const planId = await resolveOrgBillingPlan(input.orgId);
  const balance = await getMonthlyBalance(input.orgId, planId);
  if (balance.remaining === null || balance.percentUsed === null) return;
  const included = BILLING_PLANS[planId].includedCredits ?? 0;
  await maybeNotifyUsageWarning(input.orgId, input.tenantId, {
    used: balance.used,
    limit: included + balance.topups,
  });
}

export async function creditTopup(orgId: string, credits: number, note?: string): Promise<void> {
  await pool.query(
    `INSERT INTO ops_credit_ledger (org_id, event_type, credits, model)
     VALUES ($1, 'topup', $2, $3)`,
    [orgId, Math.abs(credits), note ?? null],
  );
}

async function resolveOrgBillingPlan(orgId: string): Promise<BillingPlanId> {
  const result = await pool.query<{ plan: string }>(
    'SELECT plan FROM organizations WHERE id = $1 LIMIT 1',
    [orgId],
  );
  const raw = result.rows[0]?.plan ?? 'free';
  if (raw === 'carina_ops_starter' || raw === 'carina_ops_team') return raw;
  if (raw === 'enterprise') return 'enterprise';
  return 'free';
}
