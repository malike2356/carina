# Security incident review SLA

Organizational target for VERLOX Carina + Scout production. Adjust owners to match your team.

## Severity targets

| Severity | Examples | First human review | Containment decision | Post-incident notes |
|----------|----------|-------------------|----------------------|---------------------|
| `breach` | honeypot trigger, stale marker replay, confirmed credential leak | 15 minutes | 30 minutes | Within 24 hours |
| `critical` | kill switch fired, trust attestation failure, repeated injection escalation | 30 minutes | 1 hour | Within 24 hours |
| `warning` | risk score spike, single injection block, egress block | 4 hours | Next business day if benign | Within 72 hours |
| `info` | heartbeat gaps, routine shield blocks | 24 hours | Not required | Weekly summary |

## On-call expectations

1. Alert channels must be configured (`SCOUT_ALERT_TO_EMAIL` or Telegram/Slack).
2. On-call checks Scout dashboard or `/api/readiness` at least once per business day.
3. Unacknowledged `breach` or `critical` events older than SLA trigger a secondary escalation to a second operator.

## Review checklist (per event)

1. Confirm `instance_id`, `session_id`, and `event_type`.
2. Decide: false positive, contained, or active incident.
3. If active: suspend instance, export compliance report, open operator log entry.
4. Acknowledge event in Scout when supported.
5. Record outcome in `instructions/operator-trust-log.md` (private copy).

## Drill cadence

Run `docs.carinaai.uk/docs/user/security/incident-drill.md` quarterly or after any trust/env rotation.
