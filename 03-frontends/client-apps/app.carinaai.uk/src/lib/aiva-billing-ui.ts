export type BillingState = 'trial' | 'active' | 'past_due' | 'suspended' | 'expired' | 'none';

export type PaidPlan = 'starter' | 'growth' | 'team' | 'business';

export interface AivaBillingInvoice {
  id: string;
  number: string;
  amount: number;
  currency: string;
  status: 'paid' | 'open' | 'void' | 'uncollectible';
  createdAt: string;
  pdfUrl: string | null;
}

export interface AivaBillingViewModel {
  state: BillingState;
  plan: PaidPlan | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  invoices: AivaBillingInvoice[];
  usage: {
    messageCount: number;
    messageLimit: number | null;
    usagePercent: number;
    resetsAt: string | null;
  };
  planTier: string;
  rawStatus: string;
  stripeCustomerId: string | null;
}

export interface AivaPlanDefinition {
  key: PaidPlan;
  label: string;
  tagline: string;
  monthlyPence: number;
  annualMonthlyPence: number;
  features: string[];
  badge?: string;
}

export const AIVA_PLANS: AivaPlanDefinition[] = [
  {
    key: 'starter',
    label: 'Starter',
    tagline: 'One AI Employee, always on',
    monthlyPence: 14900,
    annualMonthlyPence: 12417,
    features: [
      '1 AI Employee',
      '3 channel integrations',
      '1,000 tasks / mo',
      'Scout Govern included',
      'Basic approval workflow',
      'Email support',
    ],
  },
  {
    key: 'growth',
    label: 'Growth',
    tagline: 'Scale your AI team',
    monthlyPence: 34900,
    annualMonthlyPence: 29083,
    badge: 'Most popular',
    features: [
      '5 AI Employees',
      '10 channel integrations',
      '10,000 tasks / mo',
      'Scout Govern included',
      'Advanced approval workflow',
      'Priority support',
      'Extra seats £49/mo each',
    ],
  },
];

export const AIVA_BILLING_FOOTER =
  'Hire an Aiva. Powered by Carina. Governed by Scout. Backed by real humans.';

function normalizePaidPlan(planTier: string): PaidPlan | null {
  if (planTier === 'team') return 'growth';
  if (planTier === 'starter' || planTier === 'growth' || planTier === 'business') return planTier;
  return null;
}

function normalizeInvoiceStatus(status: string): AivaBillingInvoice['status'] {
  if (status === 'paid' || status === 'open' || status === 'void' || status === 'uncollectible') {
    return status;
  }
  return 'open';
}

export function mapInvoiceRows(
  rows: Array<{
    stripeInvoiceId?: string;
    id?: string;
    amountPaid?: number;
    currency?: string;
    status?: string;
    createdAt?: string;
    invoicePdfUrl?: string | null;
  }>,
): AivaBillingInvoice[] {
  return rows.map((row) => ({
    id: String(row.stripeInvoiceId ?? row.id ?? ''),
    number: String(row.stripeInvoiceId ?? row.id ?? '').slice(-8).toUpperCase(),
    amount: Number(row.amountPaid ?? 0),
    currency: String(row.currency ?? 'gbp'),
    status: normalizeInvoiceStatus(String(row.status ?? 'open')),
    createdAt: String(row.createdAt ?? new Date().toISOString()),
    pdfUrl: row.invoicePdfUrl ?? null,
  }));
}

export function mapAivaBillingStatus(
  statusPayload: Record<string, unknown> | null,
  invoices: AivaBillingInvoice[],
): AivaBillingViewModel {
  const subscription = (statusPayload?.subscription ?? statusPayload ?? {}) as Record<string, unknown>;
  const usagePayload = (statusPayload?.usage ?? {}) as Record<string, unknown>;
  const planTier = String(subscription.planTier ?? statusPayload?.planTier ?? 'trial');
  const rawStatus = String(subscription.status ?? statusPayload?.status ?? 'none');

  let state: BillingState = 'none';
  if (rawStatus === 'trialing' || planTier === 'trial') state = 'trial';
  else if (rawStatus === 'active') state = 'active';
  else if (rawStatus === 'past_due') state = 'past_due';
  else if (rawStatus === 'suspended') state = 'suspended';
  else if (rawStatus === 'cancelled') state = 'expired';

  const paidPlan = state === 'trial' ? null : normalizePaidPlan(planTier);

  return {
    state,
    plan: paidPlan,
    trialEndsAt: subscription.trialEndsAt ? String(subscription.trialEndsAt) : null,
    currentPeriodEnd: subscription.currentPeriodEnd ? String(subscription.currentPeriodEnd) : null,
    invoices,
    usage: {
      messageCount: Number(usagePayload.messageCount ?? statusPayload?.count ?? 0),
      messageLimit:
        usagePayload.messageLimit === null || usagePayload.messageLimit === undefined
          ? null
          : Number(usagePayload.messageLimit),
      usagePercent: Number(usagePayload.usagePercent ?? 0),
      resetsAt: usagePayload.resetsAt ? String(usagePayload.resetsAt) : null,
    },
    planTier,
    rawStatus,
    stripeCustomerId: subscription.stripeCustomerId
      ? String(subscription.stripeCustomerId)
      : statusPayload?.stripeCustomerId
        ? String(statusPayload.stripeCustomerId)
        : null,
  };
}

export function mergePlanPricing(
  plans: AivaPlanDefinition[],
  apiPlans: Array<{
    tier: string;
    monthlyAmountPence?: number | null;
    annualAmountPence?: number | null;
  }>,
): AivaPlanDefinition[] {
  return plans.map((plan) => {
    const api = apiPlans.find((row) => row.tier === plan.key || (row.tier === 'team' && plan.key === 'growth'));
    if (!api) return plan;
    const monthly = api.monthlyAmountPence ?? plan.monthlyPence;
    const annualTotal = api.annualAmountPence ?? plan.monthlyPence * 10;
    return {
      ...plan,
      monthlyPence: monthly,
      annualMonthlyPence: Math.round(annualTotal / 12),
    };
  });
}

export function trialDaysRemaining(trialEndsAt: string | null): number | null {
  if (!trialEndsAt) return null;
  const ms = new Date(trialEndsAt).getTime() - Date.now();
  return Math.ceil(ms / 86_400_000);
}
