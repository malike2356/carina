# Bug Fixes & Build Log

## Overview

This document records all bugs found and fixed during the Propreneur v2.0 build. It serves as a reference for similar issues and as documentation of the project's evolution.

## Fix #1: AppServiceProvider - Missing `getTenantMigrationPaths` Method

**Date:** 2026-04-30  
**File:** `app/Providers/AppServiceProvider.php`  
**Package:** `stancl/tenancy` v3.10

### Problem

```php
// Original code in AppServiceProvider::boot()
Tenancy::getTenantMigrationPaths()->prepend(database_path('migrations/tenant'));
```

This threw `BadMethodCallException: Method Stancl\Tenancy\Tenancy::getTenantMigrationPaths does not exist.`

### Root Cause

The `getTenantMigrationPaths()` method was removed in stancl/tenancy v3.x. The `DealsWithMigrations` trait handles tenant migration discovery automatically from `database/migrations/tenant/`.

### Fix

Removed the call entirely. The package auto-discovers tenant migrations.

### Files Changed

- `app/Providers/AppServiceProvider.php`

---

## Fix #2: Contact Model - Split `name` into `first_name` / `last_name`

**Date:** 2026-04-30  
**File:** `app/Models/Tenant/Contact.php`

### Problem

The original model used a single `name` column, but the application needs separate first/last names for proper CRM functionality (sorting, filtering, personalisation).

### Fix

1. Changed `$fillable` from `'name'` to `['first_name', 'last_name', ...]`
2. Added virtual `getNameAttribute()` accessor: `return "{$this->first_name} {$this->last_name}";`
3. Added `fullName()` helper method
4. Added relationships: `assignee()`, `creator()`, `activities()`, `pipelineItems()`

### Impact

All views that displayed `$contact->name` continue to work via the accessor. Forms were updated to use separate `first_name` and `last_name` inputs.

---

## Fix #3: Property Model - Missing `complianceItems()` Relationship

**Date:** 2026-04-30  
**File:** `app/Models/Tenant/Property.php`

### Problem

Compliance views reference `$property->complianceItems()` but this relationship was not defined in the Property model. This caused `Call to undefined method` errors when viewing a property's compliance items.

### Fix

Added the missing relationship:

```php
public function complianceItems()
{
    return $this->hasMany(ComplianceItem::class);
}
```

---

## Fix #4: ContactController - Wrong Validation Fields

**Date:** 2026-04-30  
**File:** `app/Http/Controllers/Tenant/ContactController.php`

### Problem

The controller validated a `name` field that no longer exists, and returned `compact('contact')` with `eager load` for activities in the show method. Store/update still expected `name` instead of `first_name` + `last_name`.

### Fix

Complete rewrite of the controller:

- Validation: `first_name` (required), `last_name` (required), `email` (optional)
- Store: sets `created_by` = Auth::id()
- Show: eager-loads activities (latest 10)
- Search: uses `ilike` for PostgreSQL case-insensitive matching

---

## Fix #5: Contact Views - Inconsistent Field Names

**Date:** 2026-04-30  
**Files:**

- `resources/views/tenant/contacts/index.blade.php`
- `resources/views/tenant/contacts/create.blade.php`
- `resources/views/tenant/contacts/edit.blade.php`
- `resources/views/tenant/contacts/show.blade.php`

### Problem

All four views referenced `name` instead of `first_name` / `last_name`. The create form didn't submit to the right route, and the index table used incorrect column names.

### Fix

Rewrote all four views with:

- `first_name` and `last_name` form inputs (create + edit)
- `$contact->name` virtual attribute for display (index + show)
- Proper route names in form actions
- Consistent type filter options matching controller validation
- Activity log integration in show view

---

## Fix #6: Compliance Views - Column Name Mismatches

**Date:** 2026-04-30  
**Files:**

- `resources/views/tenant/compliance/index.blade.php`
- `resources/views/tenant/compliance/create.blade.php`
- `resources/views/tenant/compliance/edit.blade.php`
- `resources/views/tenant/compliance/show.blade.php`

### Problems Found

| Old (broken) | New (correct) | Files Affected |
|---|---|---|
| `address_line_1` | `address_line1` | index, create, edit, show |
| `computed_status` | `status` | index, show |
| `expiry_date` | `expires_at` | index, create, edit, show |
| `issue_date` | `issued_at` | create, edit, show |

### Root Cause

