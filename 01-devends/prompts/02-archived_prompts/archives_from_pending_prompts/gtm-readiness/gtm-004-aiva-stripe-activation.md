# GTM 004: Aiva Stripe activation and post-trial payment gate

**Sprint:** GTM readiness
**Prompt number:** 04 of 04
**Name:** Wire Aiva billing so the first paying customer can subscribe and activate without manual intervention
**Primary agent:** Cursor / Claude Code
**Estimated hours:** 2-3 h
**Depends on:** Stripe credentials must be set in .env on VPS before this can be tested end to end. The code changes here are standalone.

**Status:** COMPLETED (2026-06-25)

---

## Acceptance criteria

- [x] After Stripe payment, success page polls for activation and shows "Your plan is active" with a link to the workspace
- [x] If polling times out, success page shows the support message with session ID
- [x] Cancelled page shows correct message and two CTAs
- [x] Cancelled page detects `?reason=trial_expired` and updates copy accordingly
- [x] `ManagePortalButton` does not call the portal API when `stripe_customer_id` is null
- [x] `createAivaCheckoutSession()` returns a clean error (not 500) when Stripe is not configured
- [x] `.env.production.example` has all 8 Aiva price ID vars plus Scout vars with inline comments
- [x] No em dashes, no emojis in any edited files

## Completion note

Completed 2026-06-25.

Implementation summary:

1. **Success page:** Shows "Payment received" immediately; polls `/api/aiva/subscription/status` every 2s (15 attempts); sets `aiva_plan_status=active` cookie on confirm; timeout copy includes `session_id` and support@carinaai.uk.
2. **Cancelled page:** "No charge was made" with Choose a plan / Back to workspace CTAs; `?reason=trial_expired` variant copy.
3. **ManagePortalButton:** `hasCustomer` prop disables portal when `stripeCustomerId` is null with tooltip.
4. **Billing status API:** `getBillingStatus()` now returns `stripeCustomerId` on subscription and top-level payload.
5. **aiva-stripe-checkout.ts:** Early `STRIPE_SECRET_KEY` check before Stripe client init.
6. **aiva-api.ts:** Checkout and portal routes return 503 (not 500) when Stripe is not configured.
7. **.env.production.example:** Documented all Aiva price IDs, Scout vars, and `AIVA_BILLING_ENABLED`.

End-to-end payment testing requires Stripe keys and price IDs on the VPS core backend.

---

## Do not touch

- Trial cron logic (`trial-email-cron.ts`)
- Subscription store database schema
- Scout billing code
- Middleware gate logic
- `.env` files (only edit `.env.production.example`)
