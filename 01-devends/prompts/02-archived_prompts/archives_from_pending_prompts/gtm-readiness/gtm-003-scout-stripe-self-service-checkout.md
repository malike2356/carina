# GTM 003: Scout Stripe self-service checkout

**Sprint:** GTM readiness
**Prompt number:** 03 of 04
**Name:** Replace Scout mailto fallback with working Stripe self-service checkout
**Primary agent:** Cursor / Claude Code
**Estimated hours:** 3-4 h
**Depends on:** Nothing in code. Requires Stripe price IDs for Scout Monitor and Scout Govern to be set in .env before end-to-end testing.

**Status:** COMPLETED (2026-06-25)

---

## Read first

- Scout marketing CTA links: `03-frontends/marketing/labyrinthscout.com/index.html`
  - "Get Scout Monitor" links to `https://core.carinaai.uk/checkout?plan=scout_monitor`
  - "Get Scout Govern" links to `https://core.carinaai.uk/checkout?plan=scout_govern`
- Scout console checkout page: `02-backends/console.labyrinthscout.com/public/checkout.html`
- Core billing handler: `02-backends/core.carinaai.uk/src/billing/billing-api.ts`
- Plan resolution: `02-backends/core.carinaai.uk/src/billing/plans.ts`
- Core checkout HTML: `02-backends/core.carinaai.uk/src/web/pricing/checkout.html`
- Scout onboard page: `02-backends/console.labyrinthscout.com/public/onboard.html`

---

## Acceptance criteria

- [x] `normalizePlanId('scout_govern')` returns `'scout_pro'` (not `'scout_monitor'`)
- [x] `resolveStripePriceId('scout_govern')` resolves to `STRIPE_PRICE_SCOUT_GOVERN` env var
- [x] `https://core.carinaai.uk/checkout?plan=scout_monitor` shows a working checkout form
- [x] `https://core.carinaai.uk/checkout?plan=scout_govern` shows a working checkout form for the correct plan
- [x] `console.labyrinthscout.com/checkout` - no mailto CTAs remain; both cards have inline Stripe checkout forms
- [x] After Stripe payment, user lands on `console.labyrinthscout.com/onboard` and sees success message
- [x] If `STRIPE_SECRET_KEY` is not set, graceful error message shown (not a 500)
- [x] No em dashes, no emojis in any edited files

## Completion note

Completed 2026-06-25.

Implementation summary:

1. **plans.ts:** `scout_govern` now normalises to `scout_pro` (Scout Govern / `STRIPE_PRICE_SCOUT_GOVERN`).
2. **core checkout.html:** Updated copy, plan alias fix, success URL to `console.labyrinthscout.com/onboard?session={CHECKOUT_SESSION_ID}`.
3. **billing-api.ts:** Graceful 503 when Stripe is not configured; added `POST /api/billing/checkout/activate-session`.
4. **stripe-service.ts:** Lazy Stripe client init; `getCheckoutSession()` helper.
5. **console checkout.html:** Inline email/password forms with Stripe checkout session POST to core.
6. **onboard.html + account.ts:** Post-payment landing calls `/account/activate-session`, which proxies to core activate-session.
7. **Marketing CTAs:** Verified unchanged; links to core checkout with correct plan query params.

End-to-end Stripe checkout requires `STRIPE_SECRET_KEY`, `STRIPE_PRICE_SCOUT_MONITOR`, and `STRIPE_PRICE_SCOUT_GOVERN` on core before live payment testing.

---

## Do not touch

- Aiva billing (`src/billing/aiva-billing.ts`, `src/billing/aiva-stripe-checkout.ts`)
- Aiva subscription store
- app.carinaai.uk frontend
- `.env` files
- Existing Scout dashboard or governance features
