export type BillingPlanId =
  | 'free'
  | 'scout_standard'
  | 'scout_monitor'
  | 'enterprise'
  | 'carina_ops_starter'
  | 'carina_ops_team'
  | 'scout_pro'
  | 'scout_team';

export interface BillingPlan {
  id: BillingPlanId;
  name: string;
  monthlyPriceGbp: number | null;
  tokenLimit: number | null;
  includedCredits: number | null;
  maxTopupCredits?: number | null;
  stripePriceEnv?: string;
  features: string[];
}

export const BILLING_PLANS: Record<BillingPlanId, BillingPlan> = {
  free: {
    id: 'free',
    name: 'Carina Core',
    monthlyPriceGbp: 0,
    tokenLimit: 100_000,
    includedCredits: null,
    features: [
      'Full autonomous agent',
      'Memory and self-writing skills',
      'CLI, Telegram, WhatsApp, Web',
      'MIT open source',
    ],
  },
  scout_standard: {
    id: 'scout_standard',
    name: 'Labyrinth Scout',
    monthlyPriceGbp: 79,
    tokenLimit: 500_000,
    includedCredits: null,
    stripePriceEnv: 'STRIPE_PRICE_SCOUT_STANDARD',
    features: [
      'Moving target deception',
      'Prompt injection shield',
      'Real-time security dashboard',
      'Multi-channel alerts',
      'Kill switch',
      'Full audit logs',
    ],
  },
  scout_monitor: {
    id: 'scout_monitor',
    name: 'Scout Monitor',
    monthlyPriceGbp: 99,
    tokenLimit: null,
    includedCredits: null,
    stripePriceEnv: 'STRIPE_PRICE_SCOUT_MONITOR',
    features: [
      'Real-time security monitoring',
      'Prompt injection detection',
      'Multi-channel alerts',
      'Kill switch',
    ],
  },
  scout_pro: {
    id: 'scout_pro',
    name: 'Scout Govern',
    monthlyPriceGbp: 199,
    tokenLimit: null,
    includedCredits: null,
    stripePriceEnv: 'STRIPE_PRICE_SCOUT_GOVERN',
    features: [
      'Everything in Scout Standard',
      'Governance controls',
      'Policy enforcement',
      'Compliance reporting',
      'Priority support',
    ],
  },
  scout_team: {
    id: 'scout_team',
    name: 'Scout Team',
    monthlyPriceGbp: 399,
    tokenLimit: null,
    includedCredits: null,
    stripePriceEnv: 'STRIPE_PRICE_SCOUT_TEAM',
    features: [
      'Everything in Scout Govern',
      'Team policy management',
      'Shared incident response',
      'Priority support',
    ],
  },
  carina_ops_starter: {
    id: 'carina_ops_starter',
    name: 'Carina Ops Starter',
    monthlyPriceGbp: 99,
    tokenLimit: null,
    includedCredits: 500_000,
    maxTopupCredits: 500_000,
    stripePriceEnv: 'STRIPE_PRICE_CARINA_OPS_STARTER',
    features: [
      'Up to 5 client workspaces',
      'Branded workspace shell',
      'Per-workspace usage reporting',
    ],
  },
  carina_ops_team: {
    id: 'carina_ops_team',
    name: 'Carina Ops Team',
    monthlyPriceGbp: 299,
    tokenLimit: null,
    includedCredits: 2_000_000,
    maxTopupCredits: 2_000_000,
    stripePriceEnv: 'STRIPE_PRICE_CARINA_OPS_TEAM',
    features: [
      'Up to 25 client workspaces',
      'Custom domains and sender identity',
      'Partner usage allocation dashboard',
    ],
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    monthlyPriceGbp: null,
    tokenLimit: null,
    includedCredits: null,
    stripePriceEnv: 'STRIPE_PRICE_ENTERPRISE',
    features: [
      'Everything in Scout',
      'SOC2 readiness export (not a third-party audit)',
      '99.9% uptime SLA',
      'Dedicated Slack support',
      'On-premise deployment option',
    ],
  },
};

export type CreditTopupPackId = 'small' | 'large';

export const CREDIT_TOPUP_PACKS: Record<CreditTopupPackId, { credits: number; priceEnv: string }> = {
  small: { credits: 500, priceEnv: 'STRIPE_PRICE_AIVA_TOPUP_SMALL' },
  large: { credits: 2500, priceEnv: 'STRIPE_PRICE_AIVA_TOPUP_LARGE' },
};

export const CARINA_OPS_CHECKOUT_PLANS: BillingPlanId[] = ['carina_ops_starter', 'carina_ops_team'];

export function isCarinaOpsPlan(plan: BillingPlanId): boolean {
  return plan === 'carina_ops_starter' || plan === 'carina_ops_team';
}

export function isScoutPlan(plan: BillingPlanId): boolean {
  return plan === 'scout_standard'
    || plan === 'scout_monitor'
    || plan === 'scout_pro'
    || plan === 'scout_team';
}

export function planTier(plan: BillingPlanId): string {
  if (plan === 'free') return 'free';
  if (isScoutPlan(plan)) return 'scout';
  if (isCarinaOpsPlan(plan)) return 'ops';
  if (plan === 'enterprise') return 'enterprise';
  return 'free';
}

export const DEFAULT_CREDIT_GBP_USD = 1.25;

export function resolveCreditUsdRate(planId: BillingPlanId): number {
  const override = Number(process.env.CREDIT_USD_RATE ?? '');
  if (Number.isFinite(override) && override > 0) return override;
  const plan = BILLING_PLANS[planId];
  if (!plan.monthlyPriceGbp || !plan.includedCredits) return 0;
  return (plan.monthlyPriceGbp * DEFAULT_CREDIT_GBP_USD) / plan.includedCredits;
}

export function resolveStripePriceId(plan: BillingPlanId | string): string {
  const normalized = normalizePlanId(plan);
  const envKey = BILLING_PLANS[normalized].stripePriceEnv;
  if (!envKey) throw new Error(`Plan ${plan} does not use Stripe Checkout`);
  const priceId = process.env[envKey] ?? '';
  if (!priceId) throw new Error(`Missing required env var: ${envKey}`);
  return priceId;
}

export function resolveTopupStripePriceId(packId: CreditTopupPackId): string {
  const envKey = CREDIT_TOPUP_PACKS[packId].priceEnv;
  const priceId = process.env[envKey] ?? '';
  if (!priceId) throw new Error(`Missing required env var: ${envKey}`);
  return priceId;
}

export async function planFromStripePriceIdAsync(priceId: string): Promise<BillingPlanId | null> {
  for (const [id, plan] of Object.entries(BILLING_PLANS)) {
    if (!plan.stripePriceEnv) continue;
    const envPriceId = process.env[plan.stripePriceEnv];
    if (envPriceId && envPriceId === priceId) return id as BillingPlanId;
  }
  return null;
}

export function normalizePlanId(value: unknown): BillingPlanId {
  if (value === 'scout_govern') return 'scout_pro';
  if (
    value === 'free' ||
    value === 'scout_standard' ||
    value === 'scout_monitor' ||
    value === 'enterprise' ||
    value === 'carina_ops_starter' ||
    value === 'carina_ops_team' ||
    value === 'scout_pro' ||
    value === 'scout_team'
  ) {
    return value;
  }
  return 'free';
}
