# Security posture and SCOUT (Security Control Operations Unified Terminal)

**Purpose:** Document platform security controls, hardening decisions, and the central admin SCOUT console for findings and activity logging.

## Current posture (summary)

- **Multi-tenancy:** Tenant data lives in isolated databases; stancl tenancy bootstrappers switch context per request. Cross-tenant access must never query another tenant without explicit central resolution and authorization.
- **Authentication:** Separate guards (`platform` for central operators, `web` for workspace users). Session-backed login with regeneration on success. Platform login at `/platform/login`.
- **Authorization:** Central admin uses `EnsurePlatformAdmin`, `EnsurePlatformGrant`, and `EnsureSuperAdmin` for sensitive routes. Spatie permissions on the `platform` guard.
- **Webhooks:** Stripe billing webhooks verify signatures before dispatching jobs; routes are feature-gated and throttled (`config/billing.stripe_webhook_throttle`).
- **Rate limiting:** Platform login (`10,1`), tenant login (`10,1`), tenant forgot-password (`5,1`), tenant password reset (`10,1`), tenant two-factor challenge POST (`10,1`), public `/health` (`120,1`).
- **Information disclosure:** Workspace-not-found HTML and `/health` JSON omit internal database names and connection details unless `APP_DEBUG` is true. Operators may set `TENANT_NOT_FOUND_SHOW_DIAGNOSTICS=true` for non-production troubleshooting without enabling full debug.
- **AI and secrets:** API keys belong in environment and encrypted platform settings; controllers must not call providers directly (see **`08-carina.md`**, including SCOUT snapshot behaviour on platform Carina from this console).

SCOUT does not replace legal DPIA, SOC2 audits, penetration tests, or incident retainers. It is an internal control surface for tracking findings and operator notes.

## SCOUT

- **Acronym:** Security Control Operations Unified Terminal (SCOUT).
- **URL:** `/admin/security/scout` (`admin.scout.*` routes).
- **Access:** `platform.grant:access-scout`. Super admins pass this middleware without an explicit permission row. The migration `2026_05_02_900000_create_security_scout_tables_and_permission.php` creates the `access-scout` permission and attaches it to the `super_admin` platform role so role sync stays explicit. Grant the permission to other platform roles only when policy allows.
- **Navigation:** Platform admin sidebar under **Operations** (eye icon), visible when the user is super admin or has `access-scout`.
- **Data (central DB):**
  - `security_findings`: severity, title, description, status (`open`, `in_progress`, `resolved`, `accepted_risk`), remediation, optional CWE-style `reference`, optional `source` (e.g. `composer_audit`), `resolved_at`.
  - `security_activity_logs`: category (`audit`, `remediation`, `review`, `incident`, `note`), title, body, optional `actor_platform_user_id`, `metadata` JSON, `created_at`.
- **UI:** Live posture signals, **hardening checks** (debug, storage permissions, advisory items the app can infer), baseline control catalogue, findings register (with `source` badge when set), activity timeline, operator note form.
- **Rotate application key:** `POST /admin/security/scout/rotate-keys` (`admin.scout.keys.rotate`), **super admin only**, throttled `3,60`. Runs `App\Services\Security\KeyRotationService`: `key:generate --force`, deletes `personal_access_tokens` on default and `central` connections when the table exists, truncates **database** sessions when `SESSION_DRIVER=database`, clears `platform_password_reset_tokens`, `Cache::flush()`, `config:clear`. **Does not** purge Sanctum tokens inside each tenant database. Destructive: confirm in browser before submit.
- **Dependency audit:** `php artisan scout:patch-scan` runs `composer audit --format=json` (Composer 2.4+; binary from `config/scout.php` / `SCOUT_COMPOSER_BIN`) and upserts findings with `source=composer_audit` and stable `reference` keys (`composer-audit:{advisoryId}` or hash). Scheduled daily at **03:00** in `routes/console.php`. Writes an `security_activity_logs` row with category `audit`.
- **Static analysis (SAST):** `php artisan scout:sast-scan` runs PHPStan via Larastan (`phpstan.neon`, optional `SCOUT_PHPSTAN_BIN` / `SCOUT_PHPSTAN_CONFIG` / `SCOUT_PHPSTAN_TIMEOUT` in `config/scout.php`). Findings use `source=larastan` and compact `reference` keys (`lr:` + hash, max 64 chars). Open Larastan findings not present in the latest clean scan are marked resolved. Scheduled daily at **04:00**. SCOUT UI button **Run PHPStan (SAST) now** requires `scout-audit` (same as Composer audit).
- **Directory listing and probes:** `SecurityPostureSnapshot` reads `public/.htaccess` for `Options` with `-Indexes` when present, and flags Nginx separately. `BlockSensitivePublicPathProbes` middleware (web stack) returns 404 for common `/.env` and SCM path segments when requests reach Laravel (not a substitute for correct document roots).

## Implementation references

- Controllers: `App\Http\Controllers\Central\Admin\ScoutDashboardController`
- Models: `App\Models\Central\SecurityFinding`, `App\Models\Central\SecurityActivityLog`
- Posture snapshot: `App\Services\Security\SecurityPostureSnapshot`
- Key rotation: `App\Services\Security\KeyRotationService`, `App\Http\Requests\Central\Admin\RotateApplicationKeysRequest`
- Patch scan: `App\Services\Security\PatchScanService`, `App\Console\Commands\ScoutPatchScanCommand`, `config/scout.php`
- SAST scan: `App\Services\Security\SastScanService`, `App\Console\Commands\ScoutSastScanCommand`, `phpstan.neon`, `phpstan-baseline.neon`
- Path probes: `App\Http\Middleware\BlockSensitivePublicPathProbes`, registered on the `web` middleware group in `bootstrap/app.php`
- Migration (source column): `database/migrations/2026_05_02_910000_add_source_to_security_findings_table.php`
- Tenant not found rendering: `resources/views/errors/tenant-workspace-not-found.blade.php` (diagnostics gated)
- Exception wiring: `bootstrap/app.php` (`TenantCouldNotBeIdentifiedOnDomainException`, `NotASubdomainException`)
- Tests: `tests/Feature/Central/ScoutDashboardTest.php`, `tests/Feature/Central/ScoutKeyRotationTest.php`, `tests/Feature/Central/ScoutPatchScanCommandTest.php`, `tests/Feature/Central/ScoutSastScanCommandTest.php`, `tests/Feature/Central/ScoutSastSyncServiceTest.php`, `tests/Feature/Security/BlockSensitivePublicPathProbesTest.php`, `tests/Feature/Security/TenantWorkspaceNotFoundDisclosureTest.php`, `tests/Feature/Security/HealthEndpointDisclosureTest.php`, `tests/Unit/Security/PatchScanServiceTest.php`

## Ongoing responsibilities

1. Keep SCOUT findings updated when new issues are discovered or remediated.
2. Prefer defense in depth: validate input, enforce workspace-scoped queries, use policies on models, and log destructive central actions (pattern used elsewhere in admin).
3. Review `APP_DEBUG`, `SESSION_SECURE_COOKIE`, TLS termination, and backup encryption as part of release checklists (see `36-backup-disaster-recovery.md`).
