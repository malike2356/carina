import type Stripe from 'stripe';
import StripeSdk from 'stripe';
import { resolveWorkspaceIdFromInvoice } from './aiva-stripe-metadata.js';
import { suspendIfGraceExpired } from './aiva-billing.js';
import { pool } from '../memory/db.js';
import { slotLimitDbValue } from './aiva-tier.js';

export type AivaPlanTier = 'trial' | 'starter' | 'team' | 'business';

export interface AivaInvoiceRow {
  id: string;
  workspaceId: string;
  stripeInvoiceId: string;
  amountPaid: number;
  currency: string;
  status: string;
  invoicePdfUrl: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  createdAt: string;
}

function buildPriceTierMap(): Record<string, { tier: AivaPlanTier; interval: 'month' | 'year' }> {
  const tiers: AivaPlanTier[] = ['starter', 'team', 'business'];
  const map: Record<string, { tier: AivaPlanTier; interval: 'month' | 'year' }> = {};
  for (const tier of tiers) {
    const monthly = process.env[`STRIPE_PRICE_AIVA_${tier.toUpperCase()}_MONTHLY`]?.trim();
    const annual = process.env[`STRIPE_PRICE_AIVA_${tier.toUpperCase()}_ANNUAL`]?.trim();
    if (monthly) map[monthly] = { tier, interval: 'month' };
    if (annual) map[annual] = { tier, interval: 'year' };
  }
  return map;
}

export function tierFromPriceId(priceId: string): { tier: AivaPlanTier; interval: 'month' | 'year' } | null {
  return buildPriceTierMap()[priceId] ?? null;
}

export async function canHireMoreAivas(workspaceId: string): Promise<boolean> {
  await suspendIfGraceExpired(workspaceId);

  const result = await pool.query(
    `SELECT s.aiva_slot_limit, s.status,
            (SELECT COUNT(*)::int FROM ai_workers w
             WHERE w.workspace_id = s.workspace_id AND w.status != 'dismissed') AS used
     FROM aiva_subscriptions s
     WHERE s.workspace_id = $1`,
    [workspaceId],
  );
  const row = result.rows[0] as { aiva_slot_limit?: number; status?: string; used?: number } | undefined;
  if (!row) return false;
  if (row.status === 'suspended') return false;
  return Number(row.used ?? 0) < Number(row.aiva_slot_limit ?? 1);
}

export async function activateAivaSubscription(input: {
  workspaceId: string;
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  stripePriceId: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
}): Promise<void> {
  const resolved = tierFromPriceId(input.stripePriceId);
  const tier = resolved?.tier ?? 'starter';
  const interval = resolved?.interval ?? 'month';
  const slotLimit = slotLimitDbValue(tier);

  await pool.query(
    `INSERT INTO aiva_subscriptions
       (workspace_id, plan_tier, status, aiva_slot_limit, stripe_customer_id, stripe_subscription_id,
        stripe_price_id, current_period_start, current_period_end, billing_interval, updated_at)
     VALUES ($1, $2, 'active', $3, $4, $5, $6, $7, $8, $9, NOW())
     ON CONFLICT (workspace_id) DO UPDATE SET
       plan_tier = EXCLUDED.plan_tier,
       status = 'active',
       aiva_slot_limit = EXCLUDED.aiva_slot_limit,
       stripe_customer_id = EXCLUDED.stripe_customer_id,
       stripe_subscription_id = EXCLUDED.stripe_subscription_id,
       stripe_price_id = EXCLUDED.stripe_price_id,
       current_period_start = EXCLUDED.current_period_start,
       current_period_end = EXCLUDED.current_period_end,
       billing_interval = EXCLUDED.billing_interval,
       grace_period_ends_at = NULL,
       payment_failed_at = NULL,
       pending_downgrade_conflict = false,
       trial_started_at = NULL,
       trial_ends_at = NULL,
       updated_at = NOW()`,
    [
      input.workspaceId,
      tier,
      slotLimit,
      input.stripeCustomerId,
      input.stripeSubscriptionId,
      input.stripePriceId,
      input.currentPeriodStart,
      input.currentPeriodEnd,
      interval,
    ],
  );
}

