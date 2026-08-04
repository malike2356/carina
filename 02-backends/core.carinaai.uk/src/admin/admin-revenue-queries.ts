import Stripe from 'stripe';
import { pool } from '../memory/db.js';
import { getStripeBillingClientOrNull } from '../billing/billing-stripe-client.js';

function stripeClient() {
  return getStripeBillingClientOrNull();
}

export async function queryRevenueSummary() {
  const result = await pool.query(
    `SELECT
       COALESCE(SUM(monthly_amount_pence) FILTER (WHERE status IN ('active', 'past_due')), 0)::int AS mrr,
       COUNT(*)::int AS total_workspaces,
       COUNT(*) FILTER (WHERE status = 'trialing')::int AS trial_count,
       COUNT(*) FILTER (WHERE status = 'active')::int AS active_count,
       COUNT(*) FILTER (WHERE status = 'past_due')::int AS past_due_count,
       COUNT(*) FILTER (WHERE status = 'suspended')::int AS suspended_count,
       COUNT(*) FILTER (WHERE status = 'cancelled')::int AS cancelled_count,
       COUNT(*) FILTER (WHERE created_at >= date_trunc('month', NOW()))::int AS new_this_month,
       COUNT(*) FILTER (WHERE status = 'cancelled' AND updated_at >= date_trunc('month', NOW()))::int AS churned_this_month
     FROM aiva_subscriptions`,
  );
  const row = result.rows[0] as Record<string, unknown>;
  const mrr = Number(row.mrr ?? 0);
  const active = Number(row.active_count ?? 0);
  const suspended = Number(row.suspended_count ?? 0);
  const cancelled = Number(row.cancelled_count ?? 0);
  const denom = active + suspended + cancelled;

  return {
    mrr,
    arr: mrr * 12,
    mrrFormatted: `£${(mrr / 100).toFixed(0)}`,
    arrFormatted: `£${((mrr * 12) / 100).toFixed(0)}`,
    trialCount: Number(row.trial_count ?? 0),
    activeCount: active,
    pastDueCount: Number(row.past_due_count ?? 0),
    suspendedCount: suspended,
    cancelledCount: cancelled,
    totalWorkspaces: Number(row.total_workspaces ?? 0),
    arpu: active > 0 ? Math.round(mrr / active) : 0,
    trialConversionRate: denom > 0 ? active / denom : 0,
    newThisMonth: Number(row.new_this_month ?? 0),
    churnedThisMonth: Number(row.churned_this_month ?? 0),
    atRiskCount: Number(row.past_due_count ?? 0) + suspended,
  };
}

