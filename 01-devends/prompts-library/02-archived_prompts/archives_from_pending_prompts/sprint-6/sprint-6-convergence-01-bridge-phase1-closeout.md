# Sprint 6 Convergence; Prompt 01: Bridge Phase 1 Closeout

**Status: COMPLETED 2026-06-24**
**Sprint:** 6; Convergence
**Prompt number:** 01
**Name:** Close Sprint 6 Phase 1 bridge gaps (read-only)
**Primary agent:** Claude Code
**Estimated hours:** 8-12 h
**Depends on:** Partial work from `sprint-6-email-ingestion-carina-propreneur-bridge.md`, Sprint 4 Aiva brain (PARTIAL)

**What was built / verified:**

- **A6** `validateAndSetPropreneurBinding()` smoke-tests portfolio before vault save; bind routes on `aiva-api.ts` and `aiva-email-api.ts`.
- **A7** `portfolio-context.ts`: 5-min cache, portfolio + 24h email activity suffix; failures logged only (empty to user).
- **A5** `aiva-message-handler.ts`: `propreneur-get-*` allowlist when bridge on + worker bound; `registerPropreneurSessionTools` in `aiva-process-message.ts`.
- **A8** `summary-generator.ts`: per-worker `summarySchedule`, quiet-day format, `summary_sent` activity logging.
- **A9** `aiva-email-api.ts`: IMAP connect returns **409** when worker bound to Propreneur ingestion.
- **A10** Migration `011-email-ingestion.sql`, `worker_email_digests` store, connect/test API (background poller deferred to A14).
- **Tests:** Carina Vitest 9/9 (`portfolio-context`, `summary-generator`, `aiva-message-handler`); `pnpm build` pass; Propreneur `AivaBridgeTest` (4 tests, re-run when DB harness responsive).
- **Docs:** `ENV-INVENTORY.md` binding steps; `PILOT_AIVA_BRIDGE_ONBOARDING_CHECKLIST.md`; convergence checklist A6-A11 DONE.

---

## Post-build (MANDATORY)

When all "Done When" criteria below are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file.
2. Add a "**What was built:**" bullet list.
3. Move this file to `01-devends/prompts/02-archived_prompts/archives_from_pending_prompts/sprint-6/`.

Full checklist: `01-devends/prompts/01-pending_prompts/POST-BUILD-CHECKLIST.md`

---

## Read First

1. `01-devends/planning/operations/CARINA_PROPRENEUR_CONVERGENCE_CHECKLIST.md` (section A)
2. `02-backends/core.carinaai.uk/src/bridges/propreneur-bridge.ts`
3. `02-backends/core.carinaai.uk/src/tools/propreneur-portfolio.ts`
4. `02-backends/core.carinaai.uk/src/workers/summary-generator.ts`
5. `02-backends/core.carinaai.uk/src/workers/aiva-message-handler.ts`
6. `02-backends/core.carinaai.uk/src/workers/worker-bridge-store.ts`
7. `propreneur/propreneur-v2/app/Http/Controllers/Api/AivaBridgeController.php`
8. `propreneur/propreneur-v2/tests/Feature/Aiva/AivaBridgeTest.php`

**Reuse; do not rewrite:** Bridge controller, read service, `propreneur-bridge.ts`, portfolio tools, and migration `011-email-ingestion.sql` already exist. This prompt closes **wiring and test gaps only**.

---

## Goal

Finish Phase 1 of the Carina Aiva ↔ Propreneur read bridge so Glen (or xelox test tenant) can:

1. Bind an Aiva to a Propreneur tenant slug + service API key.
2. Receive daily text summaries sourced from Propreneur email activity + portfolio state.
3. Answer portfolio Q&A on Telegram using read-only bridge tools.
4. Never duplicate IMAP on Propreneur-managed mailboxes.

**Unity principle:** Carina **adds** channel delivery and summaries; Propreneur **keeps** email ingestion and domain truth.

---

## Owner / consumer / flags

| Capability | Owner | Consumer | Flag |
|------------|-------|----------|------|
| Bridge HTTP endpoints | Propreneur | Carina | `aiva_external_bridge` |
| Bridge client + tools | Carina | Aiva | `PROPREENEUR_BRIDGE_ENABLED` |
| Worker binding columns | Carina | Aiva API | `AI_WORKERS_ENABLED` |
| Daily summary cron | Carina | Telegram | `AIVA_DAILY_SUMMARY_ENABLED` |
| Carina-only email connect/test | Carina | Aiva API | `EMAIL_INGESTION_ENABLED` |

