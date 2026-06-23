# Authentication & Security

**Last updated:** 2026-05-01 (local dev restore, platform vs workspace URLs, route table, recovery pointer)

## Two login surfaces

| Who | Hostname | URL | Guard | User table / connection |
|-----|-----------|-----|-------|-------------------------|
| VERLOX platform staff (super admin, admin, support UI where permitted) | Central app host (`APP_URL`, e.g. `propreneur.test`) | **`/platform/login`** | `platform` | `platform_users` on **`central`** |
| Workspace members | Tenant subdomain `{slug}.{TENANT_BASE_DOMAIN}` | **`/login`** | `web` | `users` in **tenant** DB |

Signing in on a workspace subdomain uses **tenant** credentials only. It does **not** authenticate `platform_users`. Platform staff must open the central host and **`/platform/login`**.

Blade UX: `resources/views/central/auth/login.blade.php` explains central vs subdomain; `resources/views/tenant/auth/login.blade.php` links to `{APP_URL}/platform/login` for platform staff.

Recovery and password reset for platform accounts: **`brain/knowledge/15-platform-admin.md`** (section *Regaining platform access*).

---

## Local dev account restore

**When:** After `migrate` on a fresh DB, accidental row deletes, or Spatie `model_has_roles` out of sync for the dev super-admin, you need the standard VERLOX local accounts back without touching `propreneur_testing` test DB via destructive wipes.

**Command (preferred):**

```bash
php artisan app:reseed-dev-accounts
```

- Implemented by **`Database\Seeders\Central\DevAccountSeeder`**. Skips entirely when `APP_ENV=testing`.
- **`app:reseed-dev-accounts`** exits with failure in **`production`** (never run there).

**What gets restored:**

1. **Platform user** `lordsesame@gmail.com` as **`super_admin`**: password reset; Spatie role **`super_admin`** (`platform` guard) synced via `PlatformRole::findOrCreate` + `syncRoles` + `syncLegacyRoleFromSpatie` so `/admin` permission checks work.
2. **Central tenant** slug **`xelox`**, company **Xelox Properties**, plan **`mentor_network`**, owner **Laud Paul** / **xeloxproperties@gmail.com**. On first create, `TenantCreationService` slugifies the company name; the seeder then patches **`slug`** and **`domains.domain`** to **`xelox`**. On subsequent runs, central metadata and domain are refreshed if the tenant already exists.
3. **Tenant `users` row** for **xeloxproperties@gmail.com**: name and password updated; onboarding completion written via **`WorkspaceOnboardingService`** settings when incomplete.

**URLs:** `{APP_URL}/platform/login` for platform; `http://xelox.{TENANT_BASE_DOMAIN}/login` for the workspace (add port in the browser if `php artisan serve` uses one). Password literals live only in **`DevAccountSeeder`** (local dev); do not commit alternate production passwords into that file.

---

## Platform (central) auth

**Controllers:** `App\Http\Controllers\Central\AuthController`, `App\Http\Controllers\Central\PlatformPasswordResetController`  
**Views:** `resources/views/central/auth/login.blade.php`, `forgot-password.blade.php`, `reset-password.blade.php`, two-factor challenge views under `central/`  
**Routes:** `central.login`, `central.login.post`, `central.password.request`, `central.password.email`, `central.password.reset`, `central.password.update`, `central.logout`, `central.two-factor.*`

| Method | URI (under `/platform`) | Name |
|--------|-------------------------|------|
| GET | `/forgot-password` | `central.password.request` |
| POST | `/forgot-password` | `central.password.email` |
| GET | `/reset-password/{token}` | `central.password.reset` |
| POST | `/reset-password` | `central.password.update` |

Reset tokens are stored in **`platform_password_reset_tokens`** on the **`central`** connection (`auth.passwords.platform_users`). Mail links point at `central.password.reset`. Notification: `App\Notifications\PlatformResetPassword`.

Flow:

