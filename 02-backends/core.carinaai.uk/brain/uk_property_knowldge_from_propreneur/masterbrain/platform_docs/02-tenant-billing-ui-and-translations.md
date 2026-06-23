# Tenant billing UI, Stripe checkout return, and translations

**Updated:** 2026-05-01

## Purpose

The JSON billing surface (`brain/knowledge/17-billing-api.md`) powers checkout and portal APIs; **Blade + Alpine** on the tenant app exposes plans, status, and error strings to workspace admins. All user-visible copy for this slice lives under **`lang/en/billing.php`** (Laravel `__()`). Broader locale switching and translation management are **not** implemented yet (see `brain/prompts/29-localization.md`).

## Dashboard billing card

- **Controller:** `App\Http\Controllers\Tenant\DashboardController`
- **When shown:** `billingForDashboard()` returns data only if the user has **`tenant_admin`**, central **`stripe_billing_api`** is enabled for the tenant, and central rows resolve (`Tenant`, `SubscriptionPlan` list).
- **View:** `resources/views/tenant/dashboard/partials/billing-card.blade.php` included from tenant dashboard index.
- **Behaviour:** Lists catalogue plans with Stripe-ready flags; chooses intro translation key (`billing.dashboard.intro` vs `intro_empty_catalog` vs `intro_plans_unconfigured`); exposes JS/UI strings under `$billingForDashboard['ui']` for checkout and portal fetch helpers.

## Stripe Checkout return UX

- **Method:** `redirectAfterStripeCheckout()` reads **`config('billing.checkout')`**: query param name (`state_query_param`, default `billing`), success/cancel values, redirect **`return_path`** (default `/dashboard`).
- **Flash messages:** `__('billing.checkout.success')`, `__('billing.checkout.cancelled')`.

## Attention banner and nav

- **Layout:** `resources/views/layouts/app.blade.php` renders **`billing.attention_banner`** when the controller/composer supplies `$billingAttentionBanner` (workspace admins vs members use `body_admin` / `body_member`).
- **Nav label:** `__('billing.nav.plans_and_billing')`.

## Trial expired page

- **View:** `resources/views/tenant/trial-expired.blade.php`
- **Keys:** `billing.trial_expired.*` (page title, heading, body, CTAs).

## Presentation helpers

- **`App\Support\Billing\BillingPresentation`** - currency symbol, plan interval suffix for translated price lines, subscription status labels mapped through `lang/en/billing.php` (`billing.dashboard.status_labels.*`), workspace anchor hash for scrolling.

## Tests (Pest)

- `tests/Feature/Billing/DashboardBillingCardTest.php`
- `tests/Feature/Billing/BillingAttentionBannerTest.php`
- `tests/Feature/Billing/CheckoutReturnToastTest.php`
- `tests/Unit/Support/BillingPresentationTest.php`

## Related

- `brain/knowledge/17-billing-api.md` - API routes and webhook.
- `brain/knowledge/22-tenant-route-map.md` - tenant `/api/billing` placement.
- `brain/knowledge/02-dashboard.md` - command centre overview.
