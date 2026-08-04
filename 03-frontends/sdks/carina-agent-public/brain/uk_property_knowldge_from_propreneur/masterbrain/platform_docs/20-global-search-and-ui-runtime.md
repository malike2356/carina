# Global Search, UI Runtime, and Tenant Guards

**Updated:** 2026-04-30 (admin search: `use-admin-search`, theme hub: unified `/admin/ui/theme`, CssVariableService scopes, dark mode DOM rule)

## Purpose

This document describes cross-cutting UX and platform features that are not tied to a single business module: command-palette style search (central and tenant), shared Blade UI primitives, Alpine behaviours, theme injection, and post-login tenant guards (trial expiry).

Carina and in-app help should use this file when users ask how search works, why a trial workspace redirects, or where UI tokens come from.

## Platform admin global search

- **Route:** `GET /admin/search`, name `admin.search`. Middleware: `feature:platform_admin_search`, `platform.grant:use-admin-search`, throttle 60 per minute.
- **Controller:** `App\Http\Controllers\Central\Admin\AdminSearchController` (invokable) also checks `use-admin-search` via `hasAnyPlatformPermission` for JSON responses.
- **Service:** `App\Services\UI\PlatformGlobalSearchService`
- **Layout:** `LayoutComposer` sets `searchEndpoint` to `route('admin.search')` only when the flag is on **and** the user passes `hasAnyPlatformPermission('use-admin-search')` (super admin always passes `hasAnyPlatformPermission`).
- **Behaviour:** Minimum query length 2 characters. Searches `platform_users` (name, email, username) and central `tenants` (company_name, slug, owner_email). Returns titled rows with URLs (user edit, tenant edit).

## Tenant global search

- **Route:** `GET /search`, name `tenant.search`, middleware `auth` + `IdentifyTenantMiddleware`, throttle 60 per minute.
- **Controller:** `App\Http\Controllers\Tenant\TenantSearchController` (invokable).
- **Service:** `App\Services\UI\TenantGlobalSearchService` (tenant DB entities such as deals, contacts, properties).

## Feature flags (central)

Catalogue source: `App\Support\PlatformFeatureCatalogue` (sync via seeder, migration, or admin **Sync catalogue**). HTTP routes use middleware alias `feature:{key}` where wired in `routes/web.php`, `routes/tenant.php`, and `routes/api.php`.

Search and shell UX:

| Key | Meaning |
|-----|---------|
| `platform_admin_search` | Admin command palette backend at `/admin/search`. |
| `tenant_global_search` | Tenant `/search`. |

Platform administration:

| Key | Meaning |
|-----|---------|
| `saas_tenant_management` | `/admin/saas-tenancy`. |
| `platform_team_users` | `/admin/users/*` and stop impersonating. |
| `platform_team_roles` | `/admin/roles/*`. |
| `platform_user_two_factor` | `/admin/two-factor/*` (self-service TOTP for platform users). |
| `central_typed_settings` | `/admin/settings/*` and `/admin/setting-definitions/*`. |
| `central_platform_ai_keys_ui` | Legacy **Platform keys** at `/admin/platform-settings` (+ read-only `/admin/platform-settings/ai-providers`) and provider CRUD at **`/admin/ai/*`** (same grant `manage-platform-ai-keys`). |
| `admin_design_system_lab` | `/admin/ui/*` (theme form, component lab, accessibility stub). |
| `central_theme_presets` | Workspace preset CRUD routes under `/admin/theme/presets/*`; **when `admin_design_system_lab` is also on**, `GET /admin/theme/presets` redirects to **`/admin/ui/theme#workspace-presets`** and the sidebar shows one entry **Theme and presets**. |

Tenant experience:

| Key | Meaning |
|-----|---------|
| `tenant_workspace_branding` | `/settings/appearance` and theme JSON under `/api/theme/*`. |
| `tenant_user_invitations` | Guest `/invitations/{token}` accept flow. |
| `tenant_workspace_admin_api` | Workspace-admin JSON under `/api` (users, roles, invitations, tenant 2FA). |

Billing and lifecycle:

