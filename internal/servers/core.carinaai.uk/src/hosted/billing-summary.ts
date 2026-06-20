import { pool } from '../memory/db.js';
import { BILLING_PLANS, normalizePlanId, type BillingPlanId } from '../billing/plans.js';
import { SubscriptionManager } from '../billing/subscription-manager.js';
import { getOrgPlan } from './plan-gates.js';
import { queryForOrg } from './scoped-query.js';

export interface BillingInvoiceSummary {
  id: string;
  amount: number;
  status: string;
  pdfUrl: string | null;
  createdAt: Date;
}

export interface BillingSummary {
  plan: BillingPlanId;
  effectivePlan: string;
  status: string;
  currentPeriodEnd: string | null;
  trialEndsAt: string | null;
  trialDaysLeft: number | null;
  monthlyPriceGbp: number | null;
  features: string[];
  invoices: BillingInvoiceSummary[];
}

export async function getBillingSummary(orgId: string, tenantId: string): Promise<BillingSummary> {
  const subscriptions = new SubscriptionManager();
  const sub = await subscriptions.getSubscriptionForOrg(orgId, tenantId);
  const effectivePlan = await getOrgPlan(orgId);
  const storedPlan = normalizePlanId(sub?.plan ?? 'free');
  const planMeta = BILLING_PLANS[storedPlan] ?? BILLING_PLANS.free;

  const invoiceResult = await queryForOrg(
    orgId,
    `SELECT id, amount, status, pdf_url, created_at
     FROM invoices
     WHERE org_id = $1 OR (org_id IS NULL AND tenant_id = $2)
     ORDER BY created_at DESC
     LIMIT 24`,
    [tenantId],
  );

  let trialDaysLeft: number | null = null;
  if (sub?.trial_ends_at) {
    const ms = new Date(sub.trial_ends_at).getTime() - Date.now();
    trialDaysLeft = ms > 0 ? Math.ceil(ms / 86400000) : 0;
  }

  return {
    plan: storedPlan,
    effectivePlan,
    status: sub?.status ?? 'active',
    currentPeriodEnd: sub?.current_period_end?.toISOString() ?? null,
    trialEndsAt: sub?.trial_ends_at?.toISOString() ?? null,
    trialDaysLeft,
    monthlyPriceGbp: planMeta.monthlyPriceGbp,
    features: planMeta.features,
    invoices: invoiceResult.rows.map((row) => ({
      id: String(row.id),
      amount: Number(row.amount),
      status: String(row.status),
      pdfUrl: row.pdf_url ? String(row.pdf_url) : null,
      createdAt: row.created_at as Date,
    })),
  };
}