The model was designed with UK-standard column names (`issued_at`, `expires_at`, `address_line1`) but the initial views were built with different conventions.

### Fix

Applied find-and-replace across all four compliance blade files to match the actual model column names.

---

## Fix #7: Pipeline - Missing `_board.blade.php` Partial

**Date:** 2026-04-30  
**File:** `resources/views/tenant/pipeline/_board.blade.php`

### Problem

The pipeline index and show views reference `@include('tenant.pipeline._board')` but this file didn't exist, causing a `ViewNotfoundException`.

### Fix

Created the missing partial with a full kanban board implementation:

- Grid layout for stages
- Stage headers with colored dots and item counts
- Draggable item cards with title, value, close date
- Empty state with drop zone
- Delete button on each card

---

## Fix #8: Deal Engine - Route Name `tenant.deals.carina` vs `tenant.deals.narrative`

**Date:** 2026-04-30  
**File:** `routes/tenant.php`

### Problem

The view referenced `route('tenant.deals.carina')` but the route was named `tenant.deals.narrative`, causing a route resolution error.

### Fix

Renamed the route from `tenant.deals.narrative` to `tenant.deals.carina` to match the view reference.

---

## Fix #9: Missing `.env` File

**Date:** 2026-04-30  
**File:** `.env` (new)

### Problem

The `.env` file was missing from the project (not in `.gitignore` - just not created after `git clone` or `git init`). This caused `MissingAppKeyException` and database connection failures.

### Fix

Created a `.env` file with:

- `APP_KEY` generated via `php artisan key:generate`
- `DB_CONNECTION=pgsql` pointing to `propreneur_central`
- `TENANT_BASE_DOMAIN=propreneur.test`
- Working credentials (`propreneur` / `local_dev_password`)

---

## Fix #10: PostgreSQL Authentication

**Date:** 2026-04-30

### Problem

PostgreSQL was configured with `peer` auth for local socket connections and `scram-sha-256` for TCP, preventing the `propreneur` user from connecting with a password.

### Fix

1. Updated `pg_hba.conf` to use `trust` for socket and `md5` for TCP
2. Created `propreneur` role with `CREATEDB` permission
3. Created `propreneur_central` database

---

## Fix #11: Tenant Creation - Missing `slug` Column

**Date:** 2026-04-30  
**File:** `app/Models/Central/Tenant.php`

### Problem

Creating a tenant without a `slug` caused a NOT NULL constraint violation because the `slug` column is required by the custom columns definition.

### Fix

Ensured tenant creation includes `'slug' => 'test'` alongside other required fields.

---

---

## Fix #12: Central Routes - URI Conflict with Tenant Routes

**Date:** 2026-04-30

### Problem

Both `routes/web.php` (central) and `routes/tenant.php` (loaded via TenancyServiceProvider `booted()`) registered `GET /login`. Since tenant routes load AFTER central routes, they overwrote the central route in Laravel's route collection hash map. Requests to `/login` on the central domain hit the tenant route's `PreventAccessFromCentralDomains` middleware and returned 404.

### Root Cause

`stancl/tenancy` loads tenant routes in an `app()->booted()` callback, which runs after all service provider `boot()` methods. Laravel's route collection indexes routes by URI+method - the last registered route with a given URI wins in the named route cache, overwriting the earlier one. This silently hid `central.login` from `route:list`.

### Fix

Moved all central platform auth routes to the `/platform` prefix:
- `/login` → `/platform/login` (named `central.login`)
- `/logout` → `/platform/logout` (named `central.logout`)

This eliminates the URI conflict entirely. Tenants continue to use `/login` (named `tenant.login`).

### Files Changed
- `routes/web.php`
- `resources/views/central/auth/login.blade.php`

---

## Fix #13: CarinaService - No Fallback on Provider API Error

**Date:** 2026-04-30

### Problem

`CarinaService::resolveProvider()` picked the first provider with a non-empty API key and returned it. If that key was invalid or the API returned an error, it threw a `RuntimeException` without trying the next provider in the priority chain.

### Fix

Replaced `resolveProvider()` + `callProvider()` with a single `callWithFallback()` method that iterates the priority chain, catches errors per-provider, logs warnings, and moves to the next provider. Only throws if ALL providers fail.

### Pattern

```php
foreach ($priority as $provider) {
    if (empty(config("ai.providers.{$provider}.api_key"))) continue;
    try {
        return $this->callAnthropic/callOpenAiCompat(...);
    } catch (\Throwable $e) {
        Log::warning("Carina: provider '{$provider}' failed, trying next.");
    }
}
throw new \RuntimeException('All AI providers failed.');
```

