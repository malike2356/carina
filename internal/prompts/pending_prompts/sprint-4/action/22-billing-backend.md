# Sprint 5 - Prompt 01: Aiva Billing Backend (core.carinaai.uk)

**Sprint:** 5 - Aiva Billing
**Prompt number:** 01 of 03
**Name:** Aiva billing module - DB schema, Stripe products, subscription manager, webhook routing
**Primary agent:** Claude Code
**Estimated hours:** 10-14 h
**Depends on:** Sprint 4 complete; `aiva_subscriptions` table already exists from sprint-4 prompt 04

---

## Post-build (MANDATORY)

When all "Done When" criteria below are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file.
2. Add a "**What was built:**" bullet list.
3. Move this file to `internal/prompts/archived_prompts/archives_from_pending_prompts/sprint-5/aiva-billing/`.

Full checklist: `internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`

---

## Read First

Before writing any code, read these files in full:

1. `backends/servers/core.carinaai.uk/src/billing/stripe-service.ts` - the existing Stripe SDK client; import from here, never instantiate a second Stripe client
2. `backends/servers/core.carinaai.uk/src/billing/subscription-manager.ts` - existing subscription logic; follow its patterns exactly
3. `backends/servers/core.carinaai.uk/src/billing/workspace-billing.ts` - workspace billing model; understand how workspace is tied to Stripe customer
4. `backends/servers/core.carinaai.uk/src/billing/webhooks/stripe-webhook.ts` - existing webhook handler; you will extend this, not replace it
5. `backends/servers/core.carinaai.uk/src/api/billing-routes.ts` - how billing routes are registered; add Aiva routes here or in a separate module
6. `backends/servers/core.carinaai.uk/src/memory/db.ts` - DB query pattern
7. `backends/servers/core.carinaai.uk/src/types/index.ts` - add Aiva billing types here
8. `backends/servers/core.carinaai.uk/src/config/index.ts` - config shape; new env vars go in the config object
9. `backends/servers/core.carinaai.uk/.env.example` - env reference; add all new vars here

---

## Context

