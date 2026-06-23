# Workspace localization, staff HR, investor portal web, waitlist

**Last updated:** 2026-05-15

## Localization (prompt 29)

- **Admin UI:** `/settings/localization` (tenant workspace admin, feature flag `workspace_localization`).
- **Defaults:** `TenantSetting` keys `localization.workspace_default_locale` and `localization.enabled_locales` via `App\Services\Localization\LocalizationService`.
- **String overrides:** `/admin/translations` (existing `TranslationController`).
- **API:** `POST/GET /api/locale/*` for session locale.
- **Middleware:** `SetLocaleMiddleware`, `LocalizationMiddleware` on web group.

## Waitlist & marketing (prompt 31)

- **Public HTML:** `GET /waitlist` signup form, `POST /waitlist/signup`, `GET /waitlist/thanks`, confirm/status/referral routes unchanged.
- **Admin:** `/admin/waitlist` (central super admin).
- **Config:** `config/waitlist.php`, campaigns via `EmailSequenceService`.

## Staff / HR & payroll (prompt 37)

- **Module key:** `hr_payroll` (`BillingModule::HrPayroll`), in `config/billing.php` module sets.
- **Tenant UI:** `/staff` directory, `/staff/leave`, `/staff/payroll` (admin), profile edit per user.
- **Tables:** `staff_profiles`, `staff_leave_requests`, `staff_payroll_runs`.

## Investor portal (prompt 38)

- **JSON API:** `/api/investor-portal` (Sanctum) - register, login, me.
- **Web UI:** `/investor-portal/login`, `/register`, `/` dashboard (session guard `investor_portal`).
- **CRM hub (staff):** `/investors/*` unchanged.

## viCal phases 2-7 (incremental)

- Public multi-step book funnel at `/book/{slug}` (4 steps).
- Guest cancel/reschedule token flows; host booking detail includes status timeline.
- Reminders: `php artisan vcal:send-booking-reminders` + `VcalBookingReminderService`.
- Public REST: `/api/vcal/public/{slug}/*` and API-key `/api/vcal/rest/{slug}/*`.
- Embed: `/book/embed/{slug}`.
