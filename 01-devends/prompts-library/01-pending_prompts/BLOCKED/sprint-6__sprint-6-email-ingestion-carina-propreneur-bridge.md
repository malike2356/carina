# Sprint 6; Prompt: Email Ingestion Pipeline + Carina Aiva ↔ Propreneur Bridge

**Status: COMPLETED Phase 1 2026-06-24** (Phase 2 writes + Carina IMAP poller deferred; see convergence checklist A13-A14 and prompt 06)

**What was built:**

- **Carina core:** Migration `011-email-ingestion.sql`; IMAP connect/test API (`aiva-email-api.ts`); email parser + digest store; read-only `propreneur-bridge.ts` + `propreneur-portfolio.ts` tools; worker binding (`worker-bridge-store.ts`); portfolio context injection; daily summary cron (`summary-generator.ts`); optional TTS audio (`summary-tts.ts`, prompt 04); Propreneur event webhook ingress (prompt 04).
- **Propreneur v2:** `AivaBridgeController` + `AivaBridgeReadService` (portfolio, property, compliance, deals, email-activity); feature flag `aiva_external_bridge`; optional signed event webhooks to Carina (`PropreneurAivaEventWebhookService`, prompt 04).
- **Closeout via convergence prompts:** 01 (binding, context, summary, tests); 02 (brain sync); 03-04 (Tier 1/2 parity + TTS/webhooks).
- **Docs:** `CARINA_PROPRENEUR_CONVERGENCE_CHECKLIST.md`, `PILOT_AIVA_BRIDGE_ONBOARDING_CHECKLIST.md`, `brain/knowledge/132-aiva-propreneur-bridge-phase1.md`.
- **Tests:** Carina Vitest 10/10 (bridge + summary + message handler); Propreneur `AivaBridgeTest` (5 cases including email-activity).

**Sprint:** 6; Research App Integration & AI Employee Automation
**Prompt number:** 02
**Name:** Email ingestion pipeline + Carina-Aiva Propreneur data bridge
**Primary agent:** Claude Code (backend), Codex (deploy)
**Estimated hours:** 18-24 h
**Depends on:** Sprint 4 Aiva Brain (worker-brain.md; PARTIAL), Sprint 4 action-14 (email-channel-adapter)

---

## Post-build (MANDATORY)

When all "Done When" criteria below are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file.
2. Add a "**What was built:**" bullet list.
3. Move this file to `01-devends/prompts/02-archived_prompts/archives_from_pending_prompts/sprint-6/`.

Full checklist: `01-devends/prompts/01-pending_prompts/POST-BUILD-CHECKLIST.md`

---

## Safe Phase 1 (implement now)

**Goal:** Ship **Phase 1** (see `01-devends/planning/outreach/` for client-specific proposals): Aiva live on Telegram, daily summaries from day one, **human-assisted** email processing. No Propreneur writes. No duplicate IMAP polling.

**Risk rule:** If a mailbox is already in Propreneur `/settings/email-ingestion`, **only Propreneur polls it**. Carina reads digests via a read-only bridge, never a second IMAP client on the same inbox.

### Feature flags (all default off in prod until a pilot tenant is onboarded)

| Flag | Default | Gates |
|------|---------|-------|
| `EMAIL_INGESTION_ENABLED` | `false` | `/api/aiva/email/*`, IMAP poller, digest storage |
| `PROPREENEUR_BRIDGE_ENABLED` | `false` | Read-only Propreneur tools + portfolio context injection |
| `AIVA_DAILY_SUMMARY_ENABLED` | `false` | Per-Aiva summary cron + Telegram delivery |

Existing `AI_WORKERS_ENABLED` continues to gate all `/api/aiva` routes. New flags are **additional** guards inside that surface.

Add to `02-backends/core.carinaai.uk/.env.example` and `docker/docs/ENV-INVENTORY.md`.

### What to build in Phase 1

