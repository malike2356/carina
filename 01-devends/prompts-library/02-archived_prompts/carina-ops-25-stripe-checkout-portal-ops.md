# Carina Ops Sprint 5.2: Stripe checkout and portal for Carina Ops

## Goal

Let customers self-serve upgrade to Carina Ops Starter or Team via Stripe Checkout and Customer Portal.

## Context

- Existing: `hosted-web.ts` billing routes, `StripeService` in `src/billing/stripe-service.ts`
- Checkout currently targets Scout plans; extend for Ops plans
- Env: `STRIPE_PRICE_CARINA_OPS_STARTER`, `STRIPE_PRICE_CARINA_OPS_TEAM`

## Dependencies

- `24-billing-plan-ids.md`
- `04-org-member-middleware.md`

## Files to modify

- `core.carinaai.uk/src/api/hosted-web.ts`
- `core.carinaai.uk/src/billing/stripe-service.ts`
- `core.carinaai.uk/.env.example`
- `core.carinaai.uk/src/gateway/web/ops/billing.html`

## Step-by-step

1. Extend checkout endpoint:

```typescript
POST /app/auth/billing/checkout
Body: { plan: 'carina_ops_starter' | 'carina_ops_team' }
```

Only `owner` role (`billing.write`) may checkout.

2. Pass `metadata: { org_id, plan }` to Stripe session.

3. Success/cancel URLs:

- success: `https://app.carinaai.uk/ops/billing?checkout=success`
- cancel: `https://app.carinaai.uk/ops/billing?checkout=cancel`

4. Portal route unchanged but verify it works for Ops subscribers.

5. `ops/billing.html`:

- Show current plan
- Buttons: Upgrade to Starter, Upgrade to Team
- Link to Stripe portal for invoice management

6. Audit `billing.checkout_started` on session create.

## Expected behavior

- Owner clicks upgrade; redirected to Stripe test checkout
- Non-owner gets 403
- Invalid plan ID returns 400

## Test

```bash
cd core.carinaai.uk && pnpm test src/api/__tests__/hosted-billing.test.ts
```

Mock Stripe; assert session created with correct price ID and metadata.

## Manual prerequisite

Create Stripe test products and paste price IDs into `.env` before manual E2E test.
