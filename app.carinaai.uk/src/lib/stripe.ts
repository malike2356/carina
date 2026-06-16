import Stripe from 'stripe';

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }
  if (!stripeClient) {
    stripeClient = new Stripe(key);
  }
  return stripeClient;
}

export function stripePriceId(plan: 'starter' | 'team'): string {
  if (plan === 'starter') {
    const id = process.env.STRIPE_PRICE_CARINA_OPS_STARTER ?? process.env.STRIPE_PRICE_STARTER;
    if (!id) throw new Error('STRIPE_PRICE_CARINA_OPS_STARTER is not configured');
    return id;
  }
  const id = process.env.STRIPE_PRICE_CARINA_OPS_TEAM ?? process.env.STRIPE_PRICE_TEAM;
  if (!id) throw new Error('STRIPE_PRICE_CARINA_OPS_TEAM is not configured');
  return id;
}