| Item | Build | Notes |
|------|-------|-------|
| **A1** IMAP connector | Partial | Connect + test only in API; **no background poller yet** |
| **A2** Email parser | Partial | Regex + optional LLM; store `EmailDigest` in Carina only |
| **A3** `/api/aiva/email` API | Yes | connect, status, disconnect, senders CRUD |
| **A4** DB migration | Yes | `011-email-ingestion.sql` (not `007`; that number is taken) |
| **B1** Propreneur bridge | Read-only | `getPortfolio`, `getProperty`, `getCompliance`, `getDeals` only |
| **B2** Tool registration | Read-only tools | Scout audit via existing `tool-runner` |
| **B3** Workspace binding | Yes | New column on `ai_workers`, not reuse of Carina `workspace_id` alone |
| **C1-C3** Daily summary | Yes | Text to Telegram; TTS optional behind same flag |
| **D1-D2** Portfolio Q&A | Read-only | Inject context + bridge read tools in `processAivaMessage` |

### Explicit SKIP in Phase 1

Do **not** implement yet:

- `createDeal`, `updateCompliance`, `logFinancial`, `addDocument` (Part B writes)
- Carina-side IMAP polling for mailboxes already in Propreneur `email_ingestion_configs`
- Direct SQL into Propreneur tenant DBs from Carina core (sprint pitfall #3)
- Full end-to-end integration test that writes into Propreneur
- Replacing Propreneur `EmailProcessingPipeline` or `emails:process` cron

### Pilot tenant architecture

```
Property manager / accountant
        |
        v
Propreneur IMAP (existing)  -->  email_processing_logs  -->  handlers (existing)
        |
        +-- read-only HTTP bridge (new, PROPREENEUR_BRIDGE_ENABLED)
                |
                v
Carina Aiva  -->  daily summary (Telegram)  +  portfolio Q&A (Telegram/WhatsApp)
```

For pilot tenant onboarding:

1. Configure email ingestion in **Propreneur** (`/settings/email-ingestion`), not Carina IMAP.
2. Create the client's Aiva in Carina; bind `propreneur_tenant_slug` + service API key on the worker row.
3. Enable Telegram channel on the Aiva (existing Sprint 4 path).
4. Turn on flags per worker/workspace after smoke test on a dedicated test tenant (e.g. xelox).

### Files to create (Carina core)

```
02-backends/core.carinaai.uk/src/infrastructure/migrations/011-email-ingestion.sql
02-backends/core.carinaai.uk/src/ingestion/email/imap-connector.ts
02-backends/core.carinaai.uk/src/ingestion/email/email-parser.ts
02-backends/core.carinaai.uk/src/ingestion/email/email-connection-store.ts
02-backends/core.carinaai.uk/src/api/aiva-email-api.ts
02-backends/core.carinaai.uk/src/bridges/propreneur-bridge.ts          # read-only methods only
02-backends/core.carinaai.uk/src/bridges/propreneur-bridge.types.ts
02-backends/core.carinaai.uk/src/workers/summary-generator.ts
02-backends/core.carinaai.uk/src/tools/propreneur-portfolio.ts         # read-only tool defs
```

### Files to modify (Carina core)

```
02-backends/core.carinaai.uk/src/index.ts                    # mount aiva-email-api behind flags
02-backends/core.carinaai.uk/src/api/aiva-api.ts             # optional: link from worker detail
02-backends/core.carinaai.uk/src/workers/aiva-message-handler.ts   # portfolio context injection
02-backends/core.carinaai.uk/src/workers/aiva-automation-scheduler.ts  # summary cron hook
02-backends/core.carinaai.uk/.env.example
02-backends/core.carinaai.uk/docker/docs/ENV-INVENTORY.md
```

Reuse patterns from:

- `src/channels/credential-store.ts` (encrypt IMAP creds with `CHANNEL_CREDENTIAL_KEY`)
- `src/gateway/imap-fetcher.ts` (ImapFlow connection; do not wire global env poller to per-worker)
- `src/workers/aiva-automation-scheduler.ts` (cron, not Hermes)
- `src/channels/adapters/telegram-adapter.ts` + `src/utils/tts.ts` (summary delivery)

### Files to create (Propreneur v2, minimal)

```
propreneur/propreneur-v2/app/Http/Controllers/Api/AivaBridgeController.php
propreneur/propreneur-v2/app/Services/Aiva/AivaBridgeReadService.php
propreneur/propreneur-v2/routes/tenant.php                 # new group, feature-flagged
propreneur/propreneur-v2/database/migrations/tenant/...    # aiva_bridge_api_keys if needed
```

Register a platform feature flag (e.g. `aiva_external_bridge`) in `PlatformFeatureCatalogue`. Gate routes with `feature:aiva_external_bridge`. **No changes** to `EmailIngestionService`, `EmailProcessingPipeline`, or CRM webhook controllers.

Bridge endpoints (read-only, Bearer service key per tenant):

- `GET /api/aiva-bridge/portfolio`
- `GET /api/aiva-bridge/properties/{id}`
- `GET /api/aiva-bridge/properties/{id}/compliance`
- `GET /api/aiva-bridge/deals`
- `GET /api/aiva-bridge/email-activity` (wraps existing `get_recent_email_activity` data)

### Migration `011-email-ingestion.sql`

```sql
-- worker_email_connections, worker_email_senders, worker_email_digests (per sprint A4)
ALTER TABLE ai_workers ADD COLUMN IF NOT EXISTS propreneur_tenant_slug TEXT;
ALTER TABLE ai_workers ADD COLUMN IF NOT EXISTS propreneur_bridge_key_ref TEXT; -- vault ref, not plaintext
ALTER TABLE ai_workers ADD COLUMN IF NOT EXISTS worker_config JSONB NOT NULL DEFAULT '{}';
```

`worker_config` holds summary schedule, sections, `include_audio`, delivery channel.

### Phase 1 Done When (subset of full sprint)

- [x] Migration `011` applied; tables + binding columns exist
- [x] `POST /api/aiva/email/connect` tests IMAP and stores encrypted creds (poller optional/disabled)
- [x] `GET /api/aiva/email/status` returns connection health
- [x] Read-only Propreneur bridge returns portfolio/compliance for bound test tenant
- [x] Daily summary cron sends **text** to the Aiva Telegram channel (quiet-day short format per pitfall #5)
- [x] "What's the rent status on Flat 4?" uses read bridge (or defers honestly if data not in read API yet)
- [x] Two-tenant test: Aiva A cannot read tenant B data
- [x] All flags `false` by default; existing Aiva channels unchanged
- [x] `pnpm test` and `tsc --noEmit` pass in `core.carinaai.uk`

### Validation commands

```bash
cd carina/02-backends/core.carinaai.uk
pnpm test
pnpm build

cd ../../propreneur/propreneur-v2
php artisan test --filter=AivaBridge
```

### Phase 2 (after Phase 1 is stable in production)

1. Enable Carina IMAP poller **only** for non-Propreneur mailboxes (or forwarders). **Status: PENDING (A14)**
2. Auto-write to Propreneur with human review queue (`PROPREENEUR_BRIDGE_WRITES`). **Status: PENDING (A13, prompt 06)**
3. ~~TTS audio on daily summary.~~ **DONE** (prompt 04, `summary-tts.ts`, `includeAudio` in worker config)
4. Full integration test: email -> Propreneur -> summary -> Telegram. **Status: PENDING** (requires Phase 2 writes)

---

## Read First

Before writing any code, read these files in full:

1. `02-backends/core.carinaai.uk/src/server.ts`; route mounting
2. `02-backends/core.carinaai.uk/src/workers/`; existing Aiva worker infrastructure
3. `02-backends/core.carinaai.uk/src/api/aiva-api.ts`; existing Aiva API
4. `02-backends/core.carinaai.uk/src/infrastructure/migrations/006-ai-workers.sql`; DB schema
5. `02-backends/core.carinaai.uk/src/memory/db.ts`; pool.query pattern
6. `02-backends/propreneur/`; Propreneur codebase (Laravel); understand existing models
7. `01-devends/planning/strategy/CARINA_AI_EMPLOYEE_PLAN.md`; full product spec
8. `01-devends/prompts/01-pending_prompts/sprint-4-action-14-email-channel-adapter.md`; email adapter status

---

## Context

The goal is to eliminate human-in-the-loop for data ingestion so an Aiva can serve a client end-to-end:

1. **Email ingestion:** Aiva connects to a client's email (IMAP). Reads incoming messages from specified senders (property managers, accountants). Parses content. Extracts structured data.

2. **Propreneur data bridge:** Carina can read from and write to Propreneur's database. Knows portfolio structure; properties, tenants, deals, compliance items, documents.

3. **Daily summary automation:** A cron-driven workflow generates a daily briefing from new emails + Propreneur state. Delivers via Telegram (text + audio via TTS).

4. **Portfolio Q&A:** Client messages Aiva on WhatsApp/Telegram. Aiva queries Propreneur data and answers from real portfolio state.

---

## What to Build

### Part A: Email Ingestion Pipeline

**A1. IMAP connector service**
- New file: `02-backends/core.carinaai.uk/src/ingestion/email/imap-connector.ts`
- Connects to any IMAP server (Gmail, Outlook, custom) using user-provided credentials
- Credentials stored encrypted in `worker_email_connections` table
- Polls inbox on configurable interval (default: every 5 minutes)
- Fetches unseen messages from configured sender addresses only
- Marks messages as seen after successful processing
- Handles reconnection, timeouts, rate limits gracefully

**A2. Email parser**
- New file: `02-backends/core.carinaai.uk/src/ingestion/email/email-parser.ts`
- Extracts structured fields from email body (plain text and HTML)
- Identifies: sender role (property manager vs accountant vs other), property reference, amounts (£), dates, action items
- Uses Carina's LLM for semantic extraction when regex is insufficient
- Outputs a typed `EmailDigest` object: `{ from, role, propertyRef, amounts, dates, summary, actionRequired, rawText }`

**A3. Email connection management API**
- New endpoints on `/api/aiva/email`:
  - `POST /connect`; store IMAP credentials, test connection, start polling
  - `GET /status`; connection health, last poll time, messages processed
  - `POST /disconnect`; stop polling, remove credentials
  - `GET /senders`; list configured sender addresses to monitor
  - `POST /senders`; add sender address with role tag (property_manager, accountant, etc.)

**A4. Database migration**
- New migration: `007-email-ingestion.sql`
- Table `worker_email_connections`: `id, worker_id, imap_host, imap_port, encrypted_credentials, last_poll_at, status, created_at`
- Table `worker_email_senders`: `id, connection_id, email_address, role_tag, created_at`
- Table `worker_email_digests`: `id, worker_id, message_id, from_address, role_tag, parsed_data (JSONB), processed_at, created_at`

### Part B: Carina Aiva ↔ Propreneur Data Bridge

**B1. Propreneur data API**
- New file: `02-backends/core.carinaai.uk/src/bridges/propreneur-bridge.ts`
- Query interface for Aiva to read Propreneur data:
  - `getPortfolio(workspaceId)`; all properties with status
  - `getProperty(propertyId)`; single property detail
  - `getTenants(propertyId)`; tenants for a property
  - `getDeals(workspaceId, status?)`; deal pipeline
  - `getCompliance(propertyId)`; certificates, EPC, gas safety, expiry dates
  - `getDocuments(propertyId)`; linked documents
  - `getFinancials(propertyId)`; rent ledger, invoices
- Write interface:
  - `createDeal(data)`; add deal from email
  - `updateCompliance(propertyId, data)`; update certificate from email
  - `logFinancial(propertyId, data)`; record payment from email
  - `addDocument(propertyId, file)`; attach document from email

**B2. Aiva tool registration**
- Register Propreneur bridge functions as Carina tools
- Aiva can call these tools during conversations
- Tools are scoped to the Aiva's workspace; cannot cross tenant boundaries
- Scout audits all tool calls

**B3. Workspace binding**
- Each Aiva is bound to a Propreneur workspace
- Binding stored in `ai_workers` table: `workspace_id` column
- On Aiva creation, workspace binding is set
- All Propreneur queries scoped to bound workspace

### Part C: Daily Summary Automation

**C1. Summary generator**
- New file: `02-backends/core.carinaai.uk/src/workers/summary-generator.ts`
- Cron-driven (configurable schedule, default: 7am daily)
- Gathers: new email digests since last summary, upcoming compliance deadlines, deal pipeline changes, rent payment status
- Generates structured summary via LLM
- Delivers via Telegram message channel
- Optionally generates audio version via TTS and attaches

**C2. Summary delivery**
- Uses existing Telegram channel adapter
- Message format: header (date, portfolio name) + sections (emails, compliance, deals, finance) + footer (Aiva name, "Reply to ask me anything")
- Audio: TTS-generated voice note, same content as text summary

**C3. Summary configuration**
- Per-Aiva settings: delivery time, delivery channel, include audio (bool), summary sections (which to include)
- Stored in `worker_config` JSONB on `ai_workers` table

### Part D: Portfolio Q&A

**D1. Conversation context injection**
- When a client messages Aiva, inject Propreneur portfolio context into system prompt
- Context includes: property list, recent activity, upcoming deadlines
- Updated on each message (or cached with 5-min TTL)

**D2. Natural language query handling**
- "What's the rent status on Flat 4?" → queries Propreneur financials
- "When does the gas safety expire on Unit 12?" → queries compliance
- "Show me all deals in pipeline" → queries deals
- Aiva uses Propreneur bridge tools to answer

---

## Done When

### Phase 1 (complete 2026-06-24)

- [x] Email connection management API works (connect, status, disconnect, senders CRUD)
- [x] Database migrations applied; tables created
- [x] Daily summary cron job runs and delivers to Telegram (text)
- [x] Daily summary includes audio option via TTS (optional `includeAudio`)
- [x] Client messages Aiva on Telegram → Aiva answers from Propreneur data (read bridge)
- [x] "What's the rent status on Flat 4?" returns real data from Propreneur (via bridge tools)
- [x] "When does the EPC expire on Unit 12?" returns real compliance data
- [x] All bridge tool calls audited by Scout (tool-runner path)
- [x] Workspace scoping enforced; Aiva cannot access other workspaces
- [x] `tsc --noEmit` passes (`pnpm build`)

### Phase 2 (deferred)

- [ ] IMAP connector polls inbox and fetches emails from configured senders (Carina poller; A14)
- [ ] Email parser extracts structured data and stores Carina digests (poller path)
- [ ] Parsed data writes to Propreneur (deals, compliance, financials) via bridge (A13)
- [ ] Integration test: email arrives → data enters Propreneur → summary generated → delivered to Telegram

---

## Deployment Notes

- IMAP credentials must be encrypted at rest (use existing vault/key management)
- Email polling interval configurable per Aiva (not global)
- Propreneur bridge uses direct DB connection (same Postgres instance); no HTTP overhead
- Summary cron uses Hermes cron infrastructure; one cron job per active Aiva
- TTS for summaries uses configured TTS provider (Edge by default; OpenAI for higher quality)

---

## Pitfalls

1. **IMAP rate limits.** Gmail IMAP has undocumented rate limits. Keep polling interval ≥ 2 minutes. Use IDLE where supported.
2. **Email parsing ambiguity.** Not all property managers format emails consistently. LLM extraction is good but not perfect. Flag low-confidence extractions for review.
3. **Propreneur schema changes.** The bridge must stay in sync with Propreneur migrations. Version-lock the bridge to a known schema version.
4. **Tenant isolation.** Workspace scoping is critical. A bug here exposes client data. Test with two workspaces.
5. **Summary fatigue.** Daily summaries that say "nothing new" are noise. Generate summary only when there is new activity. Send "no updates" message on quiet days (shorter format).