VERLOX runs one Stripe account. Three products share it:
- Carina Core (existing, handled by the existing billing module)
- Scout (handled by Scout's own SCI-* billing work)
- Aiva (this prompt)

The key constraint: every Stripe object created for Aiva must carry
`metadata: { product: 'aiva', workspace_id: '<id>' }`. The webhook handler dispatches by
`metadata.product`, so events for Carina and Scout are never processed by the Aiva module.

The `aiva_subscriptions` table was created in sprint-4 to hold trial state. This prompt:
1. Extends that table
2. Builds the `aiva-billing.ts` module
3. Adds Stripe products (via a setup script)
4. Extends the webhook handler for Aiva events
5. Adds the API surface the portal and plan-gate layer call

---

## Step 1: Extend the database schema

Add a migration: `src/infrastructure/migrations/007-aiva-billing.sql`

```sql
-- Extend aiva_subscriptions (already created in 006-ai-workers.sql)
ALTER TABLE aiva_subscriptions
  ADD COLUMN IF NOT EXISTS stripe_customer_id   TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS stripe_price_id       TEXT,
  ADD COLUMN IF NOT EXISTS current_period_start  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS current_period_end    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS payment_failed_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS grace_period_ends_at  TIMESTAMPTZ,   -- 7 days after first payment failure
  ADD COLUMN IF NOT EXISTS billing_interval      TEXT,           -- month | year
  ADD COLUMN IF NOT EXISTS updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_aiva_subs_workspace
  ON aiva_subscriptions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_aiva_subs_stripe_customer
  ON aiva_subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_aiva_subs_stripe_sub
  ON aiva_subscriptions(stripe_subscription_id);

-- Aiva invoice records (for display in the billing UI; populated from webhook events)
CREATE TABLE IF NOT EXISTS aiva_invoices (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      TEXT NOT NULL,
  stripe_invoice_id TEXT NOT NULL UNIQUE,
  amount_paid       INTEGER NOT NULL,    -- in pence (GBP)
  currency          TEXT NOT NULL DEFAULT 'gbp',
  status            TEXT NOT NULL,       -- paid | open | void | uncollectible
  invoice_pdf_url   TEXT,
  period_start      TIMESTAMPTZ,
  period_end        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_aiva_invoices_workspace
  ON aiva_invoices(workspace_id, created_at DESC);
```

The `plan_tier` and `status` columns from sprint-4 remain and are kept in sync by the webhook.
`aiva_slot_limit` is set by the billing module based on `plan_tier`, not manually.

Slot limits by plan tier:
- `trial`: 1
- `starter`: 1
- `team`: 5
- `business`: 999 (effectively unlimited; use a high number rather than null)

---

## Step 2: Aiva billing module

Create: `backends/servers/core.carinaai.uk/src/billing/aiva-billing.ts`

This module wraps all Aiva-specific Stripe operations. Import the existing Stripe client from
`stripe-service.ts`. Do not create a new Stripe instance.

```typescript
import { stripe } from './stripe-service.js';
import { pool } from '../memory/db.js';
import type { AivaSubscription, AivaInvoice } from '../types/index.js';

// ----- Subscription queries -----

export async function getAivaSubscription(workspaceId: string): Promise<AivaSubscription | null>

export async function upsertTrialSubscription(workspaceId: string): Promise<AivaSubscription>
// Creates aiva_subscriptions row if missing, or returns existing.
// Sets: plan_tier='trial', status='trialing', trial_ends_at=NOW()+15d, aiva_slot_limit=1.
// Idempotent: safe to call multiple times.

export async function canHireMoreAivas(workspaceId: string): Promise<boolean>
// Returns true if count of active+paused workers < aiva_slot_limit AND status is not suspended.

export function slotLimitForTier(tier: string): number
// Returns 1 | 5 | 999 for starter | team | business; 1 for trial.

// ----- Stripe checkout -----

export async function createCheckoutSession(params: {
  workspaceId: string;
  priceId: string;          // AIVA_STRIPE_PRICE_* env var value
  interval: 'month' | 'year';
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
}): Promise<{ url: string }>
// Creates or reuses Stripe customer (keyed by workspace_id in metadata).
// Attaches metadata: { product: 'aiva', workspace_id }.
// Enables automatic_tax: { enabled: true } for VAT handling.
// Allows promotion codes.
// Returns the Checkout Session URL.

export async function createPortalSession(params: {
  workspaceId: string;
  returnUrl: string;
}): Promise<{ url: string }>
// Creates a Stripe Customer Portal session for the workspace's Stripe customer.
// Used for: invoice history, payment method update, plan change, cancellation.

// ----- Plan change (called by webhook handler) -----

export async function activateSubscription(params: {
  workspaceId: string;
  stripeSubscriptionId: string;
  stripePriceId: string;
  stripeCustomerId: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  interval: 'month' | 'year';
}): Promise<void>
// Derives plan_tier from stripePriceId using config.AIVA_PRICE_TIER_MAP.
// Sets aiva_slot_limit from slotLimitForTier.
// Updates aiva_subscriptions row.

export async function suspendSubscription(workspaceId: string): Promise<void>
// Sets status='suspended', pauses all active Aivas for the workspace (UPDATE ai_workers SET status='paused').
// Does NOT delete workers.

export async function reactivateSubscription(workspaceId: string): Promise<void>
// Sets status='active'. Does NOT automatically unpause workers (user does that manually).
// Sends a notification that the subscription is active and workers can be resumed.

export async function setGracePeriod(workspaceId: string): Promise<void>
// Sets payment_failed_at = NOW(), grace_period_ends_at = NOW() + INTERVAL '7 days', status='past_due'.

export async function recordInvoice(invoice: Stripe.Invoice): Promise<void>
// Upserts into aiva_invoices from a Stripe Invoice object.

// ----- Pricing config -----

export function getAivaPricingConfig(): AivaPricingConfig
// Returns the price IDs and plan metadata from config.
// Used by the billing UI to render plan cards without hardcoding price IDs.
```

Add to `src/types/index.ts`:

```typescript
export interface AivaSubscription {
  id: string;
  workspaceId: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripePriceId: string | null;
  planTier: 'trial' | 'starter' | 'team' | 'business';
  status: 'trialing' | 'active' | 'past_due' | 'suspended' | 'cancelled';
  slotLimit: number;
  trialEndsAt: Date | null;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  paymentFailedAt: Date | null;
  gracePeriodEndsAt: Date | null;
  billingInterval: 'month' | 'year' | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AivaInvoice {
  id: string;
  workspaceId: string;
  stripeInvoiceId: string;
  amountPaid: number;   // pence
  currency: string;
  status: string;
  invoicePdfUrl: string | null;
  periodStart: Date | null;
  periodEnd: Date | null;
  createdAt: Date;
}

export interface AivaPricingConfig {
  starter: { monthly: { priceId: string; amount: number }; annual: { priceId: string; amount: number }; slotLimit: number };
  team:    { monthly: { priceId: string; amount: number }; annual: { priceId: string; amount: number }; slotLimit: number };
  business:{ monthly: { priceId: string; amount: number }; annual: { priceId: string; amount: number }; slotLimit: number };
}
```

---

## Step 3: Stripe product setup script

Create: `backends/servers/core.carinaai.uk/scripts/stripe-setup-aiva.ts`

A one-time script that creates the Aiva products and prices in Stripe and prints the resulting
price IDs. Run once against the live account; commit the resulting IDs to `.env.example`.

```typescript
// Creates:
//   Product: "Aiva Starter" (metadata: { product: 'aiva', tier: 'starter' })
//     Price: monthly GBP, unit_amount = 4900 (49 GBP)
//     Price: annual  GBP, unit_amount = 47040 (392 GBP / year = 32.67/mo)
//
//   Product: "Aiva Team" (metadata: { product: 'aiva', tier: 'team' })
//     Price: monthly GBP, unit_amount = 19900 (199 GBP)
//     Price: annual  GBP, unit_amount = 191040 (1592 GBP / year = 132.67/mo)
//
//   Product: "Aiva Business" (metadata: { product: 'aiva', tier: 'business' })
//     Price: monthly GBP, unit_amount = 49900 (499 GBP)
//     Price: annual  GBP, unit_amount = 479040 (3992 GBP / year = 332.67/mo)
//
// Prices are indicative. Update unit_amount values before running in production.
// The script is idempotent: it checks for existing products by metadata lookup before creating.
// Output: prints all 6 price IDs to stdout so they can be added to .env.
```

Add to `package.json` scripts:
```json
"stripe:setup-aiva": "tsx scripts/stripe-setup-aiva.ts"
```

---

## Step 4: Webhook handler extension

Modify `src/billing/webhooks/stripe-webhook.ts` to route Aiva events.

The existing handler processes events for Carina products. Add a dispatcher at the top of the
handler based on `metadata.product`:

```typescript
const product = getProductFromEvent(event);  // reads metadata.product from the relevant object

if (product === 'aiva') {
  await handleAivaWebhookEvent(event);
  return;
}
// existing Carina / Scout handling continues below
```

Create: `src/billing/aiva-webhook-handler.ts`

Implement `handleAivaWebhookEvent(event: Stripe.Event): Promise<void>`:

```typescript
switch (event.type) {

  case 'checkout.session.completed': {
    // session.metadata.workspace_id -> call activateSubscription with session.subscription details
    // Also call upsertTrialSubscription to ensure the row exists before updating
    break;
  }

  case 'customer.subscription.updated': {
    // Plan change (upgrade or downgrade)
    // Re-derive plan_tier from subscription.items.data[0].price.id
    // Update aiva_subscriptions; update slot limit
    // If downgrade causes slot conflict (aivasUsed > new slotLimit), do not auto-suspend:
    //   set a flag aiva_subscriptions.pending_downgrade_conflict = true so the portal can show
    //   the resolution screen (Step 6 in prompt 03)
    break;
  }

  case 'customer.subscription.deleted': {
    // Subscription cancelled or expired
    // Call suspendSubscription(workspaceId)
    break;
  }

  case 'invoice.payment_succeeded': {
    // Clear grace period if in past_due; call reactivateSubscription
    // Record invoice via recordInvoice
    break;
  }

  case 'invoice.payment_failed': {
    // First failure: call setGracePeriod (7-day window)
    // Second failure (check payment_failed_at): call suspendSubscription
    // Record invoice via recordInvoice
    break;
  }

  case 'invoice.created':
  case 'invoice.finalized': {
    // Record invoice for display in billing UI
    await recordInvoice(event.data.object as Stripe.Invoice);
    break;
  }
}
```

Helper `getProductFromEvent`: inspects the event's primary object for `metadata.product`.
For `checkout.session.completed` use `session.metadata`.
For subscription events use `subscription.metadata`.
For invoice events use `invoice.subscription` -> fetch subscription to read metadata.

---

## Step 5: Billing API routes

Create: `backends/servers/core.carinaai.uk/src/api/aiva-billing-routes.ts`

Express router mounted at `/api/aiva/billing` in `server.ts`.

```
GET  /api/aiva/billing/status
       Query: workspaceId
       Response: full AivaSubscription + aivasUsed + canHireMore + invoiceCount

GET  /api/aiva/billing/pricing
       Response: AivaPricingConfig (price IDs, amounts, slot limits per tier)
       No auth required; used to render plan cards before login

POST /api/aiva/billing/checkout
       Body: { workspaceId, priceId, interval, successUrl, cancelUrl }
       Auth: CARINA_OPS_TOKEN or workspace session
       Action: call createCheckoutSession; return { url }

POST /api/aiva/billing/portal
       Body: { workspaceId, returnUrl }
       Auth: workspace session
       Action: call createPortalSession; return { url }

GET  /api/aiva/billing/invoices
       Query: workspaceId, limit (default 20)
       Response: { invoices: AivaInvoice[] }

POST /api/aiva/subscription/trial
       Body: { workspaceId }
       Auth: CARINA_OPS_TOKEN or workspace session
       Action: call upsertTrialSubscription
       Response: { trialEndsAt, slotLimit: 1 }

GET  /api/aiva/subscription/status
       Query: workspaceId
       Response: { planTier, status, trialEndsAt, trialDaysRemaining, slotLimit, aivasUsed, canHireMore }
```

---

## Step 6: Plan gate enforcement in the hire API

Modify `aiva-api.ts` (from sprint-4 prompt 03):

In the `POST /api/aiva/workers` handler, before creating the worker:

```typescript
const allowed = await canHireMoreAivas(workspaceId);
if (!allowed) {
  return res.status(402).json({
    error: 'aiva_slot_limit_reached',
    message: 'You have reached your Aiva limit. Upgrade your plan to hire more.',
    upgradeUrl: `${config.appUrl}/billing/aiva`,
  });
}
```

This is the server-side gate. The portal-side gate (Step 3 in prompt 03) checks the same
condition before even showing the hire form, but the server-side check is authoritative.

---

## Step 7: Environment variables

Add to `backends/servers/core.carinaai.uk/.env.example`:

```env
# Aiva Billing - Stripe (shared account, separate product IDs)
# Run scripts/stripe-setup-aiva.ts once to generate these IDs
AIVA_STRIPE_STARTER_MONTHLY_PRICE_ID=
AIVA_STRIPE_STARTER_ANNUAL_PRICE_ID=
AIVA_STRIPE_TEAM_MONTHLY_PRICE_ID=
AIVA_STRIPE_TEAM_ANNUAL_PRICE_ID=
AIVA_STRIPE_BUSINESS_MONTHLY_PRICE_ID=
AIVA_STRIPE_BUSINESS_ANNUAL_PRICE_ID=

# Stripe account (shared with Carina; already exists if Carina billing is configured)
# STRIPE_SECRET_KEY=  (already in .env.example from existing billing module)
# STRIPE_WEBHOOK_SECRET= (already in .env.example; same secret if single webhook endpoint)

# Aiva billing feature flags
AIVA_BILLING_ENABLED=true    # set false to skip all Stripe calls (uses trial-only mode)
AIVA_GRACE_PERIOD_DAYS=7     # days between first payment failure and suspension
```

Add to `src/config/index.ts`:
- `aivaStripe.starterMonthlyPriceId`
- `aivaStripe.starterAnnualPriceId`
- `aivaStripe.teamMonthlyPriceId`
- `aivaStripe.teamAnnualPriceId`
- `aivaStripe.businessMonthlyPriceId`
- `aivaStripe.businessAnnualPriceId`
- `aivaStripe.gracePeriodDays` (default 7)
- `aivaStripe.enabled` (default true)

Also add `aivaPriceTierMap`: a Record mapping each price ID to its tier string, used by
`activateSubscription` to derive `plan_tier` from `stripePriceId`.

---

## Done When

- [ ] Migration `007-aiva-billing.sql` runs cleanly; `aiva_subscriptions` has all new columns; `aiva_invoices` table created
- [ ] `aiva-billing.ts` exports all listed functions with correct TypeScript signatures
- [ ] `upsertTrialSubscription` is idempotent: calling it twice returns the same row
- [ ] `canHireMoreAivas` returns false for suspended workspaces and workspaces at slot limit
- [ ] `createCheckoutSession` creates a Stripe session with `metadata.product = 'aiva'` and `automatic_tax.enabled = true`
- [ ] `createPortalSession` returns a valid Stripe portal URL for the workspace's customer
- [ ] `stripe-setup-aiva.ts` runs without error in a test Stripe account and prints 6 price IDs
- [ ] Webhook handler dispatches on `metadata.product`; Aiva events go to `handleAivaWebhookEvent`, Carina events unchanged
- [ ] `checkout.session.completed` event activates the subscription and sets correct `plan_tier` and `aiva_slot_limit`
- [ ] `customer.subscription.deleted` event calls `suspendSubscription` and pauses all active workers
- [ ] `invoice.payment_failed` sets grace period on first failure; suspends on second failure
- [ ] `invoice.payment_succeeded` clears grace period; calls `reactivateSubscription`
- [ ] All six billing API routes return correct shapes
- [ ] `POST /api/aiva/workers` returns 402 with `error: 'aiva_slot_limit_reached'` when slot limit is reached
- [ ] `AivaPricingConfig`, `AivaSubscription`, `AivaInvoice` types added to `src/types/index.ts`
- [ ] All new env vars documented in `.env.example`
- [ ] `AIVA_BILLING_ENABLED=false` causes all Stripe calls to be skipped; trial-only mode still works
- [ ] `npx tsc --noEmit --skipLibCheck` passes for all new files
- [ ] No em dashes in any string, log, or comment
- [ ] Billing API and webhook handler writes are tested with at least one unit test each