1. POST email/password to `platform` guard.
2. If `two_factor_settings.enabled_at` is set for that user, session stores `platform_two_factor_user_id` and redirects to `central.two-factor.challenge`.
3. Otherwise `last_login_at` / `last_login_ip` updated, session regenerated, redirect `admin.dashboard`.

**Middleware:** `EnsurePlatformAdmin` requires `auth('platform')->user()->isAdmin()` **and** `is_active`. Otherwise redirect to `central.login` (or 403 JSON). The **`support`** role is not `isAdmin()` and cannot use `/admin`.

---

## Tenant (workspace) auth

**Controller:** `App\Http\Controllers\Tenant\AuthController`  
**Routes file:** `routes/tenant.php` (middleware: `web`, tenancy bootstrap)

### Guest routes

| Method | URI | Name |
|--------|-----|------|
| GET | `/login` | `tenant.login` |
| POST | `/login` | (same) |
| GET | `/forgot-password` | `tenant.password.request` |
| POST | `/forgot-password` | `tenant.password.email` |
| GET | `/reset-password/{token}` | `tenant.password.reset` |
| POST | `/reset-password` | `tenant.password.update` |
| GET | `/two-factor/challenge` | `tenant.two-factor.challenge` |
| POST | `/two-factor/challenge` | `tenant.two-factor.challenge.post` |
| GET | `/invitations/{token}` | `tenant.invitations.accept-form` |
| POST | `/invitations/{token}/accept` | `tenant.invitations.accept` |

### Authenticated routes

| Method | URI | Name |
|--------|-----|------|
| POST | `/logout` | `tenant.logout` |

### Login flow

1. User visits `https://{slug}.{TENANT_BASE_DOMAIN}/login`.
2. `InitializeTenancyBySubdomain` resolves tenant and switches DB context.
3. `AuthController` validates credentials against tenant `users`.
4. On success, redirect `tenant.dashboard` (may continue to onboarding).

### Auth controller (behaviour summary)

- Validates `email`, `password`; optional `remember`.
- Uses default `web` guard (`Tenant\User`).
- Two-factor and tenant-specific logic live in the real `AuthController` implementation (see repo).

### User model

**Model:** `App\Models\Tenant\User`  
**Table:** `users` (tenant connection)

Spatie **roles and permissions** (guard `web`): built-in roles include `tenant_admin`, `team_member`, `mentor`, `mentee`, `viewer` (see `App\Support\UserManagement\WorkspaceRoles`); permissions include `create-users`, `edit-users`, `delete-users`, `view-users`, `manage-roles`. There is no legacy string `role` column for business roles (Spatie holds RBAC). Fields include `invited_by`, `invited_at`, `accepted_at`, `phone`, `avatar`, `is_active`, optional two-factor relation.

### Password reset

Uses Laravel password broker **`users`** (`config/auth.php`) with table `password_reset_tokens` in the **tenant** database for the current tenant context.

### Views

- `resources/views/tenant/auth/login.blade.php` - extends `layouts.auth`
- Forgot/reset views under `resources/views/tenant/auth/`

---

## Security notes

1. **CSRF** on POST forms (`@csrf`).
2. **Password hashing** via Laravel `hashed` cast / `Hash::make`.
3. **Tenant isolation** for workspace users is database-per-tenant.
4. **`is_active`** can block login or admin API access where enforced.

---

## Skeleton `DatabaseSeeder` user

`Database\Seeders\DatabaseSeeder` may create `App\Models\User` on the **default** connection (Laravel skeleton). That record is **not** the platform admin and **not** the tenant app user model used on subdomains. Do not rely on it for `/platform/login` or tenant login unless you deliberately wired it.

---

## Two-factor and invitations

- **Platform:** After password, TOTP challenge when enabled; self-service `/admin/two-factor/*` with feature `platform_user_two_factor`.
- **Tenant:** `tenant.two-factor.challenge`; workspace JSON `/api/two-factor/*` under `tenant_workspace_admin_api`.
- **Invitations:** Guest accept `/invitations/{token}` (`tenant_user_invitations`); admin API `POST /api/invitations` (`tenant_workspace_admin_api`).
