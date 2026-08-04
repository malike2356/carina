# Remote Access and Platform Support

**Last updated:** 2026-05-02

## Overview

Consent-based remote support lets platform staff open a workspace session after the tenant enables **Remote Support Access**, with optional **emergency override** for users who hold the `remote-access-override` permission (super admins by default). Every session is written to `remote_access_logs` on the **central** database (`platform_user_id`, `tenant_id`, timestamps, reason, consent method, IP, user agent). Archived rows move to `remote_access_logs_archive` when past the configured retention window (default seven years in days).

## Tenant experience

- **Settings:** Workspace admins use **Settings > Remote Access** (`tenant.settings.remote-access.*`) to toggle `tenants.allow_remote_access` with confirmation modals.
- **Entry link:** After a platform operator starts a session from **Platform > Support > Remote Access**, they receive a flash link that opens `GET /remote-access/session?token=...` on the tenant host. The token is short-lived encrypted payload bound to the log row.
- **Banner:** Other signed-in workspace members see an amber banner while an active remote session exists (unless they are the operator in that session). Override sessions show stronger copy.

## Platform operator experience

- **Permissions:** `manage-remote-access` gates the UI and actions. `remote-access-override` allows access when the tenant toggle is off (longer reason, logged as `super_override`, email plus optional SMS to a tenant admin with a stored phone number when Twilio is configured).
- **GDPR acknowledgement:** Central session stores `remote_access_gdpr_confirmed_at`; operators must reconfirm after the configured interval (default four hours). POST `admin.remote-access.gdpr-confirm`.
- **Audit:** `admin.remote-access.logs` lists filters, CSV/JSON export, manual termination with reason. Super admins can download a PDF summary and open **Support audit archive** for live plus archived rows.
- **Configuration:** Super admins edit typed values stored in `platform_settings` (`remote_access.*` keys) at **`/admin/remote-access/settings`** (route names `admin.remote-access.settings.*`) so it does not clash with typed settings at `/admin/settings/{key}`.

## Automation

- Artisan `remote-access:cleanup-expired` (scheduled every fifteen minutes) ends sessions past max duration, inactive sessions, and stale entry tokens; it also archives logs older than retention.
- `App\Listeners\RemoteAccessSessionExpiry` listens to `Illuminate\Auth\Events\Logout` on the `web` guard to close remote log metadata when the support operator signs out of the workspace.

## Configuration file

Defaults and env fallbacks live in `config/remote_access.php`. Database overrides in `platform_settings` take precedence when present (via `App\Support\RemoteAccess\RemoteAccessOptions`).

## Tests

`tests/Feature/RemoteAccessTest.php` and `tests/Unit/RemoteAccessServiceTest.php` cover GDPR gating, toggle-on flow, admin-only override denial, super override, tenant settings update, cleanup, and service token creation.
