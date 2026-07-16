# Authentication & Security

**Last updated:** 2026-05-15

## Overview
Separate auth systems for platform admins and tenant workspace users. Tenant auth is subdomain-scoped; platform auth is central-domain.

## Tenant Auth

Standard Laravel auth within each tenant context. Users are per-tenant (not central).

**Routes:** under `guest` and `auth` middleware groups in `routes/tenant.php`.

| Route | Purpose |
|-------|---------|
| `GET /login` | Login form (`tenant.login`) |
| `POST /login` | Authenticate |
| `POST /logout` | Logout (`tenant.logout`) |
| `GET /reset-password/{token}` | Password reset form (`tenant.password.reset`) |
| `POST /reset-password` | Process reset (`tenant.password.update`) |
| `GET /forgot-password` | Email reset link (`central.password.request`) - uses central domain |

**Tenant Two-Factor Auth:**
- `GET /two-factor/challenge` - 2FA challenge form (`tenant.two-factor.challenge`)
- `POST /two-factor/challenge` - Verify TOTP code
- Per-user TOTP via `TwoFactorSetting` model (tenant-scoped)

## Platform Auth

Central admin login at `/platform/login` (`central.login`).

**Routes:**
| Route | Purpose |
|-------|---------|
| `GET /platform/login` | Platform login form |
| `POST /platform/login` | Authenticate |
| `POST /platform/logout` | Logout |
| `GET /platform/register` | Self-service tenant registration |
| `POST /platform/register` | Register new workspace |

**Platform Two-Factor Auth:**
- `GET /platform/two-factor/challenge` - 2FA challenge
- `POST /platform/two-factor/challenge` - Verify TOTP
- Managed via `PlatformTwoFactorSetting` / `PlatformTwoFactorController`

**Impersonation:** Platform admins can impersonate tenant users. `POST /admin/stop-impersonating` returns to platform session.

## Password Reset

Platform-level: uses central `password_reset_tokens` table. Tenant users reset via platform domain (central handles the email routing).

## Security Features

- **CSRF:** Laravel standard, with exceptions for Stripe webhook paths
- **Rate limiting:** `throttle` middleware on auth routes (login attempts, speech-transcribe)
- **Subdomain isolation:** Tenant auth cookies scoped to subdomain
- **Session:** Database-driven sessions per tenant
- **CSP headers:** Applied via middleware (configurable)

## Related
- `10-tenancy.md` - multi-tenancy domain resolution
- `01-architecture.md` - middleware pipeline
