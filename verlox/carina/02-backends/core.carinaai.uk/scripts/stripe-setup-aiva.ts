/**
 * Create Stripe products and prices for Aiva billing tiers.
 * Run: STRIPE_SECRET_KEY=sk_test_... tsx scripts/stripe-setup-aiva.ts
 *
 * Prints env vars to add to core .env:
 *   STRIPE_PRICE_AIVA_STARTER_MONTHLY / _ANNUAL
 *   STRIPE_PRICE_AIVA_GROWTH_MONTHLY / _ANNUAL
 *   STRIPE_PRICE_AIVA_SEAT_MONTHLY (per extra AI Employee)
 *
 * Legacy env keys (team, business) are still accepted by the billing layer for
 * grandfathered subscriptions. Do not create new business-tier prices.
 */
import Stripe from 'stripe';

const secret = process.env.STRIPE_SECRET_KEY?.trim();
if (!secret) {
  console.error('Set STRIPE_SECRET_KEY');
  process.exit(1);
}

const stripe = new Stripe(secret);

const TIERS = [
  {
    id: 'starter',
    name: 'Aiva Starter',
    employees: 2,
    tasks: '1,000',
    monthly: 14900,
    annual: 149000,
  },
  {
    id: 'growth',
    name: 'Aiva Growth',
    employees: 5,
    tasks: '10,000',
    monthly: 34900,
    annual: 349000,
  },
] as const;

async function main(): Promise<void> {
  const product = await stripe.products.create({
    name: 'Carina Aiva',
    description: 'AI Employees with built-in Scout governance',
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
    console.log(`# ${tier.name} (${tier.employees} AI Employee(s), ${tier.tasks} tasks/mo)`);
    console.log(`STRIPE_PRICE_AIVA_${key}_MONTHLY=${monthly.id}`);
    console.log(`STRIPE_PRICE_AIVA_${key}_ANNUAL=${annual.id}`);
    console.log('');
  }

  const seat = await stripe.prices.create({
    product: product.id,
    unit_amount: 4900,
    currency: 'gbp',
    recurring: { interval: 'month', usage_type: 'licensed' },
    metadata: { product: 'aiva', plan: 'seat', interval: 'month' },
    nickname: 'Aiva AI Employee seat (monthly)',
  });

  console.log('# Additional AI Employee beyond tier limit (£49/mo per seat)');
  console.log(`STRIPE_PRICE_AIVA_SEAT_MONTHLY=${seat.id}`);
  console.log('');
  console.log('# Webhook (Aiva): https://core.carinaai.uk/webhooks/stripe');
  console.log('# Legacy alias also accepted: https://core.carinaai.uk/api/billing/stripe/webhook');
  console.log('# Local test: stripe listen --forward-to localhost:3000/webhooks/stripe');
  console.log('# Enable UK VAT and customer portal in Stripe Dashboard after test checkout.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
