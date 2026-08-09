# Customer Concierge v1 operations

**Date:** 2026-08-09  
**Related:** `VICAL-OPS.md`, `CUSTOMER-CONCIERGE-V1-READINESS.md`, `AIVA-LEAD-FUNNEL-RUNBOOK.md`

## Dashboards and signals

| Signal | Source | Operator action |
| --- | --- | --- |
| Concierge analytics | `GET /api/aiva/workers/:id/concierge/analytics` | Review containment, escalations, booking conversion from durable events |
| Action required bookings | viCal ledger `orchestrationStatus=action_required` | Fix Zoom/calendar credentials; retry from Bookings |
| Support case SLA | Concierge support cases list | Takeover / first response |
| Outreach pause | Lead timeline `support_case` / `booking` stop reasons | Resume only intentionally |

## Retry and dead-letter

- Provider writes use saga idempotency keys. Duplicate webhooks must not create duplicate meetings.
- Failed Zoom/calendar steps leave `action_required` plus provider operations with `retryable` or `action_required`.
- Reminder rows without a delivery adapter become `failed` (`no_delivery_adapter`); they are not marked `sent`.
- Outreach Soft Wall remains the gate for outbound email; queued is not delivered.

## SLOs (v1 targets)

| SLO | Target |
| --- | --- |
| Public widget book path availability | 99% monthly excluding provider outages |
| Time to first operator response on handed-off cases | Median under 4 business hours where SLA configured |
| Invitation honesty | Zero bookings claiming invite success when delivery state is `failed` or unknown |
| Marketing homepage after Contabo deploy | `https://carinaai.uk/` HTTP 200 |

## Backups and restore proof

- viCal file/Postgres stores follow core backup scripts under `docker/scripts/backup-*.sh`.
- After restore drills, verify: list bookings, one action_required row (if any), concierge analytics event count, and marketing 200.

## Incident runbooks

1. **Zoom outage / revoked token:** Bookings needing Zoom go `action_required`; operator reconnects OAuth; retry create/update.
2. **Calendar invitation failure:** Surface `delivery_failed`; send ICS fallback; do not claim guest calendar insertion.
3. **Webhook forgery:** Reject bad signatures/tokens; audit security log; rotate secrets.
4. **False confirmed booking:** Treat as Sev-2; set orchestration to `action_required`; notify guests; fix tool path (must use saga).

## Deploy and rollback

1. Local: `pnpm exec vitest run src/customer-concierge/ src/vical/saga/booking-saga.test.ts src/vical/calendar/calendar-invitations.test.ts`
2. Hygiene: `bash scripts/guard-public-github-hygiene.sh` from workspace root when unsure.
3. Git: focused commit + push in `carina/`.
4. Contabo: scoped `carina-web` rebuild + `app.carinaai.uk/deploy.sh`; never leave `carinaai.uk` on 403.
5. Rollback: previous release tag via `deploy-atomic.sh --rollback` for the affected service.
