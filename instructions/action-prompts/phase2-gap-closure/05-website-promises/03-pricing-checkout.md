# Action: Build the Stripe Pricing & Checkout Flow (Genuinely Greenfield)

## Goal
Build the full checkout flow that makes carinaai.uk's and labyrinthscout.com's pricing pages functional: plan selection, account creation, Stripe Checkout, subscription activation with an issued Scout API key, billing API, usage metering, and the Stripe webhook handler.

## Context
- Spec file: `chat.carinaai.uk/prompts/phase2-gap-closure/05-website-promises/03-pricing-checkout.md`
- **Confirmed genuinely greenfield.** `grep -ril "stripe\|billing\|checkout\|subscription" core.carinaai.uk/src console.labyrinthscout.com/src ops.carinaai.uk --include="*.ts"` returns NOTHING in product code (only `node_modules` type definitions, if any). There is no prior billing system, Stripe account wiring, or subscription model anywhere in this monorepo to extend. This is the one spec in the batch that is a true build, not a gap-closure.
- Read `carinaai.uk/index.html` and `labyrinthscout.com/index.html` FIRST — the spec says the pricing page must "match carinaai.uk design"; the real marketing pages (and whatever pricing tables they currently show, even if static/non-functional) are the actual design source of truth, not the spec's ASCII mockup (lines 34-51).
- Read `console.labyrinthscout.com/src/api/honeypots.ts` or another representative admin API file to learn this codebase's conventions for: route registration, request validation, error response shape, and how the existing admin auth middleware works — the new billing routes must be authenticated consistently with everything else, and a customer-facing checkout flow needs its OWN (lighter-weight, public-facing) auth distinct from the admin routes.
- **Critical environment-boundary note:** Stripe API keys, webhook signing secrets, and price/product IDs are credentials. Per this repo's CLAUDE.md security rules, NEVER hardcode them — they come from `.env`/`.access.config`-style env vars the user supplies. Write `stripe-service.ts` to read `process.env.STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET`/`STRIPE_PRICE_*` and fail clearly at startup if they are missing, rather than silently running in a broken state.
- Conventions: TypeScript strict, no emojis/em-dashes, PostgreSQL via existing `pool`/migration patterns, every new module gets `*.test.ts` with the Stripe SDK mocked (never hit the real Stripe API in tests).

## Files to create
```
core.carinaai.uk/src/web/pricing/
  index.html                   — Pricing page (mirrors the REAL carinaai.uk design, not the spec's ASCII table)
  checkout.html                — Plan selection + account creation + Stripe Checkout redirect
  success.html                 — Post-payment confirmation (spec lines 81-96: shows API key + quick-start commands)
  pricing.css
core.carinaai.uk/src/billing/
  stripe-service.ts            — StripeService class exactly per spec lines 100-113
  subscription-manager.ts      — Plan lifecycle (create/upgrade/cancel/reactivate)
  usage-meter.ts               — UsageRecord tracking + 80%/100% threshold messaging (spec lines 139-143)
  invoice-generator.ts         — Invoice record + PDF generation/retrieval
  billing-api.ts               — REST handlers for the 8 documented routes (lines 118-126)
  webhooks/
    stripe-webhook.ts          — Handles checkout.session.completed, customer.subscription.updated/deleted, invoice.payment_failed
  __tests__/
    stripe-service.test.ts
    subscription-manager.test.ts
    usage-meter.test.ts
    invoice-generator.test.ts
    billing-api.test.ts
    stripe-webhook.test.ts
core.carinaai.uk/src/api/
  billing-routes.ts            — Route registration wiring billing-api.ts + stripe-webhook.ts into the server
```
Note: placed under `core.carinaai.uk` since `packages/cloud` does not exist; if investigation in Step 1 finds a more appropriate "customer console / billing surface" location in this monorepo, use it instead and document why.

