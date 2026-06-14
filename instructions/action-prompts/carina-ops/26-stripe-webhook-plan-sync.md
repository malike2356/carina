# Carina Ops Sprint 5.3: Stripe webhook plan sync

## Goal

Webhook handler updates `subscriptions` and `organizations.plan` when Stripe subscription changes.

## Context

- `stripe_events` table exists for idempotency
- Read existing webhook code in `hosted-web.ts` or `stripe-service.ts`
- Must sync org plan for plan gates to work

## Dependencies

- `24-billing-plan-ids.md`
- `25-stripe-checkout-portal-ops.md`

## Files to modify

- `core.carinaai.uk/src/billing/stripe-service.ts`
- `core.carinaai.uk/src/api/hosted-web.ts` (webhook route)
- `core.carinaai.uk/src/hosted/org-service.ts`

## Step-by-step

1. Handle events:

- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

2. On subscription active:

- Map Stripe price ID to `carina_ops_starter` or `carina_ops_team`
- Update `subscriptions` row: plan, status, period dates, stripe_subscription_id
- Update `organizations.plan` for org from metadata
- Insert/update `invoices` row

3. On cancel/delete:

- Downgrade to `free` on `organizations.plan` and `subscriptions.plan`
- Preserve data; plan gates block ops console

4. Idempotency: skip if `stripe_events` already has event id.

5. Audit: `billing.plan_changed` with `{ from, to, source: 'stripe' }`.

6. Write test with fixture Stripe event JSON bodies.

## Expected behavior

- Test webhook promotes org to starter
- Cancel webhook demotes to free; `/api/carina-ops/overview` returns 402

## Test

```bash
cd core.carinaai.uk && pnpm test src/api/__tests__/hosted-billing.test.ts
```

Add dedicated `hosted-stripe-webhook.test.ts` if needed.