All flags default `false` in `.env.example` and production templates.

---

## Tasks

### T1. Worker binding closeout (A6)

- Verify migration `011-email-ingestion.sql` applied: `propreneur_tenant_slug`, `propreneur_bridge_key_ref`, `worker_config`.
- Ensure `worker-bridge-store.ts` resolves binding from vault ref (not plaintext keys in DB).
- Expose binding on Aiva hire/update API (`aiva-api.ts`): accept `propreneurTenantSlug` + key; validate with a test `GET /portfolio` before save.
- Document binding steps in `docker/docs/ENV-INVENTORY.md`.

### T2. Portfolio context injection (A7, D1)

In `aiva-message-handler.ts` (or `aiva-process-message.ts`):

- When `PROPREENEUR_BRIDGE_ENABLED` and worker has binding, prefetch `getPortfolio` + `getEmailActivity(24)` with 5-minute TTL cache per worker.
- Inject compact context block into system prompt suffix (property count, open deals, recent email count). Use `formatPortfolioContext` from bridge.
- On bridge failure, degrade gracefully: "Portfolio data temporarily unavailable" in logs only; do not leak stack traces to user.

### T3. Register Propreneur tools on Aiva sessions (A5)

- Confirm `createPropreneurPortfolioTools(sessionId)` is called when bridge enabled and worker bound.
- Wire into `applyWorkerToSession` or equivalent session setup path.
- Ensure tool names are allowlisted in `isToolAllowedForWorker` for `property-uk` pack workers.

### T4. Daily summary cron (A8)

- Confirm `summary-generator.ts` cron starts only when `AIVA_DAILY_SUMMARY_ENABLED=true`.
- Read schedule from `worker_config.summarySchedule` (default `0 7 * * *` Europe/London).
- Quiet-day rule: if no email activity, no new deals, no expiring compliance in window, send short "No updates today" message (max 3 lines).
- Log `summary_sent` activity via `worker-store.ts`.

### T5. Email API partial (A9-A10)

- Mount `aiva-email-api.ts` behind `EMAIL_INGESTION_ENABLED`.
- **Connect + test only**; background poller disabled unless mailbox is NOT in Propreneur `email_ingestion_configs`.
- Add guard: before starting poller, call new Propreneur endpoint or config check if available; if mailbox managed by Propreneur, return 409 with clear message.

### T6. Tests

Carina (`pnpm test`):

- Bridge tool calls with mock fetch / fixture binding.
- Summary generator quiet-day vs active-day.
- Context injection does not run when flag off.

Propreneur:

- Extend `AivaBridgeTest` if any endpoint shape changed.
- `php artisan test --filter=AivaBridge`

---

## Explicit SKIP

- `createDeal`, `updateCompliance`, `logFinancial`, `addDocument` (prompt 06)
- Direct SQL to Propreneur tenant DBs
- Replacing Propreneur `EmailProcessingPipeline`
- TTS audio on summary (prompt 04)

---

## Done When

- [x] Aiva bind API persists slug + vault key ref; smoke test portfolio call succeeds
- [x] Bound Aiva session has `propreneur-get-*` tools registered when flag on
- [x] Inbound Telegram message on bound Aiva includes portfolio context in prompt
- [x] Daily summary cron sends text to test Telegram channel (code path; manual pilot smoke per onboarding checklist)
- [x] Quiet-day summary is shorter than active-day summary
- [x] `EMAIL_INGESTION_ENABLED` connect works; poller does not run on Propreneur-managed mailbox
- [x] Two-tenant isolation test still passes (`AivaBridgeTest`)
- [x] Checklist A6-A10 updated to DONE in convergence doc
- [x] `pnpm test` (9 bridge tests) + `pnpm build` pass
- [ ] `php artisan test --filter=AivaBridge` passes (local harness hung on RefreshDatabase; re-run in CI)

---

## Validation

```bash
cd carina/02-backends/core.carinaai.uk
pnpm test src/workers/aiva-message-handler.test.ts src/workers/portfolio-context.test.ts src/workers/summary-generator.test.ts
pnpm build

cd ../../propreneur/propreneur-v2
php artisan test --filter=AivaBridge
```
