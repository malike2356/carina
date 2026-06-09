# Action: Verify and Close Remaining Gaps in the Stripe Pricing & Checkout Flow

## Goal
This spec was written when the checkout flow was a genuine gap. **It no longer is — read this whole Context section before doing anything else.** The full billing system (Stripe service, subscription lifecycle, usage metering, invoicing, webhook handler, REST API, and three pricing/checkout/success pages) already exists, is wired into the server, and has a passing test suite (commit `1368a1d feat(billing): add Stripe checkout subscriptions`). Your job is NOT to build this from scratch — it is to verify the existing implementation against the spec, run the tests, and close the small number of real wiring gaps identified below (chiefly: the live marketing site does not link to the new pricing page).

## Context — CORRECTION to the original spec's gap analysis
- Spec file: `chat.carinaai.uk/prompts/phase2-gap-closure/05-website-promises/03-pricing-checkout.md`
- **The spec (and an earlier draft of this action prompt) claimed this was "genuinely greenfield... no prior billing system, Stripe account wiring, or subscription model anywhere in this monorepo." That claim is FALSE as of the current codebase.** All of the following already exist, fully implemented and tested (run `pnpm vitest run src/billing` — 7 files, 14 tests, all passing):
  - `core.carinaai.uk/src/billing/stripe-service.ts` — `StripeService` with `createCheckoutSession`, `handleWebhook`, `getSubscription`, `cancelSubscription`, `reactivateSubscription`, `updatePaymentMethod`
  - `core.carinaai.uk/src/billing/subscription-manager.ts` — plan lifecycle, syncs from Stripe webhook events (never trusts client-side claims)
  - `core.carinaai.uk/src/billing/usage-meter.ts` — `UsageMeter` with `recordUsage`/`getMonthlyUsage`/`status`, producing the exact 80%/100% threshold messages the spec describes ("You've used X of Y tokens this month" / blocked-with-upgrade-message)
  - `core.carinaai.uk/src/billing/invoice-generator.ts` — records invoices from Stripe webhook events
  - `core.carinaai.uk/src/billing/billing-api.ts` — REST handlers, mounted at `/api/billing`
  - `core.carinaai.uk/src/billing/webhooks/stripe-webhook.ts` — `StripeWebhookHandler`; verifies signatures, is idempotent (checks `stripe_events` table before processing — replaying an event is a no-op), handles `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`, `invoice.payment_succeeded`
  - `core.carinaai.uk/src/api/billing-routes.ts` — `mountBillingRoutes`/`mountBillingWebhook`, both called from `core.carinaai.uk/src/gateway/web.ts` (lines ~13, ~215-221), which also serves `/pricing`, `/checkout`, `/billing/success` from `src/web/pricing/{index,checkout,success}.html`
  - `core.carinaai.uk/src/api/hosted-migrations.ts` (NOT `src/migrations.ts` — that file does not exist) — already defines `subscriptions`, `invoices`, `usage_records`, AND `stripe_events` tables with the exact columns this spec would have asked for (tenant_id, plan, status, stripe_customer_id, stripe_subscription_id, current_period_start/end, scout_api_key, etc.)
  - `stripe` is already in `package.json` (`"stripe": "^20.4.0"`)
  - Full test coverage: `__tests__/{stripe-service,subscription-manager,usage-meter,invoice-generator,billing-api,stripe-webhook}.test.ts`, all mocking the Stripe SDK (never hitting the real API)
- **Do not recreate, overwrite, or "improve by rewriting" any of the above.** It is working, tested code. Treat every file in this list as something to READ and VERIFY, not replace.
- Conventions: TypeScript strict, no emojis/em-dashes, PostgreSQL via the existing `pool` (see `src/memory/db.ts`), every module already has `*.test.ts` with the Stripe SDK mocked — extend these only if you find a genuine untested branch.

## Files to verify (read each in full; do not rewrite working code)
```
core.carinaai.uk/src/billing/stripe-service.ts
core.carinaai.uk/src/billing/subscription-manager.ts
core.carinaai.uk/src/billing/usage-meter.ts
core.carinaai.uk/src/billing/invoice-generator.ts
core.carinaai.uk/src/billing/billing-api.ts
core.carinaai.uk/src/billing/webhooks/stripe-webhook.ts
core.carinaai.uk/src/billing/plans.ts             — BILLING_PLANS / resolveStripePriceId; confirm the plan IDs match the live carinaai.uk pricing copy (Step 1)
core.carinaai.uk/src/api/billing-routes.ts
core.carinaai.uk/src/api/hosted-migrations.ts
core.carinaai.uk/src/web/pricing/index.html
core.carinaai.uk/src/web/pricing/checkout.html
core.carinaai.uk/src/web/pricing/success.html
core.carinaai.uk/src/web/pricing/pricing.css
core.carinaai.uk/src/gateway/web.ts               — confirm /pricing, /checkout, /billing/success, /api/billing, /webhooks/stripe are all mounted (they appear to be at lines ~13, ~215-221 — verify and note the exact line numbers in your report)
```

## Files to create (only if gaps below are confirmed real)
```
core.carinaai.uk/src/billing/__tests__/<name>.test.ts   — ONLY for any genuinely untested branch found in Step 4 (e.g. a webhook event type with no corresponding test case)
```
Do not create new top-level billing modules, pages, or routes — there is no remaining greenfield surface here.

