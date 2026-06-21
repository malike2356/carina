# Tenant workspace onboarding, invitations, and admin API

**Updated:** 2026-05-14 (five-step wizard with strategy; workspace admin API, invitation flow)

## Purpose

Documents tenant-side flows that are **not** the core CRUD modules (deals, properties, CRM): first-login **workspace wizard**, **guest invitation accept**, **trial expired** screen, and **JSON admin APIs** for workspace operators. Source of truth for URLs: `routes/tenant.php`.

## Workspace onboarding wizard

- **Service:** `App\Services\Onboarding\WorkspaceOnboardingService` - persists JSON under `tenant_settings.key = workspace_onboarding` (`WorkspaceOnboardingService::SETTINGS_KEY`). Tracks `completed_at`, `onboarding_version` (current JSON is **2**), `max_unlocked_step`, `preferences_skipped`, `setup_deferred`, and step payloads: **workspace** (display name), **strategy** (`primary` slug + optional `target_postcodes_raw`), **profile** (name, phone), **preferences** (timezone). `TOTAL_STEPS = 5` (steps 1-4 collect data; step 5 is review + launch).
- **Strategy slugs:** `btl`, `hmo`, `brr`, `r2r`, `sa`, `flip`, `commercial` - same set as deal sourcing criteria (`WorkspaceOnboardingService::strategySlugLabels()` / `allowedStrategySlugs()`).
- **On completion or "skip setup" exit:** writes `tenant_settings.workspace_primary_strategy` when a primary strategy was chosen; if the user has **no** `sourcing_criteria` rows yet, creates one starter row (`Main focus - {label}`) with optional postcodes parsed from the wizard (line-based, same idea as `StoreSourcingCriterionRequest`).
- **Legacy v1 wizard JSON** (incomplete tenants with no `onboarding_version` or version &lt; 2): first `getState()` migrates in place - injects `strategy`, bumps `onboarding_version` to 2, remaps `max_unlocked_step` (old “review unlocked” `4` becomes `5`; old `3` mid-flow becomes `2` so the user picks strategy before continuing).
- **Controller:** `App\Http\Controllers\Tenant\WorkspaceOnboardingController`
- **Routes (auth, before main app gate):** prefix `/onboarding`, names `tenant.onboarding.*`:
  - `GET /onboarding/{step}` (`show`), `POST /onboarding/{step}` (`save`) with numeric `step` **1-4** (step 5 is review only)
  - `POST /onboarding/preferences/skip` - skip timezone step with defaults (only when the unlocked frontier is step **4**); lands on step **5**
  - `POST /onboarding/launch` - complete wizard
- **Gate:** `App\Http\Middleware\EnsureWorkspaceOnboardingCompleted` wraps the main authenticated block (search, dashboard, modules, Carina). If onboarding is incomplete, users are redirected to `tenant.onboarding.show` for `maxUnlockedStep()`.
- **Bootstrap:** `WorkspaceOnboardingService::ensurePendingOnboardingRecordExists()` runs after central self-registration (see `brain/knowledge/21-central-workspace-self-registration.md`) so new workspaces enter the wizard.

## Trial expired (view-only)

- **Route:** `GET /trial-expired`, name `tenant.trial-expired` - **no auth**; reachable when subscription/trial rules block normal use.
- **Enforcement:** When `trial_expiry_enforcement` is enabled for the tenant, `IdentifyTenantMiddleware` redirects expired trials without an active subscription here (see `brain/knowledge/16-global-search-and-ui-runtime.md`).

## User invitations (guest)

- **Feature flag:** `tenant_user_invitations`
- **Routes:** `GET /invitations/{token}`, `POST /invitations/{token}/accept` - middleware `guest` + `feature:tenant_user_invitations`. Controller: `App\Http\Controllers\Tenant\InvitationAcceptController`.

## Workspace admin JSON API

- **Feature flag:** `tenant_workspace_admin_api`
- **Middleware:** `tenant.workspace_admin` (`App\Http\Middleware\EnsureWorkspaceAdmin`) requires the authenticated tenant user to have Spatie role **`tenant_admin`** on the `web` guard; otherwise HTTP 403. Users created only via **`RegisterController`** may not have that role until bootstrap seeding or an admin assigns it (see `brain/knowledge/21-central-workspace-self-registration.md`).
- **Prefix:** `/api` (same host as tenant subdomain), **inside** `auth` + `IdentifyTenantMiddleware` + `EnsureWorkspaceOnboardingCompleted` + feature gate.

| Method | Path | Name (selected) | Purpose |
|--------|------|-------------------|---------|
| GET/POST | `/api/users`, `/api/users/{user}` | `tenant.api.users.*` | Tenant user CRUD |
| POST | `/api/invitations` | `tenant.api.invitations.store` | Create invitation |
| POST | `/api/two-factor/*` | `tenant.api.two-factor.*` | Tenant TOTP setup (enable, verify, disable, recovery codes) |
| GET/POST/PUT/DELETE | `/api/roles`, `/api/roles/{role}`, assign/revoke | `tenant.api.roles.*` | Spatie roles on tenant guard |

Tenant appearance JSON (`/api/theme/*`) lives under **`tenant_workspace_branding`**, not `tenant_workspace_admin_api` - see `routes/tenant.php`.

## Tests

- `tests/Feature/WorkspaceOnboardingTest.php` - wizard flow and redirects.

## Related

- `brain/knowledge/16-global-search-and-ui-runtime.md` - `IdentifyTenantMiddleware`, feature flags table.
- `brain/knowledge/09-auth.md` - platform vs tenant 2FA and invitations summary.
- `brain/knowledge/21-central-workspace-self-registration.md` - creates tenant + first user + onboarding record.
