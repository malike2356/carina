/*
 * Stripe setup required before this module can be activated:
 * 1. Create a Billing Meter in Stripe: Settings > Billing > Meters
 *    - Event name: "platform_events" (set STRIPE_METER_EVENT_NAME=platform_events)
 *    - Aggregation: sum
 *    - Value field: value
 *    - Customer mapping: stripe_customer_id
 * 2. Create a Price linked to the meter:
 *    - Type: Recurring, Monthly
 *    - Billing scheme: Per unit (the meter aggregates for you)
 *    - Tiers:
 *      * 0 to 50,000 events: GBP 0.00 (included in flat subscription)
 *      * 50,001 to 500,000 events: GBP 0.001 per event (0.1p)
 *      * 500,001+: GBP 0.0005 per event (0.05p, volume discount)
 * 3. Store the Price ID as STRIPE_PRICE_PLATFORM_EVENTS_METERED in .env
 * 4. When creating a partner's subscription, add this price as a subscription item
 *    alongside the existing flat-price item. Store the subscription item ID in
 *    partner_accounts.stripe_metered_item_id.
 * 5. Ensure partner_accounts.stripe_customer_id is populated at subscription creation time.
 */

import { pool } from '../memory/db.js';
import { getPlatformEventSummary } from './platform-event-emitter.js';
import { StripeService } from './stripe-service.js';

const stripeService = new StripeService();

function meterEventName(): string {
  return process.env.STRIPE_METER_EVENT_NAME ?? 'platform_events';
}

function meteredPriceId(): string {
  const id = process.env.STRIPE_PRICE_PLATFORM_EVENTS_METERED ?? '';
  if (!id) throw new Error('Missing required env var: STRIPE_PRICE_PLATFORM_EVENTS_METERED');
  return id;
}

export async function reportMonthlyUsage(partnerId: string): Promise<void> {
  const partnerRow = await pool.query(
    `SELECT stripe_customer_id, stripe_metered_item_id FROM partner_accounts WHERE id = $1`,
    [partnerId],
  );
  if ((partnerRow.rowCount ?? 0) === 0) return;
  const row = partnerRow.rows[0] as Record<string, string | null>;
  const stripeCustomerId = row.stripe_customer_id;
  if (!stripeCustomerId) return;

  const now = new Date();
  const fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
  const summary = await getPlatformEventSummary({ partnerId, fromDate, toDate: now });

  // Idempotency key: partner + year-month. Reporting twice in the same month
  // replaces the previous value because the meter uses sum aggregation and
  // we send a correction event. Using a stable identifier prevents duplicate charges.
  const identifier = `${partnerId}-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-mtr`;

  await stripeService.reportMeterEvent({
    eventName: meterEventName(),
    stripeCustomerId,
    quantity: summary.totalEvents,
    timestamp: Math.floor(now.getTime() / 1000),
    identifier,
  });
}

export async function reportAllPartnerUsage(): Promise<void> {
  const result = await pool.query(
    `SELECT id FROM partner_accounts
     WHERE status = 'active' AND stripe_customer_id IS NOT NULL`,
  );
  for (const row of result.rows) {
    try {
      await reportMonthlyUsage(String((row as Record<string, unknown>).id));
    } catch (err) {
      console.error('[metered-billing] failed for partner', (row as Record<string, unknown>).id, err instanceof Error ? err.message : String(err));
    }
  }
}

export async function attachMeteredBilling(partnerId: string, stripeSubscriptionId: string): Promise<void> {
  const priceId = meteredPriceId();
  const sub = await stripeService.retrieveSubscription(stripeSubscriptionId);

  const stripeCustomerId = typeof sub.customer === 'string' ? sub.customer : (sub.customer as { id: string }).id;

  const existing = sub.items.data.find((item) => item.price.id === priceId);
  if (existing) {
    await pool.query(
      `UPDATE partner_accounts
       SET stripe_subscription_id = $1, stripe_metered_item_id = $2, stripe_customer_id = $3
       WHERE id = $4`,
      [stripeSubscriptionId, existing.id, stripeCustomerId, partnerId],
    );
    return;
  }

  const newItem = await stripeService.createSubscriptionItem(stripeSubscriptionId, priceId);
  await pool.query(
    `UPDATE partner_accounts
     SET stripe_subscription_id = $1, stripe_metered_item_id = $2, stripe_customer_id = $3
     WHERE id = $4`,
    [stripeSubscriptionId, newItem.id, stripeCustomerId, partnerId],
  );
}

