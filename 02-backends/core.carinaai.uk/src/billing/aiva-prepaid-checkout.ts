import { pool } from '../memory/db.js';
import { refreshBillingConfigCache, resolveConfigValue } from './billing-config.js';
import {
  getStripeBillingClient,
  resolveStripeSecretKey,
} from './billing-stripe-client.js';
import {
  AIVA_PREPAID_PACKS,
  isAivaPrepaidPackId,
  listAivaPrepaidPacks,
  type AivaPrepaidPackId,
} from './aiva-prepaid-packs.js';

async function resolvePackPriceId(packId: AivaPrepaidPackId): Promise<string | null> {
  await refreshBillingConfigCache();
  const pack = AIVA_PREPAID_PACKS[packId];
  const value = resolveConfigValue(pack.priceConfigKey).trim();
  return value || null;
}

export async function createAivaPrepaidCheckoutSession(params: {
  workspaceId: string;
  packId: string;
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
}): Promise<{ url: string }> {
  if (process.env.AIVA_BILLING_ENABLED === 'false') {
    throw new Error('Paid billing is disabled.');
  }
  if (!isAivaPrepaidPackId(params.packId)) {
    throw new Error('Invalid prepaid pack');
  }

  const secret = resolveStripeSecretKey();
  if (!secret) {
    throw new Error('Stripe is not configured on this server. Set STRIPE_SECRET_KEY in Billing config or env.');
  }

  const priceId = await resolvePackPriceId(params.packId);
  if (!priceId) {
    throw new Error(`Stripe price not configured for prepaid pack ${params.packId}`);
  }

  const pack = AIVA_PREPAID_PACKS[params.packId];
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
    checkoutType: 'aiva_prepaid',
    workspaceId: params.workspaceId,
    packId: pack.id,
    messages: String(pack.messages),
    amountGbp: String(pack.amountGbp),
  };

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    ...(customerId ? { customer: customerId } : { customer_email: params.customerEmail }),
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    automatic_tax: { enabled: true },
    metadata,
  });

  if (!session.url) throw new Error('Stripe did not return a checkout URL');
  return { url: session.url };
}

export function publicAivaPrepaidPacks(): Array<{
  id: AivaPrepaidPackId;
  label: string;
  amountGbp: number;
  messages: number;
}> {
  return listAivaPrepaidPacks().map((pack) => ({
    id: pack.id,
    label: pack.label,
    amountGbp: pack.amountGbp,
    messages: pack.messages,
  }));
}
