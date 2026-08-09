# Customer Concierge v1 readiness (honest language)

**Audience:** operators and workspace owners  
**Contract:** `contracts/customer-concierge-v1/`  
**Date:** 2026-08-09

## What "ready" means

A capability is **ready** only when credentials, scopes, and a successful probe exist for that tenant. Stubbed or missing providers report `not_configured`, never `ready`.

| Capability | Ready when | Not ready language |
| --- | --- | --- |
| Public concierge | Published profile + origin allowlist + published knowledge | Setup incomplete |
| Zoom | Tenant Zoom OAuth connected and probe succeeds | Zoom not connected; bookings needing Zoom stay `action_required` |
| Google Calendar | Google tools OAuth connected; invitation send requested | Calendar not connected; invitation delivery is not claimed |
| Microsoft Calendar | Graph credentials configured (Carina currently reports honest `not_configured` until configured) | Microsoft Calendar not configured |
| Email confirmation | Soft Wall / mail path configured | Draft may queue; delivery is not claimed until approved send |

## Booking honesty

- `confirmed` orchestration means join method and calendar projection succeeded for the meeting type (unless the type needs neither).
- `action_required` means the booking exists but operators must fix providers; UI must not imply the guest already has a usable invite.
- `invitation_sent` means the provider was asked to notify the guest. It does **not** promise automatic insertion on every guest calendar.
- Reminder `sent` requires a delivery adapter result. Without one, reminders are `failed` with `no_delivery_adapter`.

## Live provider writes

Do not run live Zoom or calendar writes without owner-approved test accounts. See `CUSTOMER-CONCIERGE-V1-LIVE-PROVIDER-RUNBOOK.md`.