---

## Fix #14: PostgreSQL `propreneur_testing` schema behind central migrations

**Date:** 2026-05-01

### Problem

`php artisan test` failed with `Undefined column: workspace_onboarding_completed_at` on `tenants` (connection `central`) and many dependent failures. `php artisan migrate` against `.env` updated **`propreneur_central`** only; **`phpunit.xml`** points Feature tests at **`propreneur_testing`**.

### Fix

Align the testing database with the same migrations the suite expects:

```bash
APP_ENV=testing DB_DATABASE=propreneur_testing CENTRAL_DB_DATABASE=propreneur_testing TENANCY_MAINTENANCE_DB=propreneur_testing php artisan migrate:fresh --force
```

`tests/Concerns/RefreshDatabase.php` runs `migrate:fresh` when tests execute; if the testing DB was created manually or drifted while migrations were edited, reset it as above. If PostgreSQL reports **`deadlock detected`** during `migrate:fresh`, stop parallel test runners and retry once. Missing central tables such as **`ai_providers`** mean this reset was skipped or only the default (`.env`) database was migrated.

---

## Fix #15: Central settings Feature tests and deal playground request host

**Date:** 2026-05-02

### Problem

1. **`SettingControllerTest`** / **`SystemSettingsHttpTest`** intermittently failed with **`UniqueConstraintViolationException`** on `setting_definitions.key` when the same keys were reused across examples (PostgreSQL transaction boundaries vs. the `central` connection in tests).
2. **`DealCalculatorPlaygroundTest`** expected **200** but got **404** because **`$this->call('GET', '/deals/...', …, ['HTTP_HOST' => $host])`** did not initialise tenancy the same way as tenant Feature tests that use a **full URL** (`http://{host}/path`).

### Fix

1. **`beforeEach`**: delete matching rows from **`settings`** then **`setting_definitions`** for the keys each file uses, before creating the super admin user.
2. **`DealCalculatorPlaygroundTest`**: replace `call()` with **`$this->get('http://'.$host.'/deals/calculator-playground')`**; in **`beforeEach`**, force **`deal_engine`** flag on and clear **`tenant_overrides`** so other tests cannot leave the module disabled for the same DB.

---

## Fix #17: `tests/Concerns/RefreshDatabase` retries `migrate:fresh` on PostgreSQL races

**Date:** 2026-05-02

### Problem

Parallel **`php artisan test`** runs (or deadlocks during **`migrate:fresh`**) against **`propreneur_testing`** produced **`SQLSTATE[40P01]`** deadlocks, missing **`migrations`** / **`domains`**, or **`23505`** duplicate catalog rows for **`migrations`**, causing huge failure cascades.

### Fix

**`tests/Concerns/RefreshDatabase.php`**: up to **8** attempts at **`migrate:fresh`**; on transient errors, reset **`RefreshDatabaseState::$migrated`**, **`db:wipe`** the default connection (and **`central`** when it is a separate physical DB), backoff **`usleep`**, and broaden **`isTransientMigrateFreshFailure()`** to match the messages above. Keep **`refreshTestDatabase`** schema probes so a half-wiped DB forces a remigrate.

**Operational:** Prefer a **single** test process per testing database.

---

## Fix #16: Admin UI theme routes return 404 after another test toggles feature flags

**Date:** 2026-05-02

### Problem

**`Tests\Feature\UI\ThemeRouteTest`** and **`ThemePresetControllerTest`** received **404** on **`/admin/ui/*`** when **`admin_design_system_lab`** (or **`central_theme_presets`**) was left disabled by earlier tests in the same run.

### Fix

- Seed **`FeatureFlagSeeder`** in **`beforeEach`** and set **`admin_design_system_lab`** (and **`central_theme_presets`** for preset flows) to **`enabled`** with **`tenant_overrides`** cleared.
- Wrap the example that turns the lab **off** in **`try` / `finally`** so the flag is restored for later tests.

---

## Fix #17: Tenant route implicit model binding runs before the tenant DB is selected

**Date:** 2026-05-02

### Problem

`SubstituteBindings` is part of the `web` middleware group, which runs before `InitializeTenancyBySubdomain` on tenant domain routes (`TenancyServiceProvider` stacks `web` then tenancy). Implicit tenant model resolution can query the wrong connection, fail silently, or leave the route parameter as a **string**, causing **TypeError** (e.g. `Pipeline` expected, string given) on `/pipelines/{id}` as well as CRM routes.

