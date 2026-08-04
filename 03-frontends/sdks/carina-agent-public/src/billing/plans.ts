export type BillingPlanId = 'free' | 'scout_standard' | 'enterprise';

export interface BillingPlan {
  id: BillingPlanId;
  name: string;
  monthlyPriceGbp: number | null;
  tokenLimit: number | null;
  stripePriceEnv?: string;
  features: string[];
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
  scout_standard: {
    id: 'scout_standard',
    name: 'Labyrinth Scout',
    monthlyPriceGbp: 79,
    tokenLimit: 500_000,
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
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    monthlyPriceGbp: null,
    tokenLimit: null,
    stripePriceEnv: 'STRIPE_PRICE_ENTERPRISE',
    features: [
      'Everything in Scout',
      'SOC2 Type II attestation',
      '99.9% uptime SLA',
      'Dedicated Slack support',
      'On-premise deployment option',
    ],
  },
};

export function resolveStripePriceId(plan: BillingPlanId): string {
  const envKey = BILLING_PLANS[plan].stripePriceEnv;
  if (!envKey) throw new Error(`Plan ${plan} does not use Stripe Checkout`);
  const priceId = process.env[envKey] ?? '';
  if (!priceId) throw new Error(`Missing required env var: ${envKey}`);
  return priceId;
}
