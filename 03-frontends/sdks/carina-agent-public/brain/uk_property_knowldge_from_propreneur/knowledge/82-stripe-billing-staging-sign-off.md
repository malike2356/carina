# Xelox Staging Stripe Sign-Off Checklist

Ops checklist to verify Stripe billing is wired correctly for the Xelox tenant before
going live. Complete every item top to bottom in a Stripe **test-mode** account. Do not
run against live keys until the final sign-off step.

---

## 1. Environment Preparation

- [ ] Confirm `.env` has `APP_ENV=staging` (never `production` at this stage)
- [ ] Set Stripe **test-mode** keys:
  ```
  STRIPE_KEY=pk_test_...
  STRIPE_SECRET=sk_test_...
  STRIPE_WEBHOOK_SECRET=whsec_test_...          # from Stripe CLI or dashboard listener
  STRIPE_BILLING_PUBLISHABLE_KEY=pk_test_...
  STRIPE_BILLING_SECRET_KEY=sk_test_...
  STRIPE_BILLING_WEBHOOK_SECRET=whsec_test_...
  ```
- [ ] Set plan price IDs from Stripe test dashboard:
  ```
  STRIPE_PRICE_SOLO=price_test_...
  STRIPE_PRICE_OPERATOR=price_test_...
  STRIPE_PRICE_MENTOR_NETWORK=price_test_...
  STRIPE_PRICE_STARTER_PAYG=price_test_...
  ```
- [ ] Run `php artisan config:clear && php artisan cache:clear`
- [ ] Confirm Xelox tenant exists: `php artisan app:reseed-dev-accounts` (if staging DB is fresh)
- [ ] Confirm Xelox plan is `mentor_network` in `tenants` table

---

## 2. Webhook Listener

- [ ] Start Stripe CLI listener forwarding to the staging webhook endpoint:
  ```bash
  stripe listen --forward-to https://staging.propreneur.co.uk/api/billing/webhook/stripe
  ```
  (or the equivalent staging URL; see `routes/api.php` line 18)
- [ ] Copy the `whsec_test_...` signing secret printed by the CLI into `.env` as
  `STRIPE_BILLING_WEBHOOK_SECRET`
- [ ] Confirm the `stripe_billing_api` feature flag is **enabled** for Xelox:
  ```sql
  SELECT key, enabled FROM feature_flags WHERE key = 'stripe_billing_api';
  ```

---

## 3. Subscription Checkout Flow

- [ ] Log in as `xeloxproperties@gmail.com` on the Xelox workspace
- [ ] Navigate to workspace billing settings
- [ ] Initiate upgrade / subscription checkout
- [ ] Complete Stripe Checkout with test card `4242 4242 4242 4242`, expiry any future date, CVC any 3 digits
- [ ] Confirm redirect back to the workspace with no error
- [ ] Confirm Stripe Dashboard (test mode) shows a new subscription for the Xelox customer
- [ ] Confirm `subscriptions` table in the central DB has a row for the Xelox tenant with status `active`

---

## 4. Webhook Event Delivery

After the checkout above, Stripe fires several events. Verify each reaches the app:

- [ ] `checkout.session.completed` handled without 4xx/5xx (check `storage/logs/laravel.log`)
- [ ] `customer.subscription.created` handled -- subscription row in DB updated to `active`
- [ ] `invoice.payment_succeeded` handled -- no duplicate journal entry errors
- [ ] Re-trigger via CLI if needed: `stripe trigger customer.subscription.created`

---

## 5. Invoice and Billing Email

- [ ] Stripe test invoice email is delivered (check Mailpit / staging mail catcher)
- [ ] If Propreneur generates its own invoice: confirm a `journal_entries` row exists for the payment
- [ ] Confirm accounting GL code for subscription revenue is correct (check `config/billing.php` `revenue_account_code`)

---

## 6. Plan Feature Gates

With Xelox on `mentor_network`:

- [ ] `booking_calendar` feature flag is enabled (viCal should be accessible)
- [ ] `deal_engine` flag is enabled (Deals hub / Deal Board accessible)
- [ ] `mentoring` flag is enabled (Mentoring OS accessible)
- [ ] Navigate to each gated module and confirm no 403 or "feature unavailable" flash
- [ ] Downgrade to `starter` plan in Stripe test dashboard, trigger `customer.subscription.updated`
  webhook, and confirm gated modules become inaccessible within one page load

---

## 7. Payment Method Update

- [ ] Navigate to billing settings > payment method
- [ ] Use Stripe customer portal (or built-in UI) to update card to `5555 5555 5555 4444` (Mastercard test)
- [ ] Confirm update succeeds and Stripe customer record reflects new default payment method

---

## 8. Cancellation Flow

- [ ] Cancel the subscription via the workspace billing UI
- [ ] Confirm Stripe dashboard shows subscription status `canceled` (or `cancel_at_period_end`)
- [ ] Confirm `customer.subscription.deleted` webhook arrives and is handled
- [ ] Confirm tenant plan in DB is downgraded / marked inactive at period end
- [ ] Confirm gated modules show "plan required" after cancellation takes effect

---

## 9. Error Path Verification

- [ ] Attempt checkout with declined card `4000 0000 0000 0002`
  -- confirm user sees a clear error, no orphaned subscription row in DB
- [ ] Send a webhook with an invalid signature (tamper `whsec_` value)
  -- confirm the app returns 400 and logs a warning, does not process the event
- [ ] Confirm idempotency: replay a previously handled `invoice.payment_succeeded` event
  -- confirm no duplicate journal entry or double-credit

---

## 10. Final Sign-Off

- [ ] All items above checked
- [ ] No errors in `storage/logs/laravel.log` related to billing or webhooks
- [ ] QA sign-off by responsible team member: ________________ Date: ________
- [ ] Switch `.env` Stripe keys to **live-mode** (`sk_live_...`, `pk_live_...`, `whsec_live_...`)
  only after this checklist is fully complete
- [ ] Remove Stripe CLI listener; register the webhook endpoint in the Stripe live dashboard instead

---

## Reference

| Config key | Location |
|---|---|
| Stripe keys | `.env` -- `STRIPE_*` and `STRIPE_BILLING_*` |
| Price IDs | `.env` -- `STRIPE_PRICE_*` |
| Webhook route | `routes/api.php:18` -- `POST /api/billing/webhook/stripe` |
| Billing config | `config/billing.php` |
| Webhook handler | `app/Http/Controllers/Api/WebhookController.php` |
| Billing service | `app/Services/Billing/` |
