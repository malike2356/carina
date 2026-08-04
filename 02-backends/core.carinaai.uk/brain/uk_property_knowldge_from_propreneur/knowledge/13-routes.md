# Route Structure

**Last updated:** 2026-05-15

## Overview
Two main route groups: central (platform/admin) and tenant (workspace). Tenant routes require subdomain-based tenancy resolution. 17 route files, 972 total routes.

## Central Routes (Platform Domain)

File: `routes/web.php` - central domain (admin, auth, billing webhooks).

| Prefix | Purpose |
|--------|---------|
| `/admin/*` | Platform admin panel (settings, users, feature flags, backups, SCOUT, Carina, etc.) |
| `/platform/*` | Login, register, password reset, 2FA challenge |
| `/api/billing/webhook/stripe` | Stripe webhook (central URL) |
| `/theme/{slug}/css` | Public theme CSS |
| `/health` | Health check |

Includes: `admin_backup.php`, `admin_remote_access.php`, `admin_audit_logs.php`

## Tenant Routes (Subdomain)

File: `routes/tenant.php` - tenant-specific Blade and API routes under `{slug}.{domain}`.

**Public (no auth):**
- Login, password reset, public booking pages (`/book/*`), public vCal API (`/vical/*`), public mentoring packages (`/packages/*`), public mentoring intake (`/mentoring/apply/*`), extension listing capture (`/api/deal-extension-capture`), listing source webhooks

**Authenticated (auth middleware + feature gates):**
- Dashboard, properties, deals, contacts, pipeline, compliance, Carina, accounting, reporting, community learning, mentoring OS, viCal, investors, lead funnel, communications, automation, integrations, settings, team management

**Included route files:**
- `tenant_investors.php` - investor hub (funnel, KYC, pipeline, power team)
- `tenant_crm_api.php` - contact JSON API
- `tenant_lead_funnel_api.php` - lead funnel OAuth + API
- `tenant/pipeline_api.php` - pipeline JSON API
- `tenant-reporting.php` - reporting UI + API
- `tenant-community-learning.php` - community posts, groups, courses
- `tenant-mentoring-os-api.php` - mentoring JSON API
- `tenant_accounting_api.php` - accounting JSON API
- `tenant_vcal_api.php` - viCal JSON API
- `tenant-lms.php` - learning management system

## API Routes (JSON)

- `routes/api.php` - general JSON API prefix
- Tenant JSON APIs are under the authenticated middleware group in tenant.php and its includes
- Investor portal API: `/api/investor-portal/*` (Sanctum auth)

## Route Naming Convention

- Central: `admin.{resource}.{action}`
- Tenant Blade: `tenant.{module}.{action}`
- Tenant API: `tenant.api.{module}.{action}`

## Route Counts (generated)
- Tenant subdomain routes: 588
- Central/admin/filament routes: 384
- Total: 972

Regenerate with `php artisan route:list --json | python3 scripts/build-route-knowledge.py`

## Middleware Pipeline

```
web (CSRF, sessions, cookies)
  → tenancy initialisation (if subdomain)
  → auth (on authenticated routes)
  → subscription.feature (subscription gate)
  → feature:{key} (feature flag gate)
  → throttle (per-route rate limiting)
  → Controller
```

Subscription gate middleware: `App\Http\Middleware\CheckSubscriptionFeature`  
Feature flag middleware: `App\Http\Middleware\EnsureFeatureFlagEnabled`

## Related
- `01-architecture.md` - full middleware pipeline, tenancy
- `10-tenancy.md` - domain resolution details
