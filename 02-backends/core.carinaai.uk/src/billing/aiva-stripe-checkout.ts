import Stripe from 'stripe';
import { config } from '../config/index.js';
import { slotLimitForTier, type AivaCheckoutTier } from './aiva-tier.js';
import { pool } from '../memory/db.js';
import { refreshBillingConfigCache, resolveConfigValue } from './billing-config.js';

export { slotLimitForTier } from './aiva-tier.js';

function stripeClient(): Stripe {
  const secret = config.hosted.stripeSecretKey || process.env.STRIPE_SECRET_KEY || '';
  if (!secret) throw new Error('Stripe is not configured');
  return new Stripe(secret);
}

function priceIdForTier(tier: string, interval: 'month' | 'year'): string | null {
  const normalized = tier === 'team' ? 'growth' : tier;
  const keys = [
    `STRIPE_PRICE_AIVA_${normalized.toUpperCase()}_${interval === 'year' ? 'ANNUAL' : 'MONTHLY'}`,
  ];
  if (normalized === 'growth') {
    keys.push(`STRIPE_PRICE_AIVA_TEAM_${interval === 'year' ? 'ANNUAL' : 'MONTHLY'}`);
  }
  for (const key of keys) {
    const value = resolveConfigValue(key);
    if (value) return value;
  }
  return null;
}

async function priceIdForTierAsync(tier: string, interval: 'month' | 'year'): Promise<string | null> {
  await refreshBillingConfigCache();
  return priceIdForTier(tier, interval);
}

export async function createAivaCheckoutSession(params: {
  workspaceId: string;
  tier: AivaCheckoutTier | 'team' | 'business';
  interval: 'month' | 'year';
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
}): Promise<{ url: string }> {
  if (process.env.AIVA_BILLING_ENABLED === 'false') {
    throw new Error('Paid billing is disabled. Continue on the trial plan.');
  }

  const secret = config.hosted.stripeSecretKey || process.env.STRIPE_SECRET_KEY || '';
  if (!secret) {
    throw new Error('Stripe is not configured on this server. Set STRIPE_SECRET_KEY.');
  }

  const checkoutTier = params.tier === 'team' ? 'growth' : params.tier;
  const priceId = await priceIdForTierAsync(checkoutTier, params.interval);
  if (!priceId) {
    throw new Error(`Stripe price not configured for ${checkoutTier} ${params.interval}`);
  }

  const stripe = stripeClient();
  const subRow = await pool.query(
    'SELECT stripe_customer_id FROM aiva_subscriptions WHERE workspace_id = $1',
    [params.workspaceId],
  );
  let customerId = subRow.rows[0]?.stripe_customer_id as string | null;

  if (!customerId && params.customerEmail) {
    const customer = await stripe.customers.create({
      email: params.customerEmail,
      metadata: { workspaceId: params.workspaceId, product: 'aiva' },
    });
    customerId = customer.id;
    await pool.query(
      `UPDATE aiva_subscriptions SET stripe_customer_id = $2, updated_at = NOW()
       WHERE workspace_id = $1`,
      [params.workspaceId, customerId],
    );
  }

  const metadata = {
    product: 'aiva',
    workspaceId: params.workspaceId,
    plan: checkoutTier,
    planName: `Aiva ${checkoutTier.charAt(0).toUpperCase()}${checkoutTier.slice(1)}`,
    interval: params.interval,
  };

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    ...(customerId ? { customer: customerId } : { customer_email: params.customerEmail }),
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    allow_promotion_codes: true,
    automatic_tax: { enabled: true },
    metadata,
    subscription_data: { metadata },
  });

  if (!session.url) throw new Error('Stripe did not return a checkout URL');
  return { url: session.url };
}

export async function createAivaPortalSession(params: {
  workspaceId: string;
  returnUrl: string;
}): Promise<{ url: string }> {
  if (process.env.AIVA_BILLING_ENABLED === 'false') {
    throw new Error('Paid billing is disabled.');
  }

  const secret = config.hosted.stripeSecretKey || process.env.STRIPE_SECRET_KEY || '';
  if (!secret) {
    throw new Error('Stripe is not configured on this server. Set STRIPE_SECRET_KEY.');
  }

  const stripe = stripeClient();
  const subRow = await pool.query(
    'SELECT stripe_customer_id FROM aiva_subscriptions WHERE workspace_id = $1',
    [params.workspaceId],
  );
  const customerId = subRow.rows[0]?.stripe_customer_id as string | null;
  if (!customerId) throw new Error('No Stripe customer for this workspace');

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: params.returnUrl,
  });
  return { url: session.url };
}
