export type BillingPlanId =
  | 'free'
  | 'carina_ops_starter'
  | 'carina_ops_team'
  | 'scout_monitor'
  | 'scout_pro'
  | 'scout_standard'
  | 'enterprise';

export interface BillingPlan {
  id: BillingPlanId;
  name: string;
  monthlyPriceGbp: number | null;
  tokenLimit: number | null;
  stripePriceEnv?: string;
  features: string[];
  highlight?: string;
}

export const BILLING_PLANS: Record<BillingPlanId, BillingPlan> = {
  free: {
    id: 'free',
    name: 'Carina Core',
    monthlyPriceGbp: 0,
    tokenLimit: 100_000,
    features: [
      'Full autonomous agent',
      'Memory and self-writing skills',
      'CLI, Telegram, WhatsApp, Web',
      'MIT open source',
    ],
  },
  carina_ops_starter: {
    id: 'carina_ops_starter',
    name: 'Carina Ops Starter',
    monthlyPriceGbp: 19,
    tokenLimit: 500_000,
    stripePriceEnv: 'STRIPE_PRICE_CARINA_OPS_STARTER',
    features: [
      'BYOK (3 providers)',
      'Workbench',
      '14-day audit log',
      'Ops console',
    ],
  },
  carina_ops_team: {
    id: 'carina_ops_team',
    name: 'Carina Ops Team',
    monthlyPriceGbp: 49,
    tokenLimit: 2_000_000,
    stripePriceEnv: 'STRIPE_PRICE_CARINA_OPS_TEAM',
    features: [
      'Everything in Starter',
      'Multi-user (50 members)',
      'Deployments and environments',
      '90-day audit log',
      'Exports',
    ],
  },
  scout_monitor: {
    id: 'scout_monitor',
    name: 'Scout Monitor',
    monthlyPriceGbp: 79,
    tokenLimit: 250_000,
    stripePriceEnv: 'STRIPE_PRICE_SCOUT_MONITOR',
    highlight: 'Visibility',
    features: [
      'Live security dashboard',
      'Prompt injection detection',
      '14-day audit log',
      'Event acknowledge in UI',
      'Browser dashboard alerts (SSE)',
    ],
  },
  scout_pro: {
    id: 'scout_pro',
    name: 'Scout Pro',
    monthlyPriceGbp: 99,
    tokenLimit: 500_000,
    stripePriceEnv: 'STRIPE_PRICE_SCOUT_PRO',
    highlight: 'Control',
    features: [
      'Everything in Monitor',
      'Kill switch and tool quarantine',
      'Outbound alerts (Telegram, email, Slack)',
      'Honeypots and moving-target deception',
      '90-day audit log and GDPR exports',
      'Public trust API',
    ],
  },
  scout_standard: {
    id: 'scout_standard',
    name: 'Scout Pro (legacy)',
    monthlyPriceGbp: 99,
    tokenLimit: 500_000,
    stripePriceEnv: 'STRIPE_PRICE_SCOUT_PRO',
    features: [
      'Legacy plan id; maps to Scout Pro',
    ],
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    monthlyPriceGbp: null,
    tokenLimit: null,
    stripePriceEnv: 'STRIPE_PRICE_ENTERPRISE',
    features: [
      'Everything in Scout Pro',
      'SOC2 readiness export (operator-provided; not a third-party audit)',
      '99.9% uptime SLA',
      'Dedicated Slack support',
      'On-premise deployment option',
    ],
  },
};

export const CARINA_OPS_CHECKOUT_PLANS: BillingPlanId[] = [
  'carina_ops_starter',
  'carina_ops_team',
];

export const CHECKOUT_PLANS: BillingPlanId[] = [
  'scout_monitor',
  'scout_pro',
  'enterprise',
  ...CARINA_OPS_CHECKOUT_PLANS,
];

export function normalizePlanId(value: unknown): BillingPlanId {
  if (value === 'carina_ops_starter' || value === 'carina_ops_team') return value;
  if (value === 'scout_monitor' || value === 'scout_pro' || value === 'enterprise') return value;
  if (value === 'scout_standard') return 'scout_pro';
  return 'free';
}

export function isCarinaOpsPlan(plan: BillingPlanId): boolean {
  return plan === 'carina_ops_starter' || plan === 'carina_ops_team';
}

export function isScoutPlan(plan: BillingPlanId): boolean {
  return plan === 'scout_monitor'
    || plan === 'scout_pro'
    || plan === 'scout_standard'
    || plan === 'enterprise';
}

export function isScoutProPlan(plan: BillingPlanId): boolean {
  return plan === 'scout_pro' || plan === 'scout_standard' || plan === 'enterprise';
}

export function planTier(plan: BillingPlanId): 'free' | 'pro' {
  return plan === 'free' ? 'free' : 'pro';
}

export function resolveStripePriceId(plan: BillingPlanId): string {
  const normalized = normalizePlanId(plan);
  const envKey = BILLING_PLANS[normalized].stripePriceEnv;
  if (!envKey) throw new Error(`Plan ${plan} does not use Stripe Checkout`);
  const priceId = process.env[envKey] ?? '';
  if (!priceId) {
    const legacy =
      normalized === 'scout_pro' ? process.env.STRIPE_PRICE_SCOUT_STANDARD ?? '' : '';
    if (legacy) return legacy;
    throw new Error(`Missing required env var: ${envKey}`);
  }
  return priceId;
}

export function planFromStripePriceId(priceId: string): BillingPlanId | null {
  for (const plan of Object.values(BILLING_PLANS)) {
    if (!plan.stripePriceEnv) continue;
    const configured = process.env[plan.stripePriceEnv] ?? '';
    if (configured && configured === priceId) return plan.id;
  }
  if (process.env.STRIPE_PRO_PRICE_ID === priceId) return 'scout_pro';
  if (process.env.STRIPE_PRICE_SCOUT_STANDARD === priceId) return 'scout_pro';
  return null;
}
