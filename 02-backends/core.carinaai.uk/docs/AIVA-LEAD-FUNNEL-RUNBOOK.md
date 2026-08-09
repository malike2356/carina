# Aiva lead funnel runbook

Operator guide for scheduler, mailbox, provider events, reconciliation, and controlled smoke validation.

## Safety

- Soft Wall approval is required for cold outreach.
- When `CARINA_OUTREACH_TEST_MODE=true` (or workspace in `CARINA_OUTREACH_TEST_MODE_WORKSPACES`), sends are blocked unless the recipient is on `CARINA_OUTREACH_SMOKE_ALLOWLIST` / `CARINA_OUTREACH_RECIPIENT_ALLOWLIST`.
- Never run automated validation against scraped prospect addresses.
- Outreach UI shows a visible TEST MODE banner when test mode is active.

## Health endpoints

| Check | URL / API |
| --- | --- |
| Marketing | `https://carinaai.uk/` |
| App | `https://app.carinaai.uk/` and `https://app.carinaai.uk/api/health` |
| Core | `https://core.carinaai.uk/health` |
| Scheduler | `GET /api/aiva/outreach/scheduler/health` |
| Observability snapshot | `GET /api/aiva/outreach/observability` |
| Reconcile gaps | `GET /api/aiva/outreach/reconcile/gaps` |
| Test mode | `GET /api/aiva/outreach/test-mode` |

## Alert thresholds

| Signal | Warn | Error | Action |
| --- | --- | --- | --- |
| Scheduler heartbeat age | > 5m | > 15m | Check `carina-core`, durable scheduler env, Postgres |
| Oldest due job age | > 30m | > 1h | Inspect dead letters; `POST /scheduler/tick` |
| Dead-letter count | > 0 | > 10 | Replay or fix payload; pause if flooding |
| Webhook signature failures | > 0 / process | rising | Rotate secrets; check Resend/Mailgun signing |
| Open reconcile gaps | > 0 | > 50 | `POST /reconcile/tick`; inspect missing provider IDs |
| Ambiguous replies | > 0 | sustained growth | Review Replies queue; improve match tokens |
| DB ping | > 200ms | query errors | Check Postgres / pgbouncer |

## Controlled smoke (16 steps)

Simulated (CI / local, no live mailbox):

```bash
cd 02-backends/core.carinaai.uk
pnpm exec vitest run src/outreach/provider-smoke.test.ts
# or
node --import tsx -e "import('./src/outreach/provider-smoke.ts').then(m=>m.runSimulatedProviderSmoke().then(console.log))"
```

Live mode (owner only): set allowlist, `CARINA_OUTREACH_TEST_MODE=true`, `CARINA_OUTREACH_ALLOW_LIVE_SMOKE=true`, then Soft Wall approve an allowlisted recipient. Do not call live smoke against production scraped lists.

## Migration backup / dry-run / rollback

1. Dry-run: `bash scripts/migrate-outreach-json-to-postgres.sh --dry-run`
2. Backup checksum: script writes a JSON backup under the outreach store / report path.
3. Apply migrations `036`-`039` (and later) on Contabo Postgres.
4. Flip `CARINA_OUTREACH_PERSISTENCE=postgres` after count verification.
5. Rollback rehearsal: restore JSON backup and set persistence back to `json` only on non-production first.

## Structured logs

- Log workspace id, delivery id, provider, event kind, match method.
- Do not log API keys, webhook secrets, or full email bodies in production logs.
- Signature failures increment process counters without writing payload bodies.

## Rollback deploy

1. Redeploy previous known-good `carina-web` / `carina-cloud` image digests from release receipts under `core.carinaai.uk/.deploy/receipts/`.
2. Confirm `https://carinaai.uk/` returns 200 after any Contabo nginx/compose change.
3. Re-run `bash scripts/smoke-lead-funnel-baseline.sh` and `bash scripts/smoke-lead-funnel-provider.sh`.