## Step-by-step
1. Read `carinaai.uk/index.html` in full (it is the real marketing site). Find its pricing section and "Get Scout" CTAs (currently at approx. lines 1349 and 1371, both `<a href="https://console.labyrinthscout.com">`). Compare its plan names/prices/copy against `core.carinaai.uk/src/billing/plans.ts` (`BILLING_PLANS`) and the rendered `core.carinaai.uk/src/web/pricing/index.html`. Note any mismatches (e.g., the marketing copy says one price, the Stripe plan config says another) — these are real bugs to fix in `plans.ts` or the HTML, whichever is the outlier relative to the other two.
2. **Confirm the central wiring gap**: the live `carinaai.uk/index.html` "Get Scout — £99/mo" CTAs link straight to the external `https://console.labyrinthscout.com`, NOT to the working `/pricing` → `/checkout` → Stripe flow that already exists at `core.carinaai.uk/src/web/pricing/`. Determine which is correct by reading `console.labyrinthscout.com/docs/pricing.md` and checking whether `console.labyrinthscout.com` has its own (separate, possibly not-yet-built) checkout — `grep -rln "checkout\|stripe\|billing" console.labyrinthscout.com/src --include="*.ts"`. If the intended flow is the one already built in `core.carinaai.uk`, update the marketing site CTAs to point at `https://carinaai.uk/pricing` (or the correct production path) instead. If Scout has (or is meant to have) its own separate checkout, document that finding instead of changing anything — do not guess.
3. Read `core.carinaai.uk/src/web/pricing/success.html` in full. It currently shows a static `scout deploy --license-key ***` placeholder and the text "Your Scout API key appears in your account once the webhook has completed" — it does NOT render the actual issued key inline. Determine whether this is the intended secure design (key only ever shown inside the authenticated account/dashboard, never on a static post-payment page that could be screenshotted/shared) or a real gap relative to the spec's "shows API key" requirement (spec lines 81-96 / this prompt's prior Expected-behaviour claim). If `billing-api.ts` already exposes a `GET /api/billing/subscription` (or similar) endpoint returning `scout_api_key` for the authenticated tenant, the secure pattern is: `success.html` should fetch it client-side post-redirect and render it (or link to the dashboard view that does) rather than embed it in static HTML. Implement that small fetch-and-render addition to `success.html` ONLY if you confirm the API already returns the key and nothing currently renders it anywhere — otherwise document why the current design is correct as-is.
4. Run `pnpm vitest run src/billing` and confirm all 7 files / 14 tests still pass. Read each test file and cross-check it against `stripe-webhook.ts`'s five handled event types (`checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`, `invoice.payment_succeeded`) and `usage-meter.ts`'s three `UsageStatus` branches (under 80%, 80-99%, blocked at limit). If any branch has no corresponding test assertion, add ONE minimal test case for it in the existing `__tests__` file — do not restructure existing passing tests.
5. Confirm webhook signature verification is exercised by a test that supplies a bad/forged signature and asserts rejection (the spec calls this out as critical — a payment-fraud vector). If `stripe-webhook.test.ts` does not already cover this, add it.
6. Confirm idempotency: `stripe-webhook.ts` checks `stripe_events` for the event ID before processing (it does, per the code read in this prompt's Context). Confirm `stripe-webhook.test.ts` has a test that replays the same event ID twice and asserts the second call is a no-op (no double-write to `subscriptions`/`invoices`). Add this test if missing.
7. Verify `.env.example` (or the project's env template — `find core.carinaai.uk -maxdepth 1 -iname ".env*"`) documents `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and any `STRIPE_PRICE_*` vars `plans.ts` reads. Add any that are missing, with placeholder values only (never real keys).

## Expected behavior (what should be true once your verification/fixes land)
- `pnpm vitest run src/billing` passes with the original 14 tests plus any you added for genuinely uncovered branches
- `https://carinaai.uk`'s "Get Scout" CTA leads a visitor through to the working `/pricing` → `/checkout` → Stripe → `/billing/success` flow that already exists (or you have documented, with evidence, why it correctly does not)
- A forged webhook signature is rejected and a replayed valid event is a no-op — both proven by tests, not just code inspection
- The success page's API-key handling matches a deliberate, documented security decision (either "renders the real key via an authenticated fetch" or "intentionally never shows it outside the authenticated dashboard, here's where it does appear")
- `.env.example` documents every Stripe env var the code actually reads

## Test
- `pnpm vitest run src/billing` — all pass, including any new branch-coverage tests from steps 4-6
- Manual: `curl -s http://localhost:3000/pricing | head -5` returns the pricing HTML; `curl -s http://localhost:3000/checkout | head -5` returns the checkout HTML (server must be running — `pnpm dev`)
- Manual: a forged-signature POST to `/webhooks/stripe` returns 400 and inserts nothing into `stripe_events`

## Dependencies
- None — this is a verification-and-small-fixes pass on a feature that is already built. It does not block or get blocked by any other phase2-gap-closure spec.
- If Step 2 finds that `console.labyrinthscout.com` is supposed to have its own separate checkout (rather than linking to the one in `core.carinaai.uk`), that discovery may produce a NEW, separate follow-up spec — note it in your completion summary rather than scope-creeping this prompt to build it.
