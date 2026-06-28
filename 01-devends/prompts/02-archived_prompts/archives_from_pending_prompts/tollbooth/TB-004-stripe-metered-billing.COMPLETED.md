# TB-004: Stripe Metered Billing for Platform Events

**Sprint:** Tollbooth platform infrastructure
**Phase:** 2 - Open the road to partners
**Depends on:** TB-001 (platform_events), TB-002 (partner keys)
**Target repo:** `02-backends/core.carinaai.uk`
**Agent:** Claude Code

---

## Context

The event schema (TB-001) and partner keys (TB-002) give us the ability to measure usage.
This sprint attaches Stripe metered billing so that measured usage generates invoices.

`src/api/hosted-billing.ts` and `src/billing/white-label-plans.ts` already handle
subscription billing for partner accounts. The white-label plans have `monthlyPriceGbp`
at GBP 99 / GBP 299 / custom. This sprint adds a second dimension: a metered item that
charges per platform event above the included monthly allowance.

Stripe's mechanism: a subscription contains a fixed-price item (the monthly flat fee, already
wired) and a metered-price item (usage records reported by us each month). The metered item
uses `aggregate_usage: 'sum'` and `billing_scheme: 'tiered'`.

Check `src/api/hosted-billing.ts` for the existing Stripe client initialisation before
writing any new code. Do not create a second Stripe instance.

---

## Task

### 1. Stripe product and price setup (one-time configuration)

This is not code; it is a Stripe dashboard step. Document it at the top of
`src/billing/metered-billing.ts` as a comment block:

```
Stripe setup required before this module can be activated:
1. Create a Product: "Carina Platform Events" (platform_events)
2. Create a Price on that product:
   - Type: Recurring
   - Billing period: Monthly
   - Unit amount: 0 GBP (usage is reported by us)
   - Usage type: Metered
   - Aggregate usage: Sum
   - Tiers:
     * 0 to 50,000 events: GBP 0.00 (included in flat subscription)
     * 50,001 to 500,000 events: GBP 0.001 per event (0.1p per event)
     * 500,001+: GBP 0.0005 per event (0.05p per event, volume discount)
3. Store the Price ID as STRIPE_PRICE_PLATFORM_EVENTS_METERED in .env
4. When creating a partner's subscription, add this price as a subscription item
   alongside the existing flat-price item.
```

Add `STRIPE_PRICE_PLATFORM_EVENTS_METERED=price_` to `.env.production.example`.

### 2. Migration: add subscription item tracking

In `src/api/hosted-migrations.ts`, add:

```sql
ALTER TABLE partner_accounts
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_metered_item_id TEXT;
```

`stripe_metered_item_id` is the Stripe subscription item ID for the metered price.
We need this to report usage against the correct subscription item.

### 3. Create the metered billing module

Create `src/billing/metered-billing.ts`:

```typescript
import Stripe from 'stripe';
import { pool } from '../memory/db.js';
import { getPlatformEventSummary } from './platform-event-emitter.js';

// Use the existing Stripe client from hosted-billing.ts - import it, do not create a new one.
import { stripe } from '../api/hosted-billing.js';

export async function reportMonthlyUsage(partnerId: string): Promise<void> {
  const partnerRow = await pool.query(
    `SELECT stripe_metered_item_id FROM partner_accounts WHERE id = $1`,
    [partnerId],
  );
  if ((partnerRow.rowCount ?? 0) === 0) return;
  const { stripe_metered_item_id } = partnerRow.rows[0] as Record<string, string>;
  if (!stripe_metered_item_id) return;

  const now = new Date();
  const fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
  const summary = await getPlatformEventSummary({ partnerId, fromDate, toDate: now });

  await stripe.subscriptionItems.createUsageRecord(stripe_metered_item_id, {
    quantity: summary.totalEvents,
    timestamp: Math.floor(now.getTime() / 1000),
    action: 'set', // 'set' replaces the running total; we report month-to-date each time
  });
}

export async function reportAllPartnerUsage(): Promise<void> {
  const result = await pool.query(
    `SELECT id FROM partner_accounts
     WHERE status = 'active' AND stripe_metered_item_id IS NOT NULL`,
  );
  for (const row of result.rows) {
    try {
      await reportMonthlyUsage(String(row.id));
    } catch (err) {
      console.error('[metered-billing] failed for partner', row.id, err);
    }
  }
}
```

### 4. Wire reporting into the cron/scheduler

In `src/api/carina-ops-routes.ts` or the cron module (`src/ops/` if it exists), add
an internal route that the scheduler can call:

```
POST /internal/billing/report-usage
```

Requires `CARINA_OPS_TOKEN` bearer auth. Body: `{ partnerId?: string }`.
If `partnerId` is provided, reports for that partner only. If absent, calls
`reportAllPartnerUsage()`.

This route is called by a cron job at the VPS level:
```
0 2 * * * curl -s -X POST https://core.carinaai.uk/internal/billing/report-usage \
  -H "Authorization: Bearer $CARINA_OPS_TOKEN"
```

Document this cron line in `SOP/009-cron-workflows.md`.

### 5. Attach the metered item when onboarding a new partner

In `src/hosted/partner-service.ts`, add a function `attachMeteredBilling(partnerId, stripeSubscriptionId)`:

1. Retrieve the subscription from Stripe.
2. Check if a metered item already exists for `STRIPE_PRICE_PLATFORM_EVENTS_METERED`.
3. If not, create one: `stripe.subscriptionItems.create({ subscription: subId, price: meteredPriceId })`.
4. Store the returned `subscriptionItem.id` in `partner_accounts.stripe_metered_item_id`.

Call this after creating a partner's flat-fee subscription.

---

## Margin protection

The `MARGIN_FLOOR = 0.65` constant in `src/billing/margin-report.ts` is the backstop.
If a partner's usage causes their workspace to fall below 65% gross margin, the metered
billing is the correction mechanism: higher event volume generates higher revenue, which
restores the margin. Never waive usage fees without a written commercial decision.

---

## What NOT to do

- Do not report usage in real-time per event. Stripe usage records are for monthly
  aggregates. Report once nightly or once per billing period.
- Do not use `action: 'increment'` on each event. Use `action: 'set'` with
  month-to-date total to make reporting idempotent. If the cron runs twice, the
  second run does not double-count.
- Do not cancel Stripe subscriptions automatically when a partner goes over their
  `monthly_cap_events`. Instead, flag the overage and alert the ops team. Let the
  billing resolve naturally.

---

## Done when

- [ ] `STRIPE_PRICE_PLATFORM_EVENTS_METERED` documented in `.env.production.example`
- [ ] Migration adds `stripe_subscription_id` and `stripe_metered_item_id` to `partner_accounts`
- [ ] `reportMonthlyUsage(partnerId)` calls `stripe.subscriptionItems.createUsageRecord`
- [ ] `reportAllPartnerUsage()` iterates all active partners with a metered item
- [ ] Internal route `POST /internal/billing/report-usage` is behind `CARINA_OPS_TOKEN` auth
- [ ] Cron line documented in `SOP/009-cron-workflows.md`
- [ ] `attachMeteredBilling` wires the metered item on partner subscription creation
- [ ] `pnpm build` compiles without TypeScript errors
- [ ] Manual test: call `reportMonthlyUsage` with a test partner, confirm Stripe dashboard
      shows a usage record (use Stripe test mode)
