# Platform Admin Panel

**Last updated:** 2026-05-02 (SCOUT security console `admin.security.scout.*`, knowledge `37-security-posture-and-scout.md`; subscription plan catalogue CRUD: `admin.subscription-plans.*`, permissions `view-subscription-plans` / `manage-subscription-plans`, migration `2026_05_03_220000_add_subscription_plan_admin_permissions`)

## Overview

The Platform Admin Panel is the VERLOX super-admin interface for managing the Propreneur SaaS platform. It is accessible only on the central domain (`propreneur.test`, `propreneur.co.uk`) at `/admin`.

**Login URL:** `{APP_URL}/platform/login` (example: `http://propreneur.test:8000/platform/login` when `APP_URL` matches your central host and port).

**Forgot password:** `{APP_URL}/platform/forgot-password` (`central.password.request`). Uses mail configured in `.env` (`MAIL_*`); with `log` driver the message appears in `storage/logs/laravel.log`.

Use the **central** application hostname from `APP_URL`, not `{slug}.{TENANT_BASE_DOMAIN}`. The tenant `/login` page only authenticates workspace `users`, not `platform_users`.

### Regaining platform access

There are **no default super-admin credentials** in repository migrations. If you were logged out, the session ended, or `/admin` keeps sending you to `/platform/login`, check the following.

**Common causes**

1. **Wrong URL** - Open `{APP_URL}/platform/login` on the central host.
2. **`is_active = false`** - `EnsurePlatformAdmin` redirects inactive platform users to login.
3. **`support` role** - Support users pass `canAccessPlatformAdmin()` and may open `/admin`, but only routes allowed by their Spatie permissions (typically `view-saas-tenants`, `view-feature-flags`, `use-admin-search`; not typed settings or Filament). See `brain/knowledge/27-role-access-matrix-and-personas.md`.
4. **Two-factor** - After entering password, complete `/platform/two-factor/challenge` or temporarily disable TOTP in DB if you are locked out (last resort).
5. **Impersonation** - Use **Stop impersonating** (`POST /admin/stop-impersonating`) if you were impersonating another user and the session feels wrong.

**Reset password and enforce super admin (central DB)**

Run on the machine that can reach the central database:

```bash
php artisan tinker
```

```php
use App\Models\Central\PlatformRole;
use App\Models\Central\PlatformUser;

$email = 'your-email@example.com';

$user = PlatformUser::query()->where('email', $email)->first();

if ($user === null) {
    $user = PlatformUser::query()->create([
        'name' => 'Super Admin',
        'email' => $email,
        'password' => bcrypt('choose-a-strong-password'),
        'role' => 'super_admin',
        'is_active' => true,
    ]);
} else {
    $user->password = bcrypt('choose-a-strong-password');
    $user->is_active = true;
    $user->role = 'super_admin';
    $user->save();
}

$user->syncRoles([PlatformRole::findByName('super_admin', 'platform')]);
$user->syncLegacyRoleFromSpatie();
```

Then sign in at **`{APP_URL}/platform/login`** with that email and the new password.

## Architecture

