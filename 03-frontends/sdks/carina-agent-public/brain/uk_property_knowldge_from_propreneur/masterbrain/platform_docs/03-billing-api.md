# Billing API (Stripe)

**Updated:** 2026-05-14 (Stripe billing API, webhook endpoints, subscription sync)

## Purpose

Stripe-related HTTP surfaces split by **host**:

1. **Central app** (`routes/api.php`) - Stripe **webhook** only (Stripe posts to your production central URL).
2. **Tenant subdomain** (`routes/tenant.php`) - JSON billing for logged-in tenant users and workspace admins (plans, subscriptions, portal, invoices).

Carina and support should read this file plus `brain/knowledge/22-tenant-route-map.md` for middleware context.

## Feature flag

Central feature key: **`stripe_billing_api`**. When off, gated routes return HTTP 404 (or feature middleware behaviour). Toggle at `/admin/feature-flags`.

## Central: webhook (`routes/api.php`)

- **Prefix:** `/api/billing` (Laravel `api` routing adds `/api`).
- **Route:** `POST /api/billing/webhook/stripe` → `Billing\WebhookController@handleStripeWebhook`.
- **Middleware:** `feature:stripe_billing_api` only (no session required for Stripe servers).
- **Signing secret:** From `config('billing.stripe_webhook_secret')` and/or central `platform_settings` key `stripe_webhook_secret` (implementation in controller and tests).

Feature tests: `tests/Feature/Billing/WebhookTest.php`.

## Tenant subdomain: customer billing JSON (`routes/tenant.php`)

Registered **outside** the `IdentifyTenantMiddleware` group so billing remains usable when trial enforcement redirects other routes.

**Authenticated:** `auth` + `feature:stripe_billing_api` + `throttle:60,1`.

| Segment | Extra middleware | Endpoints (relative to `/api/billing`) |
|---------|-------------------|----------------------------------------|
| Read-only plans | none | `GET plans`, `GET plans/{plan}` |
| Subscription + portal + invoices | `tenant.workspace_admin` | `POST subscribe`, `POST cancel`, `POST resume`, `PUT plan`, `GET portal`, `GET payment-methods`, `GET invoices`, `GET invoices/{id}`, `GET invoices/{id}/download` |

**Controllers:** `App\Http\Controllers\Billing\` - `PlanController`, `SubscriptionController`, `BillingPortalController`, `InvoiceController`, `WebhookController` (webhook only used from central `api.php` in current wiring).

## Subscription plan gating (`subscription.feature`)

Module routes (deals, properties, Carina, etc.) use `subscription.feature:{key}` together with `feature:{key}`. When `stripe_billing_api` is enabled for the tenant, `CheckSubscriptionFeature` enforces plan entitlements via `FeatureGatingServiceInterface`. See `brain/knowledge/22-tenant-route-map.md`.

## Tenant-facing UI and copy

Dashboard billing card, Checkout return flashes, trial-expired copy, and nav/banner strings use **`lang/en/billing.php`**. See **`brain/knowledge/25-tenant-billing-ui-and-translations.md`**.

## Related knowledge

- `brain/knowledge/15-platform-admin.md` - legacy platform billing keys under Platform keys.
- `brain/knowledge/11-database.md` - `subscription_plans`, `subscriptions`, `invoices`.
- `brain/knowledge/22-tenant-route-map.md` - full tenant middleware layout including `/api/billing`.