## Files to modify
- `core.carinaai.uk/src/migrations.ts` — add `subscriptions`, `invoices`, `usage_records` tables (tenant_id, plan, status, stripe_customer_id, stripe_subscription_id, current_period_end, etc. — design the minimal schema the `StripeService`/`SubscriptionManager`/`UsageMeter` interfaces require)
- `core.carinaai.uk/src/gateway/web.ts` (or wherever the public marketing/console routes are registered) — add `/pricing`, `/checkout`, `/billing/success` routes
- `.env.example` (or this project's equivalent template file — `find core.carinaai.uk -maxdepth 1 -iname ".env*"`) — document the new required Stripe env vars without ever putting real values in a committed file

## Step-by-step
1. Read `carinaai.uk/index.html` and `labyrinthscout.com/index.html` in full. Extract the REAL pricing tiers, prices, and feature lists currently shown (even if the pages are static marketing pages with no checkout wired up) — these are the actual plan definitions `subscription-manager.ts` and the Stripe product/price configuration must match. If they differ from the spec's table (lines 34-51), the live site is the source of truth; note the discrepancy in a comment.
2. Read an existing admin API file (e.g. `honeypots.ts`) to learn this codebase's request/response/error/auth conventions. Design the customer-facing billing routes to be consistent in style but with PUBLIC-FACING auth (the checkout flow runs before a paying customer has full console credentials — likely email+password account creation, not the admin password gate).
3. Build `stripe-service.ts` implementing the five methods from spec lines 100-113 (`createCheckoutSession`, `handleWebhook`, `getSubscription`, `cancelSubscription`, `updatePaymentMethod`) using the official `stripe` npm package (`pnpm add stripe` if not already a dependency — confirm with `grep -n "\"stripe\"" core.carinaai.uk/package.json` first). All Stripe credentials come from env vars; throw a clear startup error if `STRIPE_SECRET_KEY` is missing.
4. Add the database migrations: `subscriptions` (tenant_id, plan, status, stripe_customer_id, stripe_subscription_id, current_period_start/end, created_at), `invoices` (id, tenant_id, stripe_invoice_id, amount, status, pdf_url, period), `usage_records` (tenant_id, date, tokens_used, model, cost_estimate — matching spec lines 131-137 exactly).
5. Build `subscription-manager.ts`: plan lifecycle on top of `stripe-service.ts` — creating a subscription records the local `subscriptions` row from the Stripe webhook event (NEVER trust client-side "payment succeeded" claims; only the webhook is authoritative), upgrading/canceling/reactivating call Stripe and update local state in lockstep.
6. Build `usage-meter.ts`: records `UsageRecord`s as the agent consumes tokens (find where token counts are currently tracked for cost/logging purposes — `grep -rn "tokens_in\|tokens_out\|token.*usage" core.carinaai.uk/src` — and hook in there rather than adding a second token-counting path), computes monthly totals against the plan's limit, and produces the documented warning ("You've used 400K of 500K tokens this month") at 80% and the block message at 100%.
7. Build `invoice-generator.ts`: on `invoice.payment_*` webhook events, records an `invoices` row referencing Stripe's hosted invoice PDF URL (Stripe generates and hosts invoice PDFs — do not build a parallel PDF renderer; `GET /api/billing/invoices/{id}` can redirect to or proxy Stripe's PDF URL).
8. Build `stripe-webhook.ts`: verifies the webhook signature using `STRIPE_WEBHOOK_SECRET` (CRITICAL — an unverified webhook endpoint is a payment-fraud vector), then dispatches `checkout.session.completed` (activate subscription + issue a `scout_live_...` API key), `customer.subscription.updated` (sync plan/status), `customer.subscription.deleted` (mark canceled), `invoice.payment_failed` (mark past-due, notify the tenant via the existing `alertDispatcher` if one is wired for customer-facing notifications, or email directly).
9. Build `billing-api.ts` implementing the 8 documented routes (lines 118-126), each scoped to the authenticated tenant, delegating to the modules above.
10. Build the three HTML pages following the REAL carinaai.uk design (from Step 1): `index.html` (pricing tiers + CTAs), `checkout.html` (plan pre-selection → account creation form → redirect to Stripe-hosted Checkout via `createCheckoutSession`), `success.html` (the confirmation layout from spec lines 81-96, including the issued API key and the exact quick-start commands `scout deploy --license-key ***` / `carina config set scout.url ...`).
11. Wire `/pricing`, `/checkout`, `/billing/success` routes and the webhook endpoint into the server's router registration.

## Expected behavior
- `https://carinaai.uk/pricing` shows the Free/Scout/Enterprise tiers matching the real marketing site's current design and copy
- Clicking "Get Scout" pre-selects the Scout Standard plan in checkout
- Completing Stripe Checkout with test card `4242 4242 4242 4242` activates the subscription, issues a `scout_live_...` API key, and shows the confirmation page with the next-invoice date and quick-start commands
- `GET /api/billing/subscription` (authenticated) returns `{ plan: "scout_standard", status: "active", next_invoice: "2026-07-07" }`
- `POST /api/billing/cancel` then `GET .../subscription` shows `{ status: "canceled", ends_at: "..." }`; `POST .../reactivate` restores `{ status: "active" }`
- A tenant who reaches 400K of a 500K token limit sees the documented warning; at 500K, new requests are blocked with the documented upgrade message
- A forged webhook request (bad signature) is rejected with 400 and never mutates subscription state

## Test
- `stripe-service.test.ts`: each method calls the (mocked) Stripe SDK with correct parameters and handles its responses/errors; NEVER calls the real Stripe API
- `stripe-webhook.test.ts`: signature verification rejects tampered/forged payloads; each event type updates local state correctly and idempotently (replaying the same event twice does not double-activate or double-charge)
- `subscription-manager.test.ts`: lifecycle transitions (create/upgrade/cancel/reactivate) keep local state and Stripe state consistent
- `usage-meter.test.ts`: 80%/100% thresholds produce the exact documented messages; overage cost calculation matches `£0.002 per 1K tokens`
- `invoice-generator.test.ts`: invoice records are created from webhook events and reference valid Stripe-hosted PDF URLs
- `billing-api.test.ts`: each of the 8 routes is correctly tenant-scoped and authenticated
- Run `pnpm test -- billing stripe usage subscription invoice` and confirm all pass

## Dependencies
- Step 1 (reading the real marketing pages) determines the actual plan/price/feature data — do not hardcode the spec's illustrative numbers without confirming them against the live site copy
- Requires `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `STRIPE_PRICE_*` IDs supplied by the user via env vars — these do not exist yet and must be created in a Stripe account (test mode for development) before this can be exercised end-to-end; flag this clearly as a prerequisite the user must complete outside of code
- `usage-meter.ts` depends on finding the existing token-counting code path (`grep -rn "tokens_in\|tokens_out"`) — hook into it rather than adding a parallel counter
- The issued `scout_live_...` API key format and validation should be consistent with whatever key format `console.labyrinthscout.com` already issues/expects (check `licence-activator.ts` from spec 04-03 if it has landed, or `grep -rn "scout_live\|api_key.*format" console.labyrinthscout.com/src`)