### Fix

Resolve the route key explicitly after all middleware, for example `Contact::query()->findOrFail((int) $request->route('contact'))` or `Pipeline::query()->findOrFail((int) $request->route('pipeline'))`, instead of type-hinting the tenant model on the action.

### Files Changed

- `app/Http/Controllers/Api/Crm/ContactController.php`
- `app/Http/Controllers/Api/Crm/ContactInteractionController.php`
- `app/Http/Controllers/Tenant/ContactController.php`
- `app/Http/Controllers/Tenant/PipelineController.php`

---

## Fix #18: Pipeline Kanban - `pipeline_items` to `pipeline_deals` and web/API alignment

**Date:** 2026-05-02

### Problem

Web `PipelineController` validated `pipeline_stage_id` while the tenant migration used `stage_id` on `pipeline_items`. Blade referenced `deal_value` and `description` on a model that exposed `value` only. No activity log, no JSON API per `13-pipeline-kanban.md`.

### Fix

Tenant migration `2026_05_02_450000_pipeline_kanban_deals_and_activities.php` renames the table and columns, adds `pipeline_activities`, JSON `notes`, `entered_stage_at`, and stage metadata. New services and `/api/pipeline/*` routes; web routes use `/deals` and `stage_id`. Consolidated Pest coverage in `tests/Feature/Pipeline/PipelineControllerTest.php`.

### Note

If `migrate:fresh` on **`propreneur_testing`** fails with **`pg_type_typname_nsp_index`** or deadlocks, terminate other sessions using that database or recreate the database before re-running tests.

### Follow-up: duplicate `api/pipeline/analytics/*`

**`routes/tenant-reporting.php`** registered the same paths as **`routes/tenant/pipeline_api.php`** (different controllers). Removed the reporting route group and **`App\Http\Controllers\Api\Reporting\PipelineAnalyticsController`**. **`App\Services\Reporting\PipelineAnalyticsService`** remains for dashboard widgets and reporting code.

---

## Fix #19: TenantBootstrapSeeder central lookup during tenant context

**Date:** 2026-05-02

### Problem

`TenantBootstrapSeeder::run()` called `CentralTenant::on('central')->findOrFail(tenant()->getTenantKey())` immediately after `tenancy()->initialize()`. On the shared Postgres testing database this intermittently failed with `relation "tenants" does not exist` on the `central` connection, and `CarinaAccessGateTest` (when run as a Unit test with its own `migrate:fresh`) could leave `RefreshDatabaseState` inconsistent for the next test class.

### Fix

1. `TenantBootstrapSeeder::run(?CentralTenant $centralTenant = null)` uses the passed model when provided; otherwise keeps the old lookup for `tenants:seed` style entry points.
2. `TenantCreationService::invokeTenantBootstrapSeeder(Tenant $tenant)` passes the freshly created central tenant into the seeder.
3. Moved **`CarinaAccessGateTest`** to **`tests/Feature/Carina/`** so it uses the global Feature `RefreshDatabase` scope (no second `migrate:fresh` lifecycle in the same run).

### Files Changed

- `database/seeders/Tenant/TenantBootstrapSeeder.php`
- `app/Services/Tenancy/TenantCreationService.php`
- `tests/Feature/Carina/CarinaAccessGateTest.php` (from `tests/Unit/Carina/`)

---

## Fix #20: Guest tenant pages and shared Postgres test teardown

**Date:** 2026-05-03

### Problem

1. **`layouts.app`** includes `<x-nav.top-profile-menu variant="tenant" />`, which used **`abort_unless(Auth::user(), 403)`**. Public viCal pages under `/book/{slug}` must work for guests; the controller could return 200 but the layout still aborted.
2. **`TenantCreationService`** rollback always ran **`$tenant->domains()->delete()`** during **`provisionDatabase()`** failures. When another test process left **`propreneur_testing`** without a **`domains`** table, rollback threw **`QueryException`** and masked the original error.
3. **Subdomain route parameters:** tenant routes use **`Route::domain('{tenant_subdomain}.'.config(...))`**. Action methods that took **`string $slug`** as the first route-backed argument received **`tenant_subdomain`** (first merged parameter) instead of the path **`slug`**, so **`PublicBookingController`** looked up **`User::where('booking_public_slug', $wrong)`** and returned **404**.

