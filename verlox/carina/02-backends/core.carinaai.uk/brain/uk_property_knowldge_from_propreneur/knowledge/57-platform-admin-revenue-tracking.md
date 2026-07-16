# Platform admin revenue tracking

**Prompt:** `brain/prompts/57-platform-admin-revenue-tracking.md`  
**Checklist:** row **57**

## Overview

Central admin financial visibility from existing billing tables (`subscriptions`, `subscription_plans`, `invoices`). No new Stripe integration.

## Key files

| Piece | Location |
|-------|----------|
| Analytics service | `app/Services/Admin/RevenueAnalyticsService.php` |
| Dedicated page | `app/Http/Controllers/Central/Admin/RevenueController.php` |
| View | `resources/views/central/admin/revenue/index.blade.php` |
| Dashboard cards | `AdminDashboardController` + `resources/views/central/admin/dashboard.blade.php` |
| Routes | `GET /admin/revenue`, `GET /admin/revenue/export` (`admin.revenue.*`) |
| Feature flag | `platform_revenue_dashboard` |
| Permission | `view-platform-revenue` (super_admin + admin via migration) |

## Metrics

- **MRR** - sum of monthly-normalised active plan prices (`status=active`, excludes `trialing`)
- **ARR** - MRR × 12
- **Recognised revenue** - sum of paid `invoices.amount` by period
- **Plan distribution** - active subs and estimated monthly revenue per plan
- **Trend** - last N months of paid invoice totals (PostgreSQL `to_char`)

Heavy aggregates cached 1 hour (`revenue_analytics:*` keys). Call `RevenueAnalyticsService::flushCache()` after test data or manual invalidation.

## Access

- **Dashboard snapshot** - all platform admins on `/admin`
- **`/admin/revenue`** - requires `platform_revenue_dashboard` flag + `view-platform-revenue` (or super admin)

## Verify

```bash
cd propreneur-v2
php artisan test tests/Feature/Central/PlatformRevenueDashboardTest.php
```

Open `http://localhost/admin` (central host) after `php artisan migrate` and feature flag sync.