| Key | Meaning |
|-----|---------|
| `stripe_billing_api` | Central `POST /api/billing/webhook/stripe`; tenant `/api/billing/*` - see `17-billing-api.md`, `22-tenant-route-map.md`. |
| `trial_expiry_enforcement` | `IdentifyTenantMiddleware` redirects expired trials without subscription to `tenant.trial-expired`. |

See also `brain/knowledge/15-platform-admin.md` and `brain/knowledge/17-billing-api.md`.

**Workspace onboarding, invitations, tenant `/api` admin:** `brain/knowledge/19-tenant-workspace-onboarding-invitations-and-admin-api.md`.

## IdentifyTenantMiddleware

**Class:** `App\Http\Middleware\IdentifyTenantMiddleware`

**Applied to:** Authenticated tenant route group in `routes/tenant.php` (not guest auth routes).

**Responsibilities:**

1. Resolve current tenant via `TenantResolutionService`; abort 404 if missing.
2. Abort 403 if `is_active` is false on the central tenant row.
3. When `FeatureFlag::isEnabled('trial_expiry_enforcement', tenantId)` is true: if `trial_ends_at` is in the past and there is no active subscription, redirect to `route('tenant.trial-expired')`.
4. Structured log line `tenant_request` with slug and path.

Guest routes (`/login`, password reset) deliberately skip this middleware so users can still authenticate when the workspace is in a trial-expired state.

## Tenancy services

- **`App\Services\Tenancy\TenantCreationService`** - creates central tenant, domain, provisions tenant database, runs tenant migrations and bootstrap seeder.
- **`App\Services\Tenancy\TenantResolutionService`** - resolves the active central `Tenant` model for the current request (used by middleware and services).

## UI runtime and theme injection

- **Composer:** `App\View\Composers\LayoutComposer` binds `uiThemeCss` and `uiThemeClient` for layouts. Uses tenant theme services when tenancy is initialised; otherwise falls back to default `ThemePreset` or config-backed theme.
- **Partial:** `resources/views/partials/ui-runtime.blade.php` loads **before** `@vite` in `layouts/admin`, `layouts/app`, `layouts/auth`. It sets `window.__UI_THEME__`, runs an inline script that mirrors `dark-mode.js` (localStorage + `__UI_THEME__.mode`) so `html` gets `class="dark"` and `data-theme` **before** stylesheet paint, then injects `<style id="ui-theme-runtime">` when CSS variables exist.
- **CssVariableService:** Preset CSS splits **brand** tokens (`:root`) from **semantic** surface/text/border tokens. Semantic overrides apply only under `:root:not(.dark):not([data-theme="dark"])` so `html.dark` rules in `resources/css/app.css` always win in dark UI (no pale labels on dark chrome).
- **Dark mode:** Do **not** bind `x-bind:class` for `dark` on `<html>`; Alpine would fight `Alpine.store('darkMode')._apply()` which toggles `document.documentElement.classList`. Root layouts use `x-data` only on `<html>`.
- **Support:** `App\Support\UiThemeVariables` builds fallback CSS when no DB preset exists (central chrome).

## Alpine modules (Vite)

Registered from `resources/js/app.js` (see imports there). Examples:

- `global-search.js` - keyboard-driven palette behaviour.
- `modal.js`, `drawer.js`, `toast.js`, `tabs.js`, `accordion.js`, `dropdown.js`, `data-table.js`, `kanban.js`, `file-upload.js`, `keyboard-shortcuts.js`, `dark-mode.js`.

## Blade UI kit

Under `resources/views/components/ui/` (buttons, modals, drawers, alerts, command palette, etc.) and `resources/views/components/forms/` (inputs, selects, switches). Portal-specific composites live under `resources/views/components/portal/`.

## Tenant settings storage

**Table:** `tenant_settings` (tenant migration `2026_04_30_000001_create_tenant_settings_table`). Key-value rows with optional encryption flag for future secrets. Distinct from central `platform_settings` / `PlatformSetting`.

## Related tests

- `tests/Feature/AdminSearchTest.php`
- `tests/Feature/TenantSearchTest.php`
- `tests/Feature/TenantResolutionTest.php`
- `tests/Feature/TenantCreationTest.php`
- `tests/Feature/Central/FeatureFlagSeederTest.php`
