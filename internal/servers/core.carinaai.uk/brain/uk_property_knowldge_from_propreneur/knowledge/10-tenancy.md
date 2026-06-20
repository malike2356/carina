# Multi-Tenancy System

**Last updated:** 2026-05-15

## Overview
Database-per-tenant multi-tenancy via `stancl/tenancy` v3. Each tenant (workspace) gets an isolated PostgreSQL database. The central database holds tenants, domains, subscriptions, and platform admin data.

## Database Structure

- **Central DB:** `propreneur_central` - `tenants`, `domains`, `subscriptions`, `subscription_plans`, `feature_flags`, `platform_users`, `platform_settings`, `platform_job_schedules`, `backup_*`, `security_*`, `remote_access_*`, `ai_providers`, `ai_usage_logs`, `platform_carina_*`, `migration_*`
- **Tenant DB:** `propreneur_t_{uuid}` - all business data per workspace

## Tenant Model

`App\Models\Central\Tenant` extends stancl `Tenant` with `HasDatabase`, `HasDomains`.

Custom columns: `id`, `slug`, `company_name`, `owner_name`, `owner_email`, `plan` (starter/professional/enterprise), `trial_ends_at`, `is_active`, `edition`, `module_sets` (JSONB).

## Domain Resolution

The `InitializeTenancyBySubdomain` middleware extracts the tenant slug from the hostname subdomain. For `{slug}.propreneur.test`, it looks up the `domains` table, resolves the `Tenant`, and initializes the tenant database connection.

Middleware priority in `bootstrap/app.php`:
1. `web` group
2. Tenancy initialisation
3. `auth`
4. Subscription checks (`subscription.feature`)
5. Feature flag checks (`feature:...`)

## Feature Flags

`FeatureFlag` model (central DB): global flags with optional per-tenant overrides. Managed via `PlatformFeatureCatalogue` and admin UI at `/admin/feature-flags`. Used alongside subscription gates.

## Edition Split

`config/edition.php` controls Community Edition vs Business Edition. Business Edition owns: Carina AI, mentoring OS, viCal/booking, HR/payroll, business page CMS.

## Tenant Billing (Stripe)

- `Subscription` model links workspace to Stripe
- `SubscriptionPlan` - plan catalogue (CRUD at `/admin/subscription-plans`)
- `BillingModule` enum defines feature keys for subscription gates
- Module sets in `config/billing.php`: `starter_modules`, `professional_modules`, `enterprise_modules`, `mentor_modules`
- Billing API at `/api/billing/*`, Stripe webhooks at `/api/billing/webhook/stripe`

## Related
- `01-architecture.md` - middleware pipeline, route structure
- `09-auth.md` - authentication per tenant context
- `11-database.md` - migration structure, seeders