### URL Structure
```
/platform/login                    - Blade platform login (`Central\AuthController`; primary dashboard entry for most platform staff)
/platform/forgot-password          - Request password reset email (`PlatformPasswordResetController`)
/platform/reset-password/{token}   - Set new password (query `email` from mail link)
/platform/two-factor/challenge     - TOTP challenge during login (guest)
/filament/login                    - Filament panel login (same `platform` guard; Carina RAG admin). Panel path `/filament`; see `brain/knowledge/26-filament-carina-rag-admin.md`
/platform/register                 - Workspace signup (feature: tenant_registrations); see `brain/knowledge/21-central-workspace-self-registration.md`
/admin/carina/*                    - Platform user Carina (feature: carina_ai, grant: use-platform-carina); see `brain/knowledge/20-platform-carina-and-public-theme-endpoints.md`
/platform/logout                   - Logout

/admin                             - Dashboard (platform.admin)
/admin/profile                     - Profile (throttled update)
/admin/search                      - Global search (feature: platform_admin_search)
/admin/stop-impersonating          - End impersonation (feature: platform_team_users)
/admin/users/*                     - Platform team CRUD, impersonate (feature: platform_team_users)
/admin/roles/*                     - Platform Spatie roles (feature: platform_team_roles)
/admin/two-factor/*                - Platform user TOTP self-service (feature: platform_user_two_factor)
/admin/saas-tenancy/*              - Tenant CRUD (feature: saas_tenant_management)
/admin/subscription-plans/*       - Subscription plan catalogue CRUD (`SubscriptionPlanController`; same feature; `platform.grant:view-subscription-plans|manage-subscription-plans` on index, `manage-subscription-plans` for create/store/edit/update/destroy). Writes invalidate billing entitlements cache for tenants whose `subscriptions.plan_id` matches the row. Canonical detail: **`65-platform-subscription-plans-admin.md`**.
/admin/settings/*                  - **System settings** (`feature:central_typed_settings`): typed `settings` / definitions catalogue, tenant override picker, **and** embedded `platform_settings` sections (AI, general, billing, **ui** when rows exist). GET `SettingController@index` renders `central.admin.settings.index`. Saving groups: POST `admin.settings.update-group` (`SettingsController@updateGroup`; requires `manage-typed-settings`).
/admin/setting-definitions/*       - Setting schema (`platform.grant` for index vs mutations)
/admin/platform-settings           - **Platform keys** (alternate `platform_settings` UI; `feature:central_platform_ai_keys_ui` + `manage-platform-ai-keys`). GET `SettingsController@index` renders `central.admin.platform-settings.index`. Saving: POST `admin.platform-settings.update-group`. Same underlying rows as the embedded sections on `/admin/settings`.
/admin/platform-settings/ai-providers - Read-only provider key status grid
/admin/ai/*                        - AI BYOK admin (`manage-platform-ai-keys`): providers CRUD, test, default, usage/export (see Routes below)
/admin/security/scout/*            - **SCOUT** security operations console: posture signals, hardening checks, findings register, activity log (`platform.grant:access-scout`; super admins always pass). `POST .../rotate-keys` - **super admin only** + throttle, APP_KEY rotation (`brain/knowledge/37-security-posture-and-scout.md`)
/admin/feature-flags/*             - Feature catalogue and toggles (`view-feature-flags` / `manage-feature-flags` in controller)
/admin/ui/*                        - Design lab: `/admin/ui/theme` (fonts + central theme chrome + **workspace preset table** when `central_theme_presets` is on), `/admin/ui/components`, `/admin/ui/accessibility` (`platform.grant:access-admin-ui-lab` + `feature:admin_design_system_lab`)
/admin/theme/presets/*             - Preset create/edit/duplicate/preview (`platform.grant:manage-central-theme-presets` + `feature:central_theme_presets`). **GET** index redirects to **`/admin/ui/theme#workspace-presets`** when the design lab flag is also on.
```

### Authentication Guards
- **Central domain**: Uses `platform` guard (auth driver `session`, provider `platform_users`)
- **Tenant domains**: Uses `web` guard (auth driver `session`, provider `users` in tenant DB)
- Central login is at `/platform/login` to avoid URL conflict with tenant `/login`

### Middleware
- `platform.admin` - requires `auth:platform` + `isAdmin()` (admin or super_admin)
- `platform.super_admin` - requires `isSuperAdmin()`
- `platform.grant:{a|b|c}` - **OR** any listed platform permission; **always allows `isSuperAdmin()`** without checking Spatie (see `App\Http\Middleware\EnsurePlatformGrant`). Example: `platform.grant:view-typed-settings|manage-typed-settings`.
- `feature:{key}` - central `FeatureFlag::isEnabled($key)`; returns 404 when disabled (see `App\Support\PlatformFeatureCatalogue`)

### Platform permission matrix (Spatie, guard `platform`)

- Catalogue for labels and grouping: `config/platform_permissions.php`.
- Admin UI: **`/admin/roles`** (list + coverage matrix), **`/admin/roles/{role}/edit`** (grouped checkbox matrix). Requires **`manage-platform-roles`** (and feature `platform_team_roles`).
- **`PlatformUser::hasPlatformPermission($name)`** and **`hasAnyPlatformPermission(...$names)`** - super admin is treated as allowed for `hasAnyPlatformPermission`.
- Default role sync after expanding permissions: migration `2026_04_30_220010_expand_platform_permission_matrix.php`.

Examples of permission names: `manage-platform-users`, `manage-platform-roles`, `view-saas-tenants`, `manage-saas-tenants`, `view-subscription-plans`, `manage-subscription-plans`, `view-feature-flags`, `manage-feature-flags`, `use-admin-search`, `view-typed-settings`, `manage-typed-settings`, `manage-setting-definitions`, `manage-platform-ai-keys`, `access-admin-ui-lab`, `manage-central-theme-presets`, `use-platform-carina` (platform Carina routes).

### Layout
- File: `resources/views/layouts/admin.blade.php`
- Dark sidebar (`bg-slate-950`), primary accent from theme tokens (`--color-primary`)
- Separate from tenant app layout (`layouts/app.blade.php`)
- Sidebar entries are **feature-flag** and **`hasAnyPlatformPermission`** gated (see `layouts/admin.blade.php` nav builder). Example: **User Manager** requires `manage-platform-users`; **Platform roles** requires `manage-platform-roles`; **SaaS Tenancy** requires `view-saas-tenants` or `manage-saas-tenants`; **Plans** (subscription catalogue) requires `view-subscription-plans` or `manage-subscription-plans` under the same `saas_tenant_management` flag as Workspaces; **Feature Flags** requires view or manage flags; **Platform configuration** is a sidebar subsection listing **System settings**, **Platform keys**, **AI providers**, etc. (`App\Support\Navigation\PlatformConfigurationLinks`), and when permitted includes **Fonts, theme & presets** (design lab + presets) as a child link rather than a top-level item; **Platform keys** (`/admin/platform-settings`) requires `manage-platform-ai-keys` via its own route group.

### Platform configuration (two UIs, one database store)

`platform_settings` rows are edited from either:

| Surface | URL | Blade | Feature + permission (typical) |
|---------|-----|-------|--------------------------------|
| System settings (unified) | `/admin/settings` | `resources/views/central/admin/settings/index.blade.php` | `central_typed_settings`; view `view-typed-settings` \| `manage-typed-settings`; POST save `manage-typed-settings` |
| Platform keys (legacy tabs) | `/admin/platform-settings` | `resources/views/central/admin/platform-settings/index.blade.php` | `central_platform_ai_keys_ui`; `manage-platform-ai-keys` |

Both use `App\Http\Controllers\Central\Admin\SettingsController::groupedPlatformSettingsForView()` (bootstrap ensures AI/general/billing keys exist). Provider cards: API key, default model, and **DeepSeek reasoner model** align on one row at `md` breakpoint and up in both blades.

Cross-links between **System settings**, **Platform keys**, **AI providers**, **AI usage**, **Setting definitions**, and **Fonts, theme & presets** (when applicable) use `<x-admin.platform-configuration-tabs />`, backed by `App\Support\Navigation\PlatformConfigurationLinks::forGuard()` (`resources/views/components/admin/platform-configuration-tabs.blade.php`).

## Models

### PlatformUser (`app/Models/Central/PlatformUser.php`)
- Connection: `central`
- Table: `platform_users`
- Legacy column `role`: `super_admin`, `admin`, `support` (kept in sync with primary Spatie role via `syncLegacyRoleFromSpatie()`)
- Spatie roles/permissions: guard **`platform`** (`PlatformRole`, `PlatformPermission` models)
- Extra fields: `username`, `avatar`, `last_login_at`, `last_login_ip`
- Methods: `isSuperAdmin()`, `isAdmin()`, `hasPlatformPermission()`, `hasAnyPlatformPermission()`, `getRoleBadgeAttribute()`

### PlatformSetting (`app/Models/Central/PlatformSetting.php`)
- Key-value store for platform configuration
- Groups: `ai`, `general`, `billing`, and **`ui`** (optional rows, e.g. central chrome keys consumed by theme services)
- Static helpers: `PlatformSetting::get($key, $default)`, `PlatformSetting::set($key, $value)`
- Encrypted fields have `is_encrypted = true` and are masked in the UI

### FeatureFlag (`app/Models/Central/FeatureFlag.php`)
- Scopes: `global`, `beta`, `per_tenant`
- `tenant_overrides` JSON: per-tenant enable/disable overrides
- Static helper: `FeatureFlag::isEnabled($key, $tenantId = null)`

## Feature Flags (defaults)

Source of truth for inserts: `App\Support\PlatformFeatureCatalogue` (synced by seeder, migration `2026_04_30_114500_seed_feature_flag_catalogue`, or **Sync catalogue** on `/admin/feature-flags`). Admin UI: `/admin/feature-flags`.

| Key | Label | Default | Scope |
|-----|-------|---------|-------|
| `carina_ai` | Carina AI Assistant | enabled | global |
| `deal_engine` | Deal Engine | enabled | global |
| `pipeline` | Deal Pipeline | enabled | global |
| `crm` | CRM / Contacts | enabled | global |
| `compliance` | Compliance Tracker | enabled | global |
| `accounting` | Accounting | disabled | beta |
| `communications_hub` | Communications Hub | disabled | beta |
| `document_vault` | Document Vault | disabled | beta |
| `hr_payroll` | HR & Payroll | disabled | beta |
| `booking_calendar` | Booking & Calendar | disabled | beta |
| `mentoring_os` | Mentoring OS | disabled | beta |
| `reporting_intelligence` | Reporting & Intelligence | disabled | beta |
| `byok_ai` | Bring Your Own AI Key | enabled | global |
| `multi_property` | Multi-Property Portfolio | enabled | global |
| `tenant_registrations` | New Tenant Registrations | enabled | global |
| `platform_admin_search` | Platform Admin Search | enabled | global |
| `tenant_global_search` | Tenant Global Search | enabled | global |
| `saas_tenant_management` | SaaS Tenancy Admin | enabled | global |
| `admin_design_system_lab` | Design System Lab | enabled | global |
| `central_theme_presets` | Central Theme Presets | enabled | global |
| `tenant_workspace_branding` | Tenant Workspace Branding | enabled | global |
| `trial_expiry_enforcement` | Trial Expiry Enforcement | enabled | global |
| `platform_team_users` | Platform Team Users | enabled | global |
| `platform_team_roles` | Platform Roles Console | enabled | global |
| `platform_user_two_factor` | Platform User 2FA | enabled | global |
| `central_typed_settings` | Central Typed Settings | enabled | global |
| `central_platform_ai_keys_ui` | Platform AI Keys (legacy UI) | enabled | global |
| `stripe_billing_api` | Stripe Billing API | enabled | global |
| `tenant_user_invitations` | Tenant User Invitations | enabled | global |
| `tenant_workspace_admin_api` | Tenant Workspace Admin API | enabled | global |

## Platform Users

Create bootstrap accounts through your secure local or staging process. Do not record live passwords in git-tracked documentation.

### User Manager (platform team)

Shipped under **`feature:platform_team_users`**. Sidebar label **User Manager**; requires **`manage-platform-users`** for list/detail/edit actions inside **`CentralUserController`**.

| Concern | Location |
|---------|-----------|
| HTTP | `App\Http\Controllers\Central\Admin\CentralUserController` |
| Validation | `CreatePlatformUserRequest`, `UpdatePlatformUserRequest`, `AssignRoleRequest` in `App\Http\Requests\UserManagement\` |
| Service | `App\Services\UserManagement\PlatformUserAdminService` (create/update/delete semantics); `RolePermissionService` for Spatie role assignment |
| Views | `resources/views/central/admin/users/*.blade.php` |
| Routes | `GET|POST|PUT|DELETE /admin/users/*`, `POST /admin/users/{user}/impersonate`, `POST /admin/users/{user}/roles`, `PATCH /admin/users/{user}/toggle-active`, `POST /admin/stop-impersonating` - names `admin.users.*`, `admin.stop-impersonating` |

Super-admin-only constraints (for example promoting **`super_admin`**) are enforced in the controller.

**Tenant-side** user CRUD and invitations are **not** on `/admin`; they live under the tenant host **`/api/*`** with **`EnsureWorkspaceAdmin`** - documented in **`brain/knowledge/19-tenant-workspace-onboarding-invitations-and-admin-api.md`**.

## Platform keys UI (`/admin/platform-settings`) and AI sections on System settings

- **Legacy tabbed UI:** `/admin/platform-settings` - permission `manage-platform-ai-keys` (with `feature:central_platform_ai_keys_ui`). Views: `central/admin/platform-settings/index.blade.php`, read-only `ai-providers.blade.php`. POST `admin.platform-settings.update-group`.
- **Unified System settings:** `/admin/settings` embeds the same `platform_settings` groups present in the DB (typically AI, general, billing; **ui** when rows exist). POST `admin.settings.update-group` for `group=ai|general|billing|ui|…` when the user has `manage-typed-settings`.
- **Tabs (legacy page):** `<x-ui.tabs>` for groups `ai`, `general`, `billing`. AI tab: Carina routing, Tavily card, per-provider expanders, BYOK. Reasoner model for DeepSeek is in the main provider row (not hidden under Advanced).
- **Controller:** `SettingsController`: `index` (legacy view only), `updateGroup` (both POST routes), `aiProviders`, `groupedPlatformSettingsForView`, `bootstrap`.

## `platform_settings` groups (key catalogue)

### `ai` group
- `ai_default_provider`, `ai_priority` - Carina routing
- Per provider: `{provider}_api_key` (encrypted), `{provider}_model`, `{provider}_models` (newline list for dropdowns), plus `deepseek_reasoner_model`
- Providers: deepseek, anthropic, groq, openai, openrouter
- **Tavily:** `tavily_api_key` (encrypted), `carina_tavily_enabled`, `carina_tavily_trigger` (allowed values: **`keywords`**, **`every_message`**; synced at boot in `AppServiceProvider`), `tavily_search_depth`, `tavily_max_results` (1-10) - see `brain/knowledge/18-carina-tavily-web-search.md`
- `byok_enabled` - boolean; allow tenant workspaces to use their own keys

### `general` group
- **`platform_name`**, `support_email`, `tenant_trial_days`, **`max_tenants`**, `registration_open`
- Legacy rows **`app_name`** / **`tenant_max_active`** are renamed or deduped toward **`platform_name`** / **`max_tenants`** on bootstrap (`SettingsController::migrateLegacyGeneralSettingKeys()`).

### `billing` group
- Bootstrapped by `SettingsController::ensureBillingSettingsExist()` (Stripe publishable/secret/webhook rows). Renders when present.

## Controllers

| Controller | Namespace | Routes |
|-----------|-----------|--------|
| `AuthController` | `Central` | `/platform/login`, `/platform/logout` |
| `PlatformTwoFactorChallengeController` | `Central` | `/platform/two-factor/challenge` |
| `AdminDashboardController` | `Central\Admin` | `/admin` |
| `AdminSearchController` | `Central\Admin` | `/admin/search` |
| `CrossTenantBenchmarkController` | `Central\Admin` | `GET /admin/analytics/cross-tenant-benchmark` (`admin.analytics.cross-tenant-benchmark`; super admin only; anonymised tenant cohort JSON) |
| `CentralUserController` | `Central\Admin` | `/admin/users/*`, stop impersonating |
| `RoleController` | `Central\Admin` | `/admin/roles/*` |
| `PlatformTwoFactorController` | `Central\Admin` | `/admin/two-factor/*` |
| `TenantManagementController` | `Central\Admin` | `/admin/saas-tenancy/*` |
| `SettingController` | `Central\Admin` | `/admin/settings/*` (typed settings + unified page; composes `SettingsController::groupedPlatformSettingsForView`) |
| `SettingDefinitionController` | `Central\Admin` | `/admin/setting-definitions/*` |
| `SettingsController` | `Central\Admin` | `/admin/settings/group/{group}` (POST), `/admin/platform-settings/*`, `/admin/platform-settings/ai-providers` |
| `PlatformCarinaController` | `Central\Admin` | `/admin/carina/*` |
| `FeatureFlagController` | `Central\Admin` | `/admin/feature-flags/*` |
| `AiProviderController`, `AiUsageController` | `Central\Admin` | `/admin/ai/*` (providers, usage; permission `manage-platform-ai-keys`) |
| `UiController` | `Central\Admin` | `/admin/ui/*` (passes `presets` to `admin.ui.theme` when `central_theme_presets` is enabled) |
| `ThemePresetController` | `Central\Admin` | `/admin/theme/presets/*` (index may redirect; POST actions return to unified theme page with hash when both flags on) |

Runtime theme injection, dark mode, and `CssVariableService` scoping: `brain/knowledge/16-global-search-and-ui-runtime.md`.

Named routes (prefix `admin.`): `admin.ai.providers.index`, `admin.ai.providers.create`, `admin.ai.providers.store`, `admin.ai.providers.edit`, `admin.ai.providers.update`, `admin.ai.providers.destroy`, `admin.ai.providers.test`, `admin.ai.providers.default`, `admin.ai.usage.index`, `admin.ai.usage.export`. UI entry should cross-link from Platform keys / settings areas when BYOK is enabled.
