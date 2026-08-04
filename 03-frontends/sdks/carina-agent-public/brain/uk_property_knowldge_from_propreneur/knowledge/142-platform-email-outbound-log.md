# Platform Email - SMTP Settings, Welcome Emails, Setup Links, and Outbound Log

**Last updated:** 2026-05-20
**Routes (platform admin):** `/platform/admin/settings` (mail tab), `/platform/admin/outgoing-emails`
**Routes (tenant):** `/settings/mail`

## Overview

Three capabilities added in this phase:
1. Platform-level SMTP configuration via the admin settings UI (replaces `.env`-only setup)
2. Automatic welcome email when a tenant is provisioned by an admin, carrying a password-reset link
3. Platform user "Send setup link" for new staff accounts created via the admin panel
4. Outgoing email audit log in platform admin showing every sent message

---

## Platform SMTP settings (`PlatformMailConfigService`)

Platform-level mail config is stored as `platform_settings` rows in the central DB (group `mail`). Settings are loaded at boot via `AppServiceProvider::boot()` → `PlatformMailConfigService::bootstrap()`, so they override `.env` without a deploy.

### Setting keys (group = `mail`)

| Key | Description |
|-----|-------------|
| `mail_mailer` | Driver: `smtp`, `mailgun`, `postmark`, `ses`, `resend`, or `log` |
| `smtp_host` | SMTP hostname |
| `smtp_port` | Usually 587 (TLS) or 465 (SSL) |
| `smtp_encryption` | `tls`, `ssl`, or blank |
| `smtp_username` | SMTP authentication username |
| `smtp_password` | SMTP password - stored **encrypted** (`is_encrypted = true`) |
| `email_from_address` | Default sender address |
| `email_from_name` | Display name on outbound mail |

`support_email` (general group) is set as the global reply-to address.

### Bootstrap priority

1. If `smtp_host` is set in `platform_settings` → use those values as SMTP, ignore `.env`
2. Else if `mail_mailer` is set to a non-SMTP driver → set that driver
3. Else fall through to `.env` values

### Admin UI

Platform admin → Settings → Mail tab. Password field shows blank when a value is stored; submitting blank skips overwriting the existing password.

---

## Tenant welcome email (`TenantWelcomeEmailService`)

Fired automatically when admin provisions a workspace at `/platform/admin/tenants` (default: on; `send_welcome_email` checkbox can disable it per-provision).

**Flow:**
1. `TenantCreationService::createTenant()` provisions the DB, seeds data, then calls `TenantWelcomeEmailService::send($tenant)`
2. Service initialises tenancy for the new workspace, looks up `User` by `tenant->owner_email`
3. Creates a password reset token via `Password::broker('users')`
4. Sends `TenantProvisionedWelcomeMail` to `owner_email` with login URL + password setup link
5. Tenancy context is always ended in `finally`

**Mailable:** `App\Mail\Central\TenantProvisionedWelcomeMail` - markdown template at `central.mail.tenant-provisioned-welcome`.

**Login URL format:** `{scheme}://{slug}.{TENANT_BASE_DOMAIN}/login`

**Password reset URL format:** `{scheme}://{slug}.{TENANT_BASE_DOMAIN}/reset-password/{token}?email={email}`

If mail is not configured (driver = `log` on VPS), the email is written to the log file. No exception is thrown - failures are logged and return `false`.

---

## Platform user setup link (`PlatformUserAdminService::sendPasswordSetupLink`)

When creating a new platform admin user, the "Send setup link" checkbox triggers `Password::broker('platform_users')->sendResetLink()` after the account is created. This sends the existing `PlatformResetPassword` notification to the new user's email.

The user is created with `accepted_at = null` when `pending_setup = true`, marking the account as pending. Once they set their password via the link, standard Laravel password reset flow completes normally.

**Admin UI:** `/platform/admin/users/create` - checkbox "Send setup link by email".  
**Resend:** Individual user row → "Send setup link" button → calls same service method.

---

## Outgoing email audit log

Every email sent through the platform (regardless of driver) is captured by `LogOutgoingEmailMessage` listener on the `MessageSent` event. Registered in `AppServiceProvider::boot()`.

### `outgoing_email_logs` table (central DB)

| Column | Description |
|--------|-------------|
| `mailer` | Driver used (`smtp`, `log`, etc.) |
| `mailable` | Fully-qualified class name of the Mailable/Notification |
| `subject` | Email subject (max 500 chars) |
| `from_address` | Sender address |
| `to_addresses` | Comma-separated recipients (max 1000 chars) |
| `cc_addresses` | CC addresses if any |
| `tenant_id` | Set when sent within a tenant context |
| `context` | Resolved from mailable class name (see below) |
| `status` | `sent` (always - failed sends don't reach `MessageSent`) |
| `sent_at` | Indexed timestamp |

### Context values

| Context | Mailable pattern |
|---------|-----------------|
| `tenant_welcome` | `TenantProvisionedWelcome*` |
| `tenant_invitation` | `UserInvitation*` |
| `tenant_verification` | `WorkspaceEmailVerification*` |
| `password_reset` | `PlatformResetPassword*` or `ResetPassword*` |
| `waitlist` | `Waitlist*` |
| `system` | everything else |

### Admin UI

`/platform/admin/outgoing-emails` - filterable by recipient/subject (search) and context. Paginated 30 per page. Requires `view-saas-tenants` or `manage-saas-tenants` platform permission.

---

## QR code sharing (promo codes and referrals)

`simplesoftwareio/simple-qrcode` (v4.2) generates inline SVG QR codes.

| Route | Output |
|-------|--------|
| `GET /platform/admin/promo-codes/{promoCode}/qr` | SVG QR for the promo signup URL |
| `GET /platform/admin/referral/{referralCode}/qr` | SVG QR for the referral signup URL |
| `GET /settings/referrals/qr` (tenant) | SVG QR for the tenant's own referral code |

All return `image/svg+xml` with a 1-hour private cache header. Inactive codes return 404.

`QrCodeGenerator::svg(string $content, int $size = 180)` - returns raw SVG string. Used in Blade components `share.code-qr` and `share.table-qr-cell`.

---

## Tenant-level mail settings

Each workspace can configure its own SMTP at `/settings/mail` via `MailConfigService` (separate from the platform service). Tenant SMTP overrides the platform SMTP for emails sent within that tenant context. Settings stored in `tenant_settings` under the `mail` group, password encrypted.

---

## Current production state

Set the following on the VPS `.env` or via platform admin Settings → Mail to enable real delivery:

```
MAIL_MAILER=smtp
MAIL_HOST=smtp.yourmailprovider.com
MAIL_PORT=587
MAIL_ENCRYPTION=tls
MAIL_USERNAME=your@email.com
MAIL_PASSWORD=yourpassword
MAIL_FROM_ADDRESS=noreply@propreneur.uk
MAIL_FROM_NAME="Propreneur"
```

Recommended providers: Postmark, Mailgun, Resend, or AWS SES. Platform settings UI is available immediately - no deploy needed.
