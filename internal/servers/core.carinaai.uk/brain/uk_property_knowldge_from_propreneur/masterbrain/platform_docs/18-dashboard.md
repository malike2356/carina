# Dashboard

**Updated:** 2026-05-01 (module-gated widgets aligned with sidebar and `TenantNavModuleAccess`)

## Overview

The dashboard is the tenant landing page after login. It summarizes metrics and recent activity **only for modules the workspace is allowed to use**, matching the sidebar (see `App\Support\Navigation\TenantNavModuleAccess` and `resources/views/layouts/app.blade.php`).

**Route:** `GET /` → `Tenant\DashboardController@index`  
**Route name:** `tenant.dashboard`  
**Middleware:** stancl tenant stack, `auth`, `IdentifyTenantMiddleware`, `EnsureWorkspaceOnboardingCompleted` (see `brain/knowledge/22-tenant-route-map.md`)

**Page title:** `Dashboard` (`@section('page-title')` in `resources/views/tenant/dashboard/index.blade.php`).

## Controller: `DashboardController`

Path: `app/Http/Controllers/Tenant/DashboardController.php`.

Loads:

- **`tenantNavModules`**: built with `TenantNavModuleAccess::mapForTenant()` (same rules as the sidebar) and passed explicitly so dashboard sections stay aligned even though Blade `@extends` scope differs from the layout composer.
- **`stats`**: property count, deal analysis count, contacts count, compliance items expiring within 30 days (queries always run; the **view** decides what to show).
- **`financials`**: aggregates from `properties` (value, debt, equity, monthly cashflow).
- **`recentProperties`**, **`recentDeals`**: latest rows for widgets.
- **`billingForDashboard`**: tenant admins only, when `stripe_billing_api` is enabled for the tenant (see `brain/knowledge/25-tenant-billing-ui-and-translations.md`).
- Stripe Checkout return flashes (`billing` query params) redirect with session flash messages.

## View: `resources/views/tenant/dashboard/index.blade.php`

Layout: `layouts.app`.

**`$tenantNavModules`** must match the sidebar: the controller passes the map; `LayoutComposer` also merges theme and nav context for `layouts.app`.

| Section | Shown when |
|--------|------------|
| Stat tiles (Properties, Active Deals, Contacts, Expiring Compliance) | Respectively `multi_property`, `deal_engine`, `crm`, `compliance` entries in `$tenantNavModules` |
| Empty explanation panel | None of those module gates are true |
| Portfolio financials (value, debt, equity, cashflow) | Portfolio (`multi_property`) allowed |
| Recent Properties widget | Portfolio allowed |
| Recent Deals widget | Deal Engine allowed |
| Billing card partial | `billingForDashboard` present (tenant admin + Stripe billing flag) |

There is **no** separate “quick actions” icon grid on this page; navigation uses the sidebar (and the billing anchor link when enabled).

## Data flow

1. User authenticates on the tenant host; tenant DB context is active.
2. Controller loads aggregates and recent lists from the tenant database.
3. Layout composer merges theme runtime and `tenantNavModules`.
4. View renders gated sections so users do not see metrics or links for modules they cannot open from the nav.

## Related

- Sidebar module gates: `TenantNavModuleAccess`, `layouts/app.blade.php`
- Billing UI: `brain/knowledge/25-tenant-billing-ui-and-translations.md`
- Routes: `tenant.properties.*`, `tenant.deals.*`, `tenant.contacts.*`, `tenant.compliance.*`, `tenant.carina.*`
