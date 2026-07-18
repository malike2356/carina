import { slotLimitForTier, type AivaAssignableCheckoutTier } from './workspace-tier.js';
import { pool } from '../memory/db.js';
import { refreshBillingConfigCache, resolveConfigValue } from './billing-config.js';
import {
  getStripeBillingClient,
  resolveStripeSecretKey,
} from './billing-stripe-client.js';

export { slotLimitForTier } from './workspace-tier.js';

function priceIdForTier(tier: string, interval: 'month' | 'year'): string | null {
  const normalized = tier === 'growth' ? 'team' : tier;
  const keys = [
    `STRIPE_PRICE_AIVA_${normalized.toUpperCase()}_${interval === 'year' ? 'ANNUAL' : 'MONTHLY'}`,
  ];
  if (normalized === 'team') {
    keys.push(`STRIPE_PRICE_AIVA_GROWTH_${interval === 'year' ? 'ANNUAL' : 'MONTHLY'}`);
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

function planDisplayName(tier: string): string {
  if (tier === 'prompt_rate') return 'Aiva Prompt Rate';
  const label = tier.charAt(0).toUpperCase() + tier.slice(1);
  return `Aiva ${label}`;
}

export async function createAivaCheckoutSession(params: {
  workspaceId: string;
  tier: AivaAssignableCheckoutTier | 'growth';
  interval: 'month' | 'year';
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
}): Promise<{ url: string }> {
  if (process.env.AIVA_BILLING_ENABLED === 'false') {
    throw new Error('Paid billing is disabled. Continue on the trial plan.');
  }

  const secret = resolveStripeSecretKey();
  if (!secret) {
    throw new Error('Stripe is not configured on this server. Set STRIPE_SECRET_KEY in Billing config or env.');
  }

  const checkoutTier = params.tier === 'growth' ? 'team' : params.tier;
  if (checkoutTier === 'prompt_rate' && params.interval === 'year') {
    throw new Error('Prompt Rate is monthly only. Use interval=month.');
  }

  const priceId = await priceIdForTierAsync(checkoutTier, params.interval);
  if (!priceId) {
    throw new Error(`Stripe price not configured for ${checkoutTier} ${params.interval}`);
  }

  const stripe = getStripeBillingClient();
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
      `INSERT INTO aiva_subscriptions
         (workspace_id, plan_tier, status, aiva_slot_limit, stripe_customer_id, updated_at)
       VALUES ($1, 'trial', 'pending_channel', 1, $2, NOW())
       ON CONFLICT (workspace_id) DO UPDATE SET
         stripe_customer_id = EXCLUDED.stripe_customer_id,
         updated_at = NOW()`,
      [params.workspaceId, customerId],
    );
  }

  const metadata = {
    product: 'aiva',
    workspaceId: params.workspaceId,
    plan: checkoutTier,
    planName: planDisplayName(checkoutTier),
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

  const secret = resolveStripeSecretKey();
  if (!secret) {
    throw new Error('Stripe is not configured on this server. Set STRIPE_SECRET_KEY in Billing config or env.');
  }

  const stripe = getStripeBillingClient();
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
