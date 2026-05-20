# Attack visualization on the MIS

This document refocuses security work on **in-app attack visibility** (not VPS log tailing or deploy runbooks).

## What you get today

| Surface | URL (platform admin) | Purpose |
|---------|----------------------|---------|
| **Security overview** | `/admin/platform/security` | 30-day event chart, severity breakdown, top tenants, unresolved critical table |
| **Security events** | `/admin/platform/security/events` | Filterable list; resolve with notes |
| **SCOUT** | `/admin/security/scout` | CVE/SAST/posture (separate from live attack events) |

**Access:** `scout-view` or `access-scout` permission (same as SCOUT). Super admins with `platform_scout` feature flag.

**Alerts:** `NotifySecurityAnomalyJob` on queue `security` emails super admins and links to the events list.

## Data sources (application layer)

Events land in central `security_events` via `SecurityEventService` / `AnomalyDetectionService`:

- Failed logins → brute force / credential stuffing (wired on tenant + platform login failure)
- Carina prompt injection / tool abuse (guards)
- Mass delete, bulk export, new-country login (service methods — wire at call sites as needed)
- Signup honeypot / IP rate limit (`signup_honeypot`, `signup_ip_rate_limit`)

## What is *not* this dashboard

- **Nginx / aaPanel access logs** — perimeter traffic; use GoAccess or Cloudflare analytics if needed.
- **`laravel-*.log` on VPS** — raw PHP/Laravel errors; not structured attack events.
- **SCOUT** — supply-chain and static analysis, not live intrusion timeline.

## Deploy checklist (after code change)

From **tsalach** (not aman):

```bash
cd propreneur-v2
./scripts/deploy-to-production.sh
```

On **aman**, confirm Horizon processes `security` queue (`config/horizon.php` supervisor includes `security`).

## Configuration

```env
# Dedicated inbox for anomaly emails (super admins still get in-app alerts)
SECURITY_ALERT_EMAIL=security@yourdomain.com
```

When `SECURITY_ALERT_EMAIL` is set, email goes to that address only; super admins receive **database** notifications in the platform UI. When unset, each super admin gets email + in-app as before.

## Optional next steps

1. ~~Log signup honeypot hits to `security_events` (HIGH).~~ **Done**
2. ~~`SECURITY_ALERT_EMAIL` in `.env` for dedicated ops inbox.~~ **Done**
3. Slack webhook on CRITICAL only.
4. Tenant-scoped security read-only view for workspace admins.

See also: `brain/masterbrain/verification_and_ops/05-security-posture-and-scout.md`.