export async function syncAivaSubscriptionFromStripe(subscription: Stripe.Subscription): Promise<void> {
  const workspaceId = subscription.metadata?.workspaceId ?? subscription.metadata?.workspace_id;
  if (!workspaceId) return;

  const priceId = subscription.items.data[0]?.price.id ?? '';
  const resolved = priceId ? tierFromPriceId(priceId) : null;
  const tier = resolved?.tier ?? (subscription.metadata?.plan as AivaPlanTier | undefined) ?? 'starter';
  const interval = resolved?.interval ?? 'month';
  const slotLimit = slotLimitDbValue(tier);
  const usedResult = await pool.query(
    `SELECT COUNT(*)::int AS used FROM ai_workers WHERE workspace_id = $1 AND status != 'dismissed'`,
    [workspaceId],
  );
  const used = Number(usedResult.rows[0]?.used ?? 0);
  const pendingConflict = slotLimit !== null && used > slotLimit;

  const periodStart = subscription.items.data[0]?.current_period_start;
  const periodEnd = subscription.items.data[0]?.current_period_end;

  await pool.query(
    `UPDATE aiva_subscriptions SET
       plan_tier = $2,
       status = $3,
       aiva_slot_limit = $4,
       stripe_customer_id = COALESCE($5, stripe_customer_id),
       stripe_subscription_id = $6,
       stripe_price_id = $7,
       current_period_start = COALESCE($8, current_period_start),
       current_period_end = COALESCE($9, current_period_end),
       billing_interval = $10,
       cancel_at_period_end = $11,
       pending_downgrade_conflict = $12,
       updated_at = NOW()
     WHERE workspace_id = $1`,
    [
      workspaceId,
      tier,
      subscription.status === 'active' || subscription.status === 'trialing' ? 'active' : subscription.status,
      slotLimit,
      typeof subscription.customer === 'string' ? subscription.customer : null,
      subscription.id,
      priceId || null,
      periodStart ? new Date(periodStart * 1000) : null,
      periodEnd ? new Date(periodEnd * 1000) : null,
      interval,
      subscription.cancel_at_period_end,
      pendingConflict,
    ],
  );
}

export async function recordAivaInvoice(invoice: Stripe.Invoice): Promise<void> {
  const workspaceId =
    invoice.metadata?.workspaceId ??
    invoice.metadata?.workspace_id ??
    (await resolveWorkspaceIdFromInvoice(invoice));
  if (!workspaceId || !invoice.id) return;

  const period = invoice.lines?.data?.[0]?.period;
  await pool.query(
    `INSERT INTO aiva_invoices
       (workspace_id, stripe_invoice_id, amount_paid, currency, status, invoice_pdf_url, period_start, period_end)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (stripe_invoice_id) DO UPDATE SET
       amount_paid = EXCLUDED.amount_paid,
       status = EXCLUDED.status,
       invoice_pdf_url = EXCLUDED.invoice_pdf_url`,
    [
      String(workspaceId),
      invoice.id,
      invoice.amount_paid ?? 0,
      invoice.currency ?? 'gbp',
      invoice.status ?? 'open',
      invoice.invoice_pdf ?? null,
      period?.start ? new Date(period.start * 1000) : null,
      period?.end ? new Date(period.end * 1000) : null,
    ],
  );
}

export async function listAivaInvoices(workspaceId: string, limit = 20): Promise<AivaInvoiceRow[]> {
  const result = await pool.query(
    `SELECT id, workspace_id, stripe_invoice_id, amount_paid, currency, status,
            invoice_pdf_url, period_start, period_end, created_at
     FROM aiva_invoices
     WHERE workspace_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [workspaceId, limit],
  );
  return result.rows.map((row) => ({
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    stripeInvoiceId: String(row.stripe_invoice_id),
    amountPaid: Number(row.amount_paid ?? 0),
    currency: String(row.currency ?? 'gbp'),
    status: String(row.status ?? 'open'),
    invoicePdfUrl: row.invoice_pdf_url ? String(row.invoice_pdf_url) : null,
    periodStart: row.period_start ? new Date(String(row.period_start)).toISOString() : null,
    periodEnd: row.period_end ? new Date(String(row.period_end)).toISOString() : null,
    createdAt: new Date(String(row.created_at)).toISOString(),
  }));
}

export async function cancelAivaStripeSubscriptionForWorkspace(workspaceId: string): Promise<void> {
  if (process.env.AIVA_BILLING_ENABLED === 'false') return;

  const result = await pool.query(
    `SELECT stripe_subscription_id FROM aiva_subscriptions WHERE workspace_id = $1`,
    [workspaceId],
  );
  const subscriptionId = result.rows[0]?.stripe_subscription_id as string | null | undefined;
  if (!subscriptionId) return;

  const secret = process.env.STRIPE_SECRET_KEY?.trim();
  if (secret) {
    try {
      const stripe = new StripeSdk(secret);
      await stripe.subscriptions.cancel(subscriptionId);
    } catch (err) {
      console.warn('[aiva-billing] Stripe cancel on erasure failed:', err);
    }
  }

  await pool.query(
    `UPDATE aiva_subscriptions
     SET status = 'cancelled',
         stripe_subscription_id = NULL,
         cancel_at_period_end = false,
         updated_at = NOW()
     WHERE workspace_id = $1`,
    [workspaceId],
  );
}
