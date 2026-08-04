# Promo codes vs referral codes vs Stripe coupons

**Last updated:** 2026-05-20  
**Audience:** Platform admins, support staff, and **Carina** when answering billing, signup, or partner-programme questions.

**Related:** `125-subscriptions-billing.md`, `128-referrals-waitlist.md`, `82-stripe-billing-staging-sign-off.md`

## One-line rule (tell users this first)

- **Promo code** = a **deal for the person signing up** (extra trial days, % off, or fixed £ off).
- **Referral code** = **credit for the workspace that referred them** (attribution, trial extension for referrer, referral credits after qualifying period).
- **Stripe Dashboard coupon** = Stripe-only unless you also create a matching **promo code** in Propreneur.

## Decision tree

```
Is an EXISTING workspace being rewarded for sending a new customer?
  YES → Referral code (?ref=CODE)
  NO  → Is the NEW signup getting a discount or extra trial?
          YES → Promo code (?promo=CODE)
          NO  → Normal signup (no code)
```

## Promo codes (platform discounts)

**Admin UI:** `/admin/promo-codes` (platform sign-in required)  
**Service:** `App\Services\Billing\PromoCodeService`  
**Table:** `promo_codes`, `promo_code_redemptions` (central DB)

### When to use

| Scenario | Use promo? |
|----------|------------|
| Marketing campaign: "30 extra trial days" | Yes - type `free_trial_days` |
| Launch offer: "10% off first payment" | Yes - type `percent`, duration `once` |
| Fixed discount: "£20 off" | Yes - type `fixed_gbp` (value in pence) |
| Event/partner code for anyone | Yes |
| Existing customer referred someone | **No** - use referral |

### Discount types

| Type | Propreneur effect | Stripe |
|------|-------------------|--------|
| `free_trial_days` | Extends `tenants.trial_ends_at` and subscription trial | No Stripe coupon |
| `percent` | On redeem: creates Stripe coupon, attaches to customer | Yes - API-created coupon |
| `fixed_gbp` | Same as percent (amount off in GBP pence) | Yes - API-created coupon |

Duration for percent/fixed: `once`, `repeating` (+ `duration_in_months`), or `forever` (maps to Stripe coupon duration).

### Signup URLs and parameters

| Parameter | Example |
|-----------|---------|
| `promo` | `https://propreneur.uk/start?promo=LAUNCH10` |
| `promo_code` | `https://propreneur.uk/register?promo_code=LAUNCH10` |

**API:** `POST /api/v1/signup` JSON field `promo_code`.

**Handlers:** `PublicSignupController`, `RegisterController` call `PromoCodeService::redeem()`. Redemption failure is logged; signup usually still completes.

**Limits:** One redemption per workspace per code (`promo_code_redemptions` unique constraint). Optional `max_uses` and `expires_at` on the code.

### Stripe Dashboard coupons (important)

Coupons created manually in the [Stripe Dashboard](https://dashboard.stripe.com/coupons) (e.g. "First purchase discount", percentage, duration Once) are **not imported** into Propreneur.

- Propreneur **does not** read Stripe coupons automatically.
- For signup links and admin-managed codes, create the offer in **Promo codes**, not only in Stripe.
- On first redemption of a percent/fixed promo, Propreneur **creates** a Stripe coupon via API and stores `stripe_coupon_id`.

## Referral codes (workspace referral programme)

**Admin UI:** `/admin/referral-codes`  
**Service:** `App\Services\Referral\ReferralProgrammeService`  
**Tables:** `referral_codes`, `referral_conversions`, `referral_credits` (central DB)

### When to use

| Scenario | Use referral? |
|----------|---------------|
| Tenant A shares a link; Tenant B signs up | Yes |
| Track who referred which workspace | Yes |
| Extend referrer's trial after referee qualifies (~90 days paid) | Yes |
| Monthly referral credits for reporting | Yes |
| "20% off for all new signups this month" | **No** - use promo |

### Behaviour

1. Code is tied to **one referrer workspace** (`referral_codes.tenant_id`).
2. New signup passes `referral_code` or `ref`.
3. `tenants.referral_code_used` is stored; `referral_conversions` row `pending`.
4. After qualifying period (default 90 days) and active subscription → `qualified`.
5. Scheduled jobs: `referral:qualify-conversions`, `referrals:apply-trial-extensions`, `referral:calculate-credits`.

Referral codes are **not** Stripe coupons. They do not apply % off to the new customer's invoice by themselves.

### Signup URLs and parameters

| Parameter | Example |
|-----------|---------|
| `ref` | `https://propreneur.uk/start?ref=AB12CD34` |
| `referral_code` | Same as `ref` on register/API |

**API:** `POST /api/v1/signup` JSON field `referral_code`.

**Tenant UI:** Workspace may show its referral link/QR under settings/referrals (tenant-scoped).

## Using both on one signup

Allowed: `https://propreneur.uk/start?promo=LAUNCH10&ref=PARTNER1`

- **Promo** benefits the **new** workspace (trial/discount).
- **Ref** attributes the signup to the **referrer** workspace.

Only combine when both effects are intended.

## Waitlist referrals (different feature)

Pre-launch **waitlist** (`128-referrals-waitlist.md`) has its own waitlist referral tracking (`WaitlistReferral`). That is separate from the **workspace referral programme** (`referral_codes` for paying tenants). Do not confuse waitlist `ref` with SaaS referral codes unless the product flow explicitly links them.

## Carina response guidelines

When a user asks "promo or referral?":

1. Ask what they want: **discount for new signup** vs **reward existing customer for a referral**.
2. Point admins to the correct screen: `/admin/promo-codes` vs `/admin/referral-codes`.
3. If they mention Stripe Dashboard coupons, explain they must mirror the offer in **Promo codes** for `?promo=` signup, or apply Stripe coupons manually in Stripe.
4. Do not tell users to create duplicate coupons in Stripe and Propreneur unless they understand only the Propreneur promo drives automated signup redemption.

When a user asks "my referral code didn't give me a discount":

- Referral codes do **not** give the **new** customer a Stripe discount; check whether they meant a **promo code**.

When a user asks "promo didn't work":

- Check code active, not expired, not exhausted, not already redeemed for that workspace.
- Percent/fixed need a Stripe customer at redeem time; `free_trial_days` only needs tenant row.
- See signup error logs / `promo_code_redemptions`.

## Key code references

| Concern | Location |
|---------|----------|
| Promo redeem | `app/Services/Billing/PromoCodeService.php` |
| Referral signup | `app/Services/Referral/ReferralProgrammeService::recordSignup()` |
| Marketing signup | `app/Http/Controllers/Api/PublicSignupController.php` |
| Share URLs | `app/Services/Share/ShareLinkService.php` (`promoSignupUrl`, `referralSignupUrl`) |
