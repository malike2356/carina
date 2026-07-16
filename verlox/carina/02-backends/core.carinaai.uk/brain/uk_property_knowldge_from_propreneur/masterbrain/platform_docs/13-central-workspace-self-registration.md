# Central workspace self-registration

**Updated:** 2026-04-30

## Purpose

Public **signup** for a new tenant workspace on the **central** host. Creates the central `Tenant` and `Domain`, provisions the tenant database context, creates the **first tenant admin user**, seeds onboarding state, and redirects the owner to the tenant subdomain login.

## Routes and access

- **URLs:** `GET /platform/register`, `POST /platform/register` - names `central.register`, `central.register.post`
- **Middleware:** `guest:platform` + `feature:tenant_registrations`
- **Controller:** `App\Http\Controllers\Central\RegisterController`

## Flow (summary)

1. **GET** shows `resources/views/central/auth/register.blade.php` with optional **central theme presets** (`ThemePreset` list) and `config('tenancy.tenant_base_domain')` for the subdomain hint.
2. **POST** validates: `company_name`, `owner_name`, `owner_email`, `slug` (unique on `central.tenants`), `password` / `password_confirmation`, optional `theme_preset_id` (must exist on `theme_presets`).
3. **Central row:** `Tenant::create([...])` with UUID `id`, `trial_ends_at` (+14 days in current implementation), `is_active` true, `plan` starter.
4. **Domain:** `$tenant->domains()->create(['domain' => $slug])` - subdomain segment stored per stancl conventions (see `brain/knowledge/10-tenancy.md`).
5. **Branding:** If `theme_preset_id` present, `TenantThemeServiceInterface::selectPresetForTenant()` attaches central preset to tenant.
6. **Tenant DB:** `tenancy()->initialize($tenant)` then `User::create(...)` for the owner (password hashed). The controller does **not** assign Spatie roles here.
7. **Onboarding:** `WorkspaceOnboardingService::ensurePendingOnboardingRecordExists()` writes pending wizard state (see `brain/knowledge/19-tenant-workspace-onboarding-invitations-and-admin-api.md`).
8. **Redirect:** `redirect()->away("http://{slug}.{tenant_base_domain}/login")` with flash status (adjust scheme/host for production TLS and configured base domain).

## Bootstrap seeder vs self-registration

- **`TenantCreated` pipeline** (`App\Providers\TenancyServiceProvider`) runs `CreateDatabase` and `MigrateDatabase`. **`Jobs\SeedDatabase` is commented out**, so `TenantBootstrapSeeder` does **not** run automatically for every new tenant.
- **`TenantCreationService::createTenant()`** (admin or scripted flows) calls `seedData()`, which runs **`TenantBootstrapSeeder`** inside tenant context: creates/updates the user matching `owner_email`, syncs **`tenant_admin`**, default pipeline, compliance template, and onboarding row.
- **Implication:** Self-registered owners can log in but may **lack `tenant_admin`** until roles are assigned (workspace admin JSON API under `tenant.workspace_admin` returns 403 without that role). Align product behaviour in application code when you tighten this path.

## Multi-tenancy package

Database creation and tenant migrations are driven by **stancl/tenancy** when the tenant record is created (`HasDatabase` on `App\Models\Central\Tenant`). See `config/tenancy.php` and `TenancyServiceProvider::events()`.

## Related

- `brain/knowledge/10-tenancy.md` - domain resolution, central vs tenant DB.
- `brain/knowledge/15-platform-admin.md` - URL map line for `/platform/register`.
- `brain/knowledge/19-tenant-workspace-onboarding-invitations-and-admin-api.md` - post-login wizard.
