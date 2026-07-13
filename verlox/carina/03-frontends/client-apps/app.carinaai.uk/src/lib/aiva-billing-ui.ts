export type BillingState =
  | 'trial'
  | 'active'
  | 'past_due'
  | 'suspended'
  | 'expired'
  | 'trial_ended'
  | 'none';

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

export interface AivaTrialCredit {
  /** Messages used in the current trial / month window. */
  used: number;
  /** Included managed messages on trial (hard cap). */
  limit: number;
  remaining: number;
  percentUsed: number;
  /** Display-only GBP framing for the included trial allowance. */
  creditGbp: number;
}

export interface AivaWalletView {
  remainingPence: number;
  remainingGbp: number;
  trialGrantedPence: number;
  purchasedPence: number;
  debitedPence: number;
  lowCredit: boolean;
  exhausted: boolean;
  byokActive: boolean;
}

export interface AivaAgentLimitsView {
  period: 'day' | 'month';
  maxCalls: number | null;
  maxTokens: number | null;
  usedCalls: number;
  usedTokens: number;
  remainingCalls: number | null;
  remainingTokens: number | null;
  custom: boolean;
}

export interface AivaPrepaidBalance {
  remainingMessages: number;
  remainingGbp: number;
  packs: Array<{
    id: string;
    label: string;
    amountGbp: number;
    messages: number;
  }>;
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
  trialCredit: AivaTrialCredit | null;
  wallet: AivaWalletView;
  agentLimits: AivaAgentLimitsView | null;
  prepaid: AivaPrepaidBalance;
  planTier: string;
  rawStatus: string;
  stripeCustomerId: string | null;
  softWall: boolean;
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

/** Annual = 20% off (matches core ANNUAL_BILLING_DISCOUNT_PERCENT). */
function annualMonthlyFromList(monthlyPence: number): number {
  return Math.round(monthlyPence * 0.8);
}

export const AIVA_TRIAL_CREDIT_GBP = 1;

export const AIVA_PLANS: AivaPlanDefinition[] = [
  {
    key: 'starter',
    label: 'Starter',
    tagline: 'Managed tokens. We handle the keys.',
    monthlyPence: 4900,
    annualMonthlyPence: annualMonthlyFromList(4900),
    features: [
      '1 AI Employee',
      'Managed AI usage included',
      'Web + messaging channels',
      'Scout Monitor included',
      'Email support',
    ],
  },
  {
    key: 'growth',
    label: 'Team',
    tagline: 'Scale your AI team',
    monthlyPence: 9900,
    annualMonthlyPence: annualMonthlyFromList(9900),
    badge: 'Most popular',
    features: [
      'Up to 5 AI Employees',
      'Higher managed message allowance',
      'Scout Govern included',
      'Priority support',
      'Extra seats £49/mo each',
    ],
  },
  {
    key: 'business',
    label: 'Business',
    tagline: 'Higher limits and governance',
    monthlyPence: 19900,
    annualMonthlyPence: annualMonthlyFromList(19900),
    features: [
      'Unlimited AI Employees',
      'Highest managed allowance',
      'Scout Team included',
      'Advanced approval workflow',
      'Priority support',
    ],
  },
];

export const AIVA_BYOK_PLAN: AivaPlanDefinition = {
  key: 'starter',
  label: 'BYOK (self-managed)',
  tagline: 'Free platform access. You pay your AI provider.',
  monthlyPence: 0,
  annualMonthlyPence: 0,
  features: [
    'Full Aiva product access',
    'Connect your OpenAI or Anthropic key',
    'No managed token cost to VERLOX',
    'Upgrade anytime for managed usage',
  ],
};

export const AIVA_BILLING_FOOTER =
  'Hire an Aiva. Powered by Carina. Governed by Scout. Human backup for visible escalations.';

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

export function buildTrialCredit(usage: {
  messageCount: number;
  messageLimit: number | null;
  creditGbp?: number;
}): AivaTrialCredit | null {
  const limit = usage.messageLimit;
  if (limit === null || limit === undefined || !Number.isFinite(limit) || limit <= 0) {
    return null;
  }
  const used = Math.max(0, usage.messageCount);
  const remaining = Math.max(0, limit - used);
  const creditGbp =
    usage.creditGbp !== undefined && Number.isFinite(usage.creditGbp)
      ? Number(usage.creditGbp)
      : AIVA_TRIAL_CREDIT_GBP;
  return {
    used,
    limit,
    remaining,
    percentUsed: Math.min(100, Math.round((used / limit) * 100)),
    creditGbp,
  };
}

export function mapAivaBillingStatus(
  statusPayload: Record<string, unknown> | null,
  invoices: AivaBillingInvoice[],
): AivaBillingViewModel {
  const subscription = (statusPayload?.subscription ?? statusPayload ?? {}) as Record<string, unknown>;
  const usagePayload = (statusPayload?.usage ?? {}) as Record<string, unknown>;
  const planTier = String(subscription.planTier ?? statusPayload?.planTier ?? 'trial');
  const rawStatus = String(subscription.status ?? statusPayload?.status ?? 'none');
  const trialDays = statusPayload?.trialDaysRemaining;
  const trialDaysNum =
    trialDays === null || trialDays === undefined ? null : Number(trialDays);

  let state: BillingState = 'none';
  if (rawStatus === 'trial_ended' || (rawStatus === 'suspended' && planTier === 'trial')) {
    state = 'trial_ended';
  } else if (rawStatus === 'trialing' || planTier === 'trial') {
    state = trialDaysNum !== null && trialDaysNum <= 0 ? 'trial_ended' : 'trial';
  } else if (rawStatus === 'active') state = 'active';
  else if (rawStatus === 'past_due') state = 'past_due';
  else if (rawStatus === 'suspended') state = 'suspended';
  else if (rawStatus === 'cancelled') state = 'expired';

  const usage = {
    messageCount: Number(usagePayload.messageCount ?? statusPayload?.count ?? 0),
    messageLimit:
      usagePayload.messageLimit === null || usagePayload.messageLimit === undefined
        ? null
        : Number(usagePayload.messageLimit),
    usagePercent: Number(usagePayload.usagePercent ?? 0),
    resetsAt: usagePayload.resetsAt ? String(usagePayload.resetsAt) : null,
  };

  const trialCredit =
    state === 'trial' || state === 'trial_ended'
      ? buildTrialCredit({
          ...usage,
          creditGbp:
            usagePayload.trialCreditGbp !== undefined
              ? Number(usagePayload.trialCreditGbp)
              : AIVA_TRIAL_CREDIT_GBP,
        })
      : null;

  const prepaidPayload = (statusPayload?.prepaid ?? {}) as Record<string, unknown>;
  const prepaidPacks = Array.isArray(prepaidPayload.packs)
    ? (prepaidPayload.packs as Array<Record<string, unknown>>).map((pack) => ({
        id: String(pack.id ?? ''),
        label: String(pack.label ?? ''),
        amountGbp: Number(pack.amountGbp ?? 0),
        messages: Number(pack.messages ?? 0),
      }))
    : [
        { id: 'gbp5', label: '£5', amountGbp: 5, messages: 100 },
        { id: 'gbp10', label: '£10', amountGbp: 10, messages: 200 },
        { id: 'gbp25', label: '£25', amountGbp: 25, messages: 500 },
      ];
  const prepaid: AivaPrepaidBalance = {
    remainingMessages: Math.max(0, Number(prepaidPayload.remainingMessages ?? 0)),
    remainingGbp: Math.max(0, Number(prepaidPayload.remainingGbp ?? 0)),
    packs: prepaidPacks.filter((pack) => pack.id),
  };

  const walletPayload = (statusPayload?.wallet ?? {}) as Record<string, unknown>;
  const walletRemainingPence = Number(
    walletPayload.remainingPence
      ?? usagePayload.walletRemainingPence
      ?? subscription.walletRemainingPence
      ?? 0,
  );
  const wallet: AivaWalletView = {
    remainingPence: Math.max(0, walletRemainingPence),
    remainingGbp: Math.max(
      0,
      Number(walletPayload.remainingGbp ?? usagePayload.walletRemainingGbp ?? walletRemainingPence / 100),
    ),
    trialGrantedPence: Math.max(0, Number(walletPayload.trialGrantedPence ?? 0)),
    purchasedPence: Math.max(0, Number(walletPayload.purchasedPence ?? 0)),
    debitedPence: Math.max(0, Number(walletPayload.debitedPence ?? 0)),
    lowCredit: Boolean(walletPayload.lowCredit ?? usagePayload.walletLowCredit),
    exhausted: Boolean(walletPayload.exhausted ?? usagePayload.walletExhausted),
    byokActive: Boolean(subscription.byokActive ?? statusPayload?.byokActive),
  };

  const softWall =
    (state === 'trial_ended'
      || (state === 'trial' && (
        (trialCredit !== null && trialCredit.remaining <= 0)
        || wallet.exhausted
      )))
    && prepaid.remainingMessages <= 0
    && !wallet.byokActive;

  const paidPlan = state === 'trial' || state === 'trial_ended' ? null : normalizePaidPlan(planTier);

  const agentLimitsPayload = (statusPayload?.agentLimits ?? null) as Record<string, unknown> | null;
  const agentLimits: AivaAgentLimitsView | null = agentLimitsPayload
    ? {
        period: agentLimitsPayload.period === 'day' ? 'day' : 'month',
        maxCalls:
          agentLimitsPayload.maxCalls === null || agentLimitsPayload.maxCalls === undefined
            ? null
            : Number(agentLimitsPayload.maxCalls),
        maxTokens:
          agentLimitsPayload.maxTokens === null || agentLimitsPayload.maxTokens === undefined
            ? null
            : Number(agentLimitsPayload.maxTokens),
        usedCalls: Number(agentLimitsPayload.usedCalls ?? 0),
        usedTokens: Number(agentLimitsPayload.usedTokens ?? 0),
        remainingCalls:
          agentLimitsPayload.remainingCalls === null || agentLimitsPayload.remainingCalls === undefined
            ? null
            : Number(agentLimitsPayload.remainingCalls),
        remainingTokens:
          agentLimitsPayload.remainingTokens === null
            || agentLimitsPayload.remainingTokens === undefined
            ? null
            : Number(agentLimitsPayload.remainingTokens),
        custom: Boolean(agentLimitsPayload.custom),
      }
    : null;

  return {
    state,
    plan: paidPlan,
    trialEndsAt: subscription.trialEndsAt ? String(subscription.trialEndsAt) : null,
    currentPeriodEnd: subscription.currentPeriodEnd ? String(subscription.currentPeriodEnd) : null,
    invoices,
    usage,
    trialCredit,
    wallet,
    agentLimits,
    prepaid,
    planTier,
    rawStatus,
    stripeCustomerId: subscription.stripeCustomerId
      ? String(subscription.stripeCustomerId)
      : statusPayload?.stripeCustomerId
        ? String(statusPayload.stripeCustomerId)
        : null,
    softWall,
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
    const annualTotal = api.annualAmountPence ?? Math.round(monthly * 12 * 0.8);
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
