export type BillingState = 'trial' | 'active' | 'past_due' | 'suspended' | 'expired' | 'none';

export type PaidPlan = 'starter' | 'team' | 'business';

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
    tagline: 'One Aiva, always on',
    monthlyPence: 4900,
    annualMonthlyPence: 3267,
    features: [
      '1 Aiva worker',
      '2 channels (web + 1)',
      '2,000 messages / mo',
      'Basic analytics',
      'Email support',
    ],
  },
  {
    key: 'team',
    label: 'Team',
    tagline: 'Grow your AI team',
    monthlyPence: 9900,
    annualMonthlyPence: 6600,
    badge: 'Most popular',
    features: [
      'Up to 5 Aivas',
      'All channels',
      '10,000 messages / mo',
      'Full analytics + heatmap',
      'VA escalation queue',
      'Priority support',
    ],
  },
  {
    key: 'business',
    label: 'Business',
    tagline: 'Unlimited Aivas, dedicated support',
    monthlyPence: 29900,
    annualMonthlyPence: 19933,
    features: [
      'Unlimited Aivas',
      'All channels',
      'Unlimited messages',
      'Custom Aiva training (documents and FAQs)',
      'Custom Scout governance rules',
      'White-label widget and custom domain',
      'On-chain attestation export',
      'Dedicated account manager',
    ],
  },
];

export const AIVA_BILLING_FOOTER =
  'Hire an Aiva. Powered by Carina. Governed by Scout. Backed by real humans.';

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

  const paidPlan: PaidPlan | null =
    planTier === 'starter' || planTier === 'team' || planTier === 'business' ? planTier : null;

  return {
    state,
    plan: state === 'trial' ? null : paidPlan,
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
    const api = apiPlans.find((row) => row.tier === plan.key);
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
