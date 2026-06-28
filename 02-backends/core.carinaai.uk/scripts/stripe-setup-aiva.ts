/**
 * Create Stripe products and prices for Aiva billing tiers.
 * Run: STRIPE_SECRET_KEY=sk_... tsx scripts/stripe-setup-aiva.ts
 *
 * Prints env vars to add to core .env:
 *   STRIPE_PRICE_AIVA_STARTER_MONTHLY
 *   STRIPE_PRICE_AIVA_STARTER_ANNUAL
 *   STRIPE_PRICE_AIVA_TEAM_MONTHLY
 *   STRIPE_PRICE_AIVA_TEAM_ANNUAL
 *   STRIPE_PRICE_AIVA_BUSINESS_MONTHLY
 *   STRIPE_PRICE_AIVA_BUSINESS_ANNUAL
 */
import Stripe from 'stripe';

const secret = process.env.STRIPE_SECRET_KEY?.trim();
if (!secret) {
  console.error('Set STRIPE_SECRET_KEY');
  process.exit(1);
}

const stripe = new Stripe(secret);

const TIERS = [
  { id: 'starter', name: 'Aiva Starter', slots: 1, messages: '2,000', monthly: 2900, annual: 29000 },
  { id: 'team', name: 'Aiva Team', slots: 5, messages: '10,000', monthly: 9900, annual: 99000 },
  { id: 'business', name: 'Aiva Business', slots: 'Unlimited', messages: 'Unlimited', monthly: 29900, annual: 299000 },
] as const;

async function main(): Promise<void> {
  const product = await stripe.products.create({
    name: 'Aiva',
    description: 'AI workers for customer conversations',
    metadata: { product: 'aiva' },
  });

  console.log(`Product: ${product.id}\n`);

  for (const tier of TIERS) {
    const monthly = await stripe.prices.create({
      product: product.id,
      unit_amount: tier.monthly,
      currency: 'gbp',
      recurring: { interval: 'month' },
      metadata: { product: 'aiva', plan: tier.id, interval: 'month' },
      nickname: `${tier.name} monthly`,
    });

    const annual = await stripe.prices.create({
      product: product.id,
      unit_amount: tier.annual,
      currency: 'gbp',
      recurring: { interval: 'year' },
      metadata: { product: 'aiva', plan: tier.id, interval: 'year' },
      nickname: `${tier.name} annual`,
    });

    const key = tier.id.toUpperCase();
    console.log(`# ${tier.name} (${tier.slots} Aiva(s), ${tier.messages} msgs/mo)`);
    console.log(`STRIPE_PRICE_AIVA_${key}_MONTHLY=${monthly.id}`);
    console.log(`STRIPE_PRICE_AIVA_${key}_ANNUAL=${annual.id}`);
    console.log('');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
