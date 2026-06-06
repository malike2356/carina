# Subscriptions, Billing, Trials, and Promo Codes

**Last updated:** 2026-05-20
**Routes:** `/settings/subscriptions` (tenant), `/platform/admin/promo-codes` (central admin)

## Overview

Central subscription management via Stripe. Each workspace has one active subscription plan. Plans control module access and usage limits. Trials, promo codes, referral trial extensions, and complimentary subscriptions are all supported.

## Plans (config/billing.php)

| Slug | Name | Price | Target |
|------|------|-------|--------|
| `investor` | Investor | £49/mo | Individual investors |
| `operator` | Operator | £99/mo | Property operators |
| `academy` | Academy | £199/mo | Mentor networks, educators |
| `ascensor` | Ascensor | £0/mo | Founder/complimentary access |

Seeder: `database/seeders/Central/SubscriptionPlanSeeder`. Run on deploy to sync DB with config. Slugs must remain stable once tenants subscribe.

## Trial periods

- Duration set by `TRIAL_DAYS` env var (default 14), accessed via `App\Support\Billing\StripeSettings::trialDays()`
- `tenants.trial_ends_at` set at signup
- `tenants.trial_locked_at` set when trial expires without paid subscription

### Trial lifecycle middleware

- `IdentifyTenantMiddleware` - redirects to `tenant.trial-expired` view when `trial_ends_at` past and no active subscription
- `EnsureTrialNotExpired` - blocks POST requests on `trial_locked_at` workspaces; GET/read-only allowed

### Automated trial expiry (scheduled)

```php
// routes/console.php
Schedule::call(fn () => app(TrialExpiryService::class)->lockExpiredWorkspaces())
    ->dailyAt('06:30')->name('billing:lock-expired-trials');

Schedule::call(fn () => app(TrialExpiryService::class)->sendWarnings(7))
    ->dailyAt('09:00')->name('billing:trial-warning-7d');

Schedule::call(fn () => app(TrialExpiryService::class)->sendWarnings(1))
    ->dailyAt('09:00')->name('billing:trial-warning-1d');
```

`TrialExpiryService::lockExpiredWorkspaces()` - locks all tenants where `trial_ends_at < now()` and no active subscription. Sends `TrialExpiredNotification`.

`TrialExpiryService::sendWarnings(int $days)` - sends `TrialExpiringNotification` to tenants whose trial ends in exactly N days. Cache-guarded (26h) to prevent duplicates.

### Post-trial payment path

1. Middleware redirects to `/trial-expired`
2. User clicks upgrade → `settings/subscriptions` → Stripe Checkout session
3. Stripe webhook `checkout.session.completed` → `SubscriptionService::onCheckoutSessionCompleted()` → activates subscription, clears `trial_locked_at`

## Promo codes vs referral codes

**Carina / support reference:** `152-promo-codes-vs-referral-codes.md` - when to use promo (`?promo=`) vs referral (`?ref=`), and how this differs from Stripe Dashboard coupons.

## Promo codes

Admin creates codes at `/admin/promo-codes`. Three discount types:

| Type | Effect |
|------|--------|
| `free_trial_days` | Extends `trial_ends_at` on the tenant and subscription |
| `percent` | Creates a Stripe coupon (% off) applied to customer |
| `fixed_gbp` | Creates a Stripe coupon (£ off) applied to customer |

### Duration control (Stripe coupon)

`promo_codes.duration` - `once`, `repeating`, `forever` (default). `promo_codes.duration_in_months` - required when `duration = repeating`.

### Double-redemption prevention

`PromoCodeService::redeem()` uses `lockForUpdate()` transaction + unique `promo_code_redemptions` constraint. A code can only be used once per workspace.

### Redemption at signup

Both the Blade form (`RegisterController`) and the marketing site API (`PublicSignupController`) accept `promo_code` at signup and call `PromoCodeService::redeem()`. Failures are logged but do not abort signup.

## Complimentary subscriptions

`subscriptions.is_complimentary = true` - excluded from MRR/ARR calculation. Separate counter in `RevenueAnalyticsService::complimentaryCount()`.

When admin sets a workspace to the `ascensor` (£0) plan, the subscription is automatically marked `is_complimentary = true`.

**Admin repair command** (for existing stale rows):
```bash
php83 artisan billing:sync-subscription-plan-ids --dry-run  # preview
php83 artisan billing:sync-subscription-plan-ids            # apply
```

## Referral programme

- Each workspace can generate a referral code (`ReferralProgrammeService::generateCode()`)
- New signups pass `referral_code` at registration (Blade and API flows both supported)
- `ReferralConversion` created with `status = pending`
- After 90 days with active subscription → `referral:qualify-conversions` marks it `qualified`
- `referrals:apply-trial-extensions` (runs daily at 02:15) extends referrer's trial on qualified conversions. Circular-referral guard and per-code cap enforced.
- `referral:calculate-credits` (monthly, 1st) calculates credit amounts for reporting

### Referral scheduler entries

```php
Schedule::command('referral:qualify-conversions')->dailyAt('02:00');
Schedule::command('referrals:apply-trial-extensions')->dailyAt('02:15');
Schedule::command('referral:calculate-credits')->monthlyOn(1, '03:00');
```

## Signup abuse prevention

`PublicSignupController` (marketing site API) includes:
- Disposable email domain blocklist (~60 known domains blocked at signup)
- `tenants.signup_ip` - records IP of signup request
- IP rate limit: 4th signup from same IP within 30 days returns 429

## Revenue dashboard

`App\Services\Admin\RevenueAnalyticsService`:
- `calculateMrr()` - sums `subscriptions.plan_id → subscription_plans.price` where `is_complimentary = false` and `status = active`
- `planDistribution()` - active non-complimentary subscriptions grouped by plan
- `flushCache()` - called after any admin plan change

**Admin plan change syncs `subscriptions.plan_id`** - when admin changes `tenants.plan`, the subscription row's `plan_id` is updated to match. This is critical for accurate MRR.