export async function queryRevenueAtRisk() {
  const pastDue = await pool.query(
    `SELECT s.workspace_id, s.plan_tier, s.monthly_amount_pence, s.grace_period_ends_at,
            s.stripe_customer_id, c.owner_email, c.owner_name
     FROM aiva_subscriptions s
     LEFT JOIN aiva_workspace_contacts c ON c.workspace_id = s.workspace_id
     WHERE s.status = 'past_due'
     ORDER BY s.grace_period_ends_at ASC NULLS LAST`,
  );
  const trialExpiring = await pool.query(
    `SELECT s.workspace_id, s.trial_ends_at, c.owner_email, c.owner_name
     FROM aiva_subscriptions s
     LEFT JOIN aiva_workspace_contacts c ON c.workspace_id = s.workspace_id
     WHERE s.status = 'trialing' AND s.trial_ends_at < NOW() + INTERVAL '3 days'
     ORDER BY s.trial_ends_at ASC`,
  );
  const cancelling = await pool.query(
    `SELECT s.workspace_id, s.plan_tier, s.monthly_amount_pence, s.current_period_end,
            c.owner_email, c.owner_name
     FROM aiva_subscriptions s
     LEFT JOIN aiva_workspace_contacts c ON c.workspace_id = s.workspace_id
     WHERE s.cancel_at_period_end = true
     ORDER BY s.current_period_end ASC`,
  );

  const mapWs = (row: Record<string, unknown>, workspaceId: string) =>
    String(row.owner_name || row.owner_email || workspaceId).slice(0, 48);

  return {
    pastDue: pastDue.rows.map((row) => {
      const grace = row.grace_period_ends_at ? new Date(String(row.grace_period_ends_at)) : null;
      const graceDays = grace
        ? Math.max(0, Math.ceil((grace.getTime() - Date.now()) / 86_400_000))
        : 0;
      const workspaceId = String(row.workspace_id);
      return {
        workspaceId,
        workspaceName: mapWs(row as Record<string, unknown>, workspaceId),
        ownerEmail: row.owner_email ? String(row.owner_email) : null,
        planTier: String(row.plan_tier),
        monthlyAmountPence: Number(row.monthly_amount_pence ?? 0),
        gracePeriodEndsAt: grace?.toISOString() ?? null,
        graceDaysRemaining: graceDays,
        stripeCustomerId: row.stripe_customer_id ? String(row.stripe_customer_id) : null,
      };
    }),
    trialExpiringSoon: trialExpiring.rows.map((row) => {
      const trialEnds = row.trial_ends_at ? new Date(String(row.trial_ends_at)) : null;
      const workspaceId = String(row.workspace_id);
      return {
        workspaceId,
        workspaceName: mapWs(row as Record<string, unknown>, workspaceId),
        ownerEmail: row.owner_email ? String(row.owner_email) : null,
        trialEndsAt: trialEnds?.toISOString() ?? null,
        trialDaysRemaining: trialEnds
          ? Math.max(0, Math.ceil((trialEnds.getTime() - Date.now()) / 86_400_000))
          : 0,
      };
    }),
    cancellingAtPeriodEnd: cancelling.rows.map((row) => {
      const workspaceId = String(row.workspace_id);
      return {
        workspaceId,
        workspaceName: mapWs(row as Record<string, unknown>, workspaceId),
        ownerEmail: row.owner_email ? String(row.owner_email) : null,
        planTier: String(row.plan_tier),
        monthlyAmountPence: Number(row.monthly_amount_pence ?? 0),
        currentPeriodEnd: row.current_period_end
          ? new Date(String(row.current_period_end)).toISOString()
          : null,
      };
    }),
  };
}

export async function queryRevenueTimeline() {
  const result = await pool.query(
    `SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS month,
            COALESCE(SUM(amount_paid) FILTER (WHERE status = 'paid'), 0)::int AS mrr
     FROM aiva_invoices
     WHERE created_at >= NOW() - INTERVAL '12 months'
     GROUP BY 1
     ORDER BY 1 ASC`,
  );
  const months = result.rows.map((row) => ({
    month: String(row.month),
    mrr: Number(row.mrr ?? 0),
    newMrr: 0,
    churnedMrr: 0,
  }));
  while (months.length < 12) {
    const d = new Date();
    d.setMonth(d.getMonth() - (11 - months.length));
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!months.find((m) => m.month === key)) {
      months.unshift({ month: key, mrr: 0, newMrr: 0, churnedMrr: 0 });
    } else break;
  }
  return months.slice(-12);
}

