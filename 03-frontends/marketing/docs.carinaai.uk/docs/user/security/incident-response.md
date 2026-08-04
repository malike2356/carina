# Incident response runbook

Use this when a Carina deployment or Scout blocks a prompt, reports a suspected compromise, or fires the kill switch.

## 1. Blocked prompt (injection shield)

1. Open the Scout console and find the latest `injection_blocked` or `prompt_injection_blocked` event.
2. Note `instance_id`, `session_id`, and the matched pattern in event metadata.
3. Do not replay the blocked content into production chat until you understand the source.
4. If the same session triggers 3 or more blocks in 15 minutes, Scout emits `repeated_injection_blocks` and alerts configured channels.
5. Resume normal use only after confirming the session input came from an expected user or channel.

## 2. Suspected compromise (honeypot or stale marker)

1. Treat `honeypot_triggered` and `stale_marker_detected` as breach-severity until ruled out.
2. Run `carina scout status` on the Carina host and confirm the Scout connection is healthy.
3. Check whether any tool attempted to read decoy credentials or replay a retired moving-target marker.
4. Review recent tool calls for `shell-exec`, `file-write`, `http-request`, and `email-send`.
5. If uncertain, activate containment before deeper investigation.

## 3. Kill switch fired

1. Confirm the instance shows `suspended` in Scout (`/api/instances` or dashboard).
2. Stop sending new user traffic to the affected instance.
3. Export the incident timeline (`/api/compliance` or dashboard export) for your records.
4. Investigate root cause: injection chain, egress violation, anomaly score, or operator action.
5. Resume only with `POST /api/resume` after remediation and explicit operator approval.

## 4. Trust or attestation failures

1. Check Scout logs for `trust_attestation_failed` or `trust_verification_failed` events.
2. Run `pnpm doctor` in `console.labyrinthscout.com` and confirm `TRUST_ATTESTER_PRIVATE_KEY` is set and funded.
3. Follow [Trust wallet rotation](./trust-wallet-rotation.md) if the wallet changed recently.
4. Re-run `pnpm trust:register` and `pnpm trust:verify` only after wallet and env are stable.

## 5. Escalation checklist

| Signal | First action |
|--------|----------------|
| Single injection block | Review session; keep monitoring |
| Repeated injection blocks | Restrict session; notify operator |
| Honeypot trigger | Suspend instance; forensic review |
| Kill switch | Halt traffic; export timeline |
| Risk score spike (+15) | Review last 30 minutes of events |

## Related docs

- [Defence in depth](./defence-in-depth.md)
- [Labyrinth Scout](./labyrinth-scout.md)
- [Trust wallet rotation](./trust-wallet-rotation.md)
- [Incident drill](./incident-drill.md)
