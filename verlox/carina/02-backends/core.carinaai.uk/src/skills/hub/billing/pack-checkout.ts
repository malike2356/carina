import Stripe from 'stripe';
import { config } from '../../../config/index.js';
import {
  getStripeBillingClient,
  resolveStripeSecretKey,
  resolveStripeWebhookSecret,
} from '../../../billing/billing-stripe-client.js';
import { getHubPack } from '../registry.js';
import { grantPackLicense, type PackLicenseRecord } from '../pack-licenses.js';
import { hubPool } from '../migrations.js';

export interface PackCheckoutInput {
  packName: string;
  email: string;
  successUrl?: string;
  cancelUrl?: string;
}

export interface PackCheckoutResult {
  sessionId: string;
  url: string;
}

function stripeSecret(): string {
  return resolveStripeSecretKey();
}

function webhookSecret(): string {
  return resolveStripeWebhookSecret();
}

function resolvePackStripePriceId(packName: string, packStripePriceId: string | null): string | null {
  if (packStripePriceId) return packStripePriceId;
  const envKey = `STRIPE_PRICE_PACK_${packName.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
  return process.env[envKey] ?? null;
}

export async function createPackCheckoutSession(
  input: PackCheckoutInput,
  stripe?: Stripe,
): Promise<PackCheckoutResult> {
  const pack = await getHubPack(input.packName);
  if (!pack) throw new Error(`Pack not found: ${input.packName}`);
  if (pack.pricing_tier !== 'premium' || (pack.price_gbp_cents ?? 0) <= 0) {
    throw new Error(`Pack ${input.packName} is not a premium paid pack`);
  }

  const secret = stripeSecret();
  if (!secret && !stripe) {
    throw new Error('Missing required env var: HUB_STRIPE_SECRET_KEY or STRIPE_SECRET_KEY');
  }

  const client = stripe ?? new Stripe(secret);
  const priceId = resolvePackStripePriceId(pack.name, pack.stripe_price_id);
  const successUrl = input.successUrl ?? config.hub.checkoutSuccessUrl;
  const cancelUrl = input.cancelUrl ?? config.hub.checkoutCancelUrl;

  const session = await client.checkout.sessions.create({
    mode: 'payment',
    customer_email: input.email,
    success_url: `${successUrl}${successUrl.includes('?') ? '&' : '?'}pack=${encodeURIComponent(pack.name)}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${cancelUrl}${cancelUrl.includes('?') ? '&' : '?'}pack=${encodeURIComponent(pack.name)}`,
    line_items: priceId
      ? [{ price: priceId, quantity: 1 }]
      : [{
          price_data: {
            currency: 'gbp',
            unit_amount: pack.price_gbp_cents ?? 0,
            product_data: {
              name: `Carina Hub pack: ${pack.name}`,
              description: pack.description,
            },
          },
          quantity: 1,
        }],
    metadata: {
      checkoutType: 'hub_pack',
      packName: pack.name,
      packVersion: pack.version,
      purchaserEmail: input.email.toLowerCase(),
    },
  });

  if (!session.url) throw new Error('Stripe did not return a checkout URL');
  return { sessionId: session.id, url: session.url };
}

export async function recordPackSale(input: {
  packName: string;
  email: string;
  amountGbpCents: number;
  stripeSessionId: string;
}): Promise<void> {
  const pack = await getHubPack(input.packName);
  if (!pack) return;

  const existing = await hubPool.query(
    'SELECT 1 FROM pack_sales WHERE stripe_session_id = $1',
    [input.stripeSessionId],
  );
  if ((existing.rowCount ?? 0) > 0) return;

  await hubPool.query(
    `INSERT INTO pack_sales (
      pack_name, purchaser_email, amount_gbp_cents,
      author_share_bps, carina_share_bps, platform_fee_bps, stripe_session_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      input.packName,
      input.email.toLowerCase(),
      input.amountGbpCents,
      pack.author_revenue_share_bps,
      pack.carina_revenue_share_bps,
      pack.platform_fee_bps,
      input.stripeSessionId,
    ],
  );
}

export async function handlePackCheckoutCompleted(
  session: Stripe.Checkout.Session,
): Promise<PackLicenseRecord | null> {
  if (session.metadata?.checkoutType !== 'hub_pack') return null;
  const packName = session.metadata.packName;
  const email = session.metadata.purchaserEmail ?? session.customer_email ?? '';
  if (!packName || !email) return null;

  const amount = session.amount_total ?? 0;
  await recordPackSale({
    packName,
    email,
    amountGbpCents: amount,
    stripeSessionId: session.id,
  });

  return grantPackLicense({
    packName,
    email,
    stripeSessionId: session.id,
  });
}

export function constructPackWebhookEvent(
  payload: Buffer | string,
  signature: string,
  stripe?: Stripe,
): Stripe.Event {
  const secret = webhookSecret();
  if (!secret && !stripe) {
    throw new Error('Missing required env var: HUB_STRIPE_WEBHOOK_SECRET or STRIPE_WEBHOOK_SECRET');
  }
  const client = stripe ?? new Stripe(stripeSecret());
  return client.webhooks.constructEvent(payload, signature, secret);
}

export async function fulfillPackCheckoutSession(
  sessionId: string,
  stripe?: Stripe,
): Promise<PackLicenseRecord | null> {
  const secret = stripeSecret();
  if (!secret && !stripe) return null;
  const client = stripe ?? new Stripe(secret);
  const session = await client.checkout.sessions.retrieve(sessionId);
  if (session.payment_status !== 'paid') return null;
  return handlePackCheckoutCompleted(session);
}