export async function queryRevenueInvoices(params: {
  search?: string;
  status?: string;
  limit?: number;
}) {
  const limit = Math.min(100, params.limit ?? 50);
  const conditions = ['1=1'];
  const queryParams: unknown[] = [];
  let idx = 1;

  if (params.status && params.status !== 'all') {
    conditions.push(`i.status = $${idx++}`);
    queryParams.push(params.status);
  }
  if (params.search?.trim()) {
    conditions.push(
      `(c.owner_email ILIKE $${idx} OR c.owner_name ILIKE $${idx} OR i.stripe_invoice_id ILIKE $${idx})`,
    );
    queryParams.push(`%${params.search.trim()}%`);
    idx++;
  }

  const result = await pool.query(
    `SELECT i.id, i.workspace_id, i.stripe_invoice_id, i.amount_paid, i.currency,
            i.status, i.invoice_pdf_url, i.period_start, i.period_end, i.created_at,
            c.owner_email, c.owner_name, s.plan_tier
     FROM aiva_invoices i
     LEFT JOIN aiva_workspace_contacts c ON c.workspace_id = i.workspace_id
     LEFT JOIN aiva_subscriptions s ON s.workspace_id = i.workspace_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY i.created_at DESC
     LIMIT $${idx}`,
    [...queryParams, limit],
  );

  return result.rows.map((row) => {
    const workspaceId = String(row.workspace_id);
    return {
      id: String(row.id),
      stripeInvoiceId: String(row.stripe_invoice_id),
      workspaceId,
      workspaceName: String(row.owner_name || row.owner_email || workspaceId).slice(0, 48),
      ownerEmail: row.owner_email ? String(row.owner_email) : null,
      planTier: row.plan_tier ? String(row.plan_tier) : 'trial',
      amount: Number(row.amount_paid ?? 0),
      currency: String(row.currency ?? 'gbp'),
      status: String(row.status ?? 'unknown'),
      invoicePdfUrl: row.invoice_pdf_url ? String(row.invoice_pdf_url) : null,
      periodStart: row.period_start ? new Date(String(row.period_start)).toISOString() : null,
      periodEnd: row.period_end ? new Date(String(row.period_end)).toISOString() : null,
      createdAt: new Date(String(row.created_at)).toISOString(),
    };
  });
}

export async function issueRevenueRefund(input: {
  invoiceId: string;
  reason: 'duplicate' | 'fraudulent' | 'requested_by_customer';
  note: string;
}): Promise<{ stripeRefundId: string; amount: number }> {
  const stripe = stripeClient();
  if (!stripe) throw new Error('Stripe is not configured');

  const inv = await pool.query('SELECT * FROM aiva_invoices WHERE id = $1', [input.invoiceId]);
  const row = inv.rows[0] as Record<string, unknown> | undefined;
  if (!row) throw new Error('Invoice not found');
  if (String(row.status) !== 'paid') throw new Error('Only paid invoices can be refunded');

  const stripeInvoice = await stripe.invoices.retrieve(String(row.stripe_invoice_id));
  const legacyInvoice = stripeInvoice as Stripe.Invoice & { payment_intent?: string | Stripe.PaymentIntent | null };
  const paymentIntent =
    typeof legacyInvoice.payment_intent === 'string'
      ? legacyInvoice.payment_intent
      : legacyInvoice.payment_intent?.id;
  if (!paymentIntent) throw new Error('No payment intent on invoice');

  const refund = await stripe.refunds.create({
    payment_intent: paymentIntent,
    reason: input.reason,
    metadata: { note: input.note.slice(0, 200) },
  });

  await pool.query(`UPDATE aiva_invoices SET status = 'refunded' WHERE id = $1`, [input.invoiceId]);

  return {
    stripeRefundId: refund.id,
    amount: Number(row.amount_paid ?? 0),
  };
}

export async function queryTierBreakdown() {
  const result = await pool.query(
    `SELECT plan_tier, COUNT(*)::int AS count,
            COALESCE(SUM(monthly_amount_pence) FILTER (WHERE status IN ('active', 'past_due')), 0)::int AS mrr
     FROM aiva_subscriptions
     GROUP BY plan_tier`,
  );
  const tierCounts: Record<string, number> = {};
  const tierMrr: Record<string, number> = {};
  for (const row of result.rows) {
    const tier = String(row.plan_tier);
    tierCounts[tier] = Number(row.count ?? 0);
    tierMrr[tier] = Number(row.mrr ?? 0);
  }
  return { tierCounts, tierMrr };
}
