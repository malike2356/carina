# Aiva Propreneur bridge (Phase 1 closeout)

**Last updated:** 2026-06-24  
**Status:** Phase 1 complete. Phase 2 writes (review queue) and Carina IMAP poller (A14) shipped 2026-06-24.

## Architecture (pilot)

```
Propreneur IMAP (/settings/email-ingestion)
        |
        v
email_processing_logs  -->  EmailProcessingPipeline (existing)
        |
        +-- GET /api/aiva-bridge/*  (read-only, Bearer Carina remote key)
                |
                v
Carina Aiva worker  -->  Telegram summary + portfolio Q&A
```

**Risk rule:** One IMAP owner per mailbox. If Propreneur polls the inbox, Carina must not connect IMAP for that mailbox (409 on connect when worker is Propreneur-bound).

## Propreneur bridge API

All routes require `feature:aiva_external_bridge` and `Authorization: Bearer {carina_remote_api_key}`.

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/aiva-bridge/portfolio` | Property list + totals |
| GET | `/api/aiva-bridge/properties/{id}` | Single property |
| GET | `/api/aiva-bridge/properties/{id}/compliance` | Compliance items |
| GET | `/api/aiva-bridge/deals` | Pipeline deals (`?status=open`) |
| GET | `/api/aiva-bridge/email-activity` | Recent processing logs (`?hours=24`) |

Implementation: `AivaBridgeController`, `AivaBridgeReadService`. Tests: `tests/Feature/Aiva/AivaBridgeTest.php`.

## Carina side (read path)

| Component | Role |
|-----------|------|
| `propreneur-bridge.ts` | HTTP client |
| `propreneur-portfolio.ts` | `propreneur-get-*` tools |
| `worker-bridge-store.ts` | Slug + encrypted key ref on `ai_workers` |
| `portfolio-context.ts` | 5-min cached context injection |
| `summary-generator.ts` | Daily text (+ optional TTS audio) |
| `aiva-email-api.ts` | Bind, summary config, Carina-only IMAP connect/test/poll |
| `email-poller.ts` | Background IMAP poll cron (non-Propreneur mailboxes only) |

## Feature flags (default off)

| Flag | System | Gates |
|------|--------|-------|
| `aiva_external_bridge` | Propreneur | Bridge HTTP routes |
| `PROPREENEUR_BRIDGE_ENABLED` | Carina | Bridge tools + context |
| `AIVA_DAILY_SUMMARY_ENABLED` | Carina | Summary cron |
| `EMAIL_INGESTION_ENABLED` | Carina | Carina-only IMAP API + background poll cron |
| `AIVA_EMAIL_POLL_CRON` | Carina | IMAP poll schedule (default `*/5 * * * *`) |
| `propreneur_event_webhooks` | Propreneur | Signed events to Carina (optional) |
| `PROPREENEUR_EVENT_WEBHOOKS` | Carina | Ingress `/api/aiva/webhooks/propreneur` |

## Pilot onboarding

See `carina/01-devends/planning/operations/PILOT_AIVA_BRIDGE_ONBOARDING_CHECKLIST.md`.

## Phase 2 writes (review queue)

Requires Propreneur flags `aiva_bridge_writes` + `aiva_bridge_review_queue` and Carina `PROPREENEUR_BRIDGE_WRITES`.

| Method | Path | Effect |
|--------|------|--------|
| POST | `/api/aiva-bridge/proposals/deal` | Pending deal proposal |
| POST | `/api/aiva-bridge/proposals/compliance` | Pending compliance proposal |
| POST | `/api/aiva-bridge/proposals/financial-log` | Pending rent/payment proposal |
| GET | `/api/aiva-bridge/proposals?status=pending` | List proposals |
| POST | `/api/aiva-bridge/proposals/{id}/approve` | Apply via domain services |
| POST | `/api/aiva-bridge/proposals/{id}/reject` | No side effects |

Tenant UI: **Settings > Aiva bridge review**. Carina tools: `propreneur-propose-*` (requiresConfirmation).

## Carina-only IMAP poller (A14)

When Propreneur does **not** poll a mailbox, Carina can ingest directly:

- Enable `EMAIL_INGESTION_ENABLED=true` on Carina core.
- Connect via `POST /api/aiva/email/connect`; configure senders; digests stored in `worker_email_digests`.
- Background poll: `startEmailIngestionPoller()` on core startup; cron from `AIVA_EMAIL_POLL_CRON`.
- `listPollableConnections` excludes workers with `propreneur_tenant_slug`; binding to Propreneur deletes any Carina IMAP connection.

## Related convergence work

Delivered via sprint-6 convergence prompts 01 (bridge closeout), 02 (brain sync), 03 (Tier 1 parity), 04 (TTS + event webhooks). Checklist: `CARINA_PROPRENEUR_CONVERGENCE_CHECKLIST.md`.
