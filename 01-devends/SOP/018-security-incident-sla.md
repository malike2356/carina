# SOP 018: Security Incident SLA
**Classification:** Internal VERLOX only. Do not share externally.
**Source:** Migrated from planning/security/SECURITY_INCIDENT_SLA.md
**Last reviewed:** 2026-06-25

---

# Security incident review SLA

Organizational target for VERLOX Carina + Scout production. Adjust owners to match your team.

## Severity targets

| Severity | Examples | First human review | Containment decision | Post-incident notes |
|----------|----------|-------------------|----------------------|---------------------|
| `breach` | honeypot trigger, stale marker replay, confirmed credential leak | 15 minutes | 30 minutes | Within 24 hours |
| `critical` | kill switch fired, audit log integrity failure, repeated injection escalation | 30 minutes | 1 hour | Within 24 hours |
| `warning` | risk score spike, single injection block, egress block | 4 hours | Next business day if benign | Within 72 hours |
| `info` | heartbeat gaps, routine shield blocks | 24 hours | Not required | Weekly summary |

## On-call expectations

1. Alert channels must be configured (`SCOUT_ALERT_TO_EMAIL` or Telegram/Slack). See `SOP/016-security-configuration.md` section 2.
2. On-call checks `admin.carinaai.uk/audit-log` or Scout dashboard or `/api/readiness` at least once per business day.
3. Unacknowledged `breach` or `critical` events older than SLA trigger a secondary escalation to a second operator.

## Review checklist (per event)

1. Confirm `instance_id`, `session_id`, and `event_type`.
2. Decide: false positive, contained, or active incident.
3. If active: suspend instance (via ops.carinaai.uk kill switch or Scout), export compliance report, open operator log entry.
4. Acknowledge event in Scout when supported.
5. Record outcome in private operator log.

## Drill cadence

Run the incident drill (`docs.carinaai.uk/docs/user/security/incident-drill.md`) quarterly or after any security/env rotation.
