# Scout SaaS -- Prompt 5 of 6: Billing Integration
**Status: COMPLETED 2026-07-27**

**What was built:** Checkout/portal/webhook using SoT Monitor/Govern/Team price IDs

# Build Phase: Monetization
# Depends on: Prompt 2 (orgs), Prompt 4 (settings UI)
# Blocks: Going live
# Estimated time: 4-5 hours

## Context

Stripe price IDs and amounts are owned by `/opt/lampp/htdocs/verlox/.access/.stripe-credentials-and-price-id.md`. **Do not create new Stripe prices.** Do not paste secret keys into chat, commits, docs, or UI.

### Plans (source of truth)

| Plan | Amount | Price ID label in SoT | Agents (enforce) |
|------|--------|----------------------|------------------|
| Free | £0 | (no Stripe price) | 1 |
| Monitor | £99/mo | Scout Monitor | 5 |
| Govern | £199/mo | Scout Govern | 20 |
| Team | £399/mo | Scout Team | 50 |

Ignore older draft amounts (£29/£99 or £49/£79) in specs/code comments.

## Task

### Step 1: Env (labels only in .env.example)

```
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_MONITOR_PRICE_ID=price_1TqyO52WMXleLh8eOoMSRO5a
STRIPE_GOVERN_PRICE_ID=price_1TqyQ02WMXleLh8eAVQHwiRo
STRIPE_TEAM_PRICE_ID=price_1TqyQn2WMXleLh8eUqmCs1Oq
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
```

### Step 2: Checkout + portal (engine or dashboard API)

- `POST /api/billing/checkout` `{ plan: "monitor"|"govern"|"team", success_url, cancel_url }`
  - Find/create Stripe customer on org; save `stripe_customer_id`
  - Create Checkout session (`mode: subscription`) with SoT price id
  - metadata: `organization_id`, `plan`
- `GET /api/billing/portal` -> Billing Portal session URL

### Step 3: Webhook

`POST /webhooks/stripe` (raw body verify):

- `checkout.session.completed` -> set plan, `subscription_status=active`, `stripe_subscription_id`
- `customer.subscription.updated` -> sync status
- `customer.subscription.deleted` -> plan `free`, status `canceled`

Fix SQL placeholders carefully (no `$2` with one bind).

### Step 4: Settings UI

Show current plan, upgrade buttons (Monitor/Govern/Team), Manage Billing. Wire to checkout/portal.

### Step 5: Free-tier enforcement

Reuse plan middleware: max 1 agent; killswitch and premium alert channels blocked on free with `plan_limit` error + upgrade hint.

## Acceptance Criteria

- Checkout uses SoT price IDs only
- Webhook updates org plan/status
- Portal link works when customer exists
- Free limits enforced
- Secrets never committed
- No em dashes/en dashes; no emojis

## Files to Reference

- Stripe SoT: `/opt/lampp/htdocs/verlox/.access/.stripe-credentials-and-price-id.md`
- Carina billing patterns (reference): `propreneur/.../core.carinaai.uk/src/billing/`

## Post-build (MANDATORY)

Follow POST-BUILD-CHECKLIST. Batch-archive when all 6 are done.