### Fix

1. **`resources/views/layouts/public-tenant.blade.php`**: minimal guest shell (theme toggle + workspace sign-in). **`tenant/vical/public-book`** and **`public-thanks`** extend it instead of **`layouts.app`**.
2. **`top-profile-menu`**: tenant variant shows a **Workspace sign in** link when **`Auth::user()`** is null instead of aborting.
3. **`TenantCreationService`**: rollback deletes **`domains`** / **`tenants`** only when **`Schema::connection('central')->hasTable(...)`** is true.
4. **`VcalModuleTest`**: **`uses(RefreshDatabase::class)`** so the viCal suite always starts from a migrated catalog.
5. **`PublicBookingController`**: read **`slug`** (and **`token`** on thanks) from **`$request->route(...)`** instead of **`string $slug`** method injection.
6. **`CarinaController`** (`startFrom*` routes) and **`PropertyAddressController`**: same domain-parameter ordering; read IDs from **`$request->route('...')`**.
7. **`VcalCrmBridge`**: new CRM contacts require **`first_name`** / **`last_name`**; derive them from the guest display name (or email local-part) when creating from a public booking.

### Files Changed

- `resources/views/layouts/public-tenant.blade.php`
- `resources/views/tenant/vical/public-book.blade.php`
- `resources/views/tenant/vical/public-thanks.blade.php`
- `resources/views/components/nav/top-profile-menu.blade.php`
- `app/Services/Tenancy/TenantCreationService.php`
- `app/Http/Controllers/Tenant/PublicBookingController.php`
- `app/Http/Controllers/Tenant/CarinaController.php`
- `app/Http/Controllers/Tenant/PropertyAddressController.php`
- `app/Services/Vcal/VcalCrmBridge.php`
- `tests/Feature/Vcal/VcalModuleTest.php`

---

## Lessons Learned

1. **Always check package version APIs** - `stancl/tenancy` changed its API between v3.9 and v3.10
2. **View ↔ Controller ↔ Model consistency** - A column name mismatch can affect 4+ files silently
3. **`create_new_file` vs shell heredoc** - Blade files with `{{ }}` syntax are best created via the file creation tool, not bash heredocs
4. **Blade `@error` directive** - Always match error bag keys to input `name` attributes
5. **PostgreSQL `ilike`** - Laravel's `where('column', 'LIKE', '%x%')` is case-sensitive in PG; use `where('column', 'ilike', '%x%')` instead
6. **stancl/tenancy route conflict** - Never share URI paths between central (web.php) and tenant (tenant.php) routes. Always prefix central admin routes to avoid collision.
7. **AI provider fallback** - Don't assume a non-empty API key is valid. Implement try/catch fallback through the provider chain so one bad key doesn't block all AI functionality.
8. **Testing DB vs dev DB** - `phpunit.xml` uses `DB_DATABASE=propreneur_testing`; routine `php artisan migrate` uses `.env` (`propreneur_central`). Keep both in sync when central migrations change (see Fix #14).
9. **Tenant Feature HTTP tests** - Prefer **`$this->get('http://'.$host.'/path')`** over `call('GET', '/path', …, ['HTTP_HOST' => $host])` so stancl subdomain tenancy and **`IdentifyTenantMiddleware`** see the same host as production-style requests (see Fix #15).
10. **Platform admin routes gated by `feature:`** - Examples that toggle **`FeatureFlag`** rows can leave **`admin_design_system_lab`** (or related keys) off for the rest of the suite; re-seed or reset in **`beforeEach`**, and restore in **`finally`** when a test intentionally disables a flag (see Fix #16).
11. **Tenant `web` + stancl middleware order** - Implicit Eloquent binding for tenant models on subdomain routes can run against the wrong database; resolve IDs inside the controller (see Fix #17).
12. **Duplicate tenant URIs across route files** - `php artisan route:list` can show two actions for one path; last registration wins. Keep one owner per prefix (see Fix #18 follow-up).
13. **Tenant bootstrap and central reads** - After `tenancy()->initialize()`, avoid redundant `CentralTenant::on('central')->findOrFail(...)` when the caller already holds the central tenant model (see Fix #19).
14. **Domain `{tenant_subdomain}` + path `{slug}`** - Do not rely on ordered **`string $slug`** injection for tenant-domain routes; use **`$request->route('slug')`** (see Fix #20).
