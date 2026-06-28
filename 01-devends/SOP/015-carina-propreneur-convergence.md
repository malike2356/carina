# SOP 015: Carina + Propreneur Convergence Checklist
**Classification:** Internal VERLOX only. Do not share externally.
**Source:** Migrated from planning/operations/CARINA_PROPRENEUR_CONVERGENCE_CHECKLIST.md
**Last reviewed:** 2026-06-25

---

# Carina + Propreneur Convergence Checklist

**Updated:** 2026-06-24 (Phase 2 bridge writes via prompt 06; complement guide prompt 05)

**Phase 1 bridge Pest/Vitest matrix (A6-A11):**

| ID | Test / doc |
|----|------------|
| A6 | `worker-bridge-store.ts` + `POST /api/aiva/workers/:id/propreneur/bind` (portfolio smoke before save) |
| A7 | `portfolio-context.test.ts` (3 tests) |
| A8 | `summary-generator.test.ts` (quiet-day + per-worker cron) |
| A5 | `aiva-message-handler.test.ts` (4 tests, tool allowlist) |
| A9 | `aiva-email-api.ts` 409 when worker bound to Propreneur |
| A10 | `011-email-ingestion.sql` + `email-connection-store.ts` + background IMAP poller |
| A11 | `tests/Feature/Aiva/AivaBridgeTest.php` (tenant isolation + email-activity) |
| Pilot | `SOP/007-aiva-pilot-onboarding.md` |
| Ops doc | `brain/knowledge/132-aiva-propreneur-bridge-phase1.md` (synced to Carina brain) |
| Complement | `SOP/014-carina-propreneur-operator-guide.md` (which agent when; review queue) |
| A13 | `AivaBridgeProposalTest.php`, Carina write-tool tests in `aiva-message-handler.test.ts` |

**Tier 1 Pest tests (B1-B7):**

| ID | Test file |
|----|-----------|
| B2 | `tests/Feature/Carina/MemoryToolHandlerTest.php` |
| B3 | `tests/Unit/Carina/CarinaModuleToolsRegistryTest.php` + persona in `CarinaAgentService` |
| B4 | `tests/Feature/Carina/ClarifyToolHandlerTest.php` |
| B5 | `tests/Feature/Carina/WebSearchFallbackTest.php` |
| B6 | `tests/Feature/Carina/ScheduledTaskToolHandlerTest.php` |
| B1 | `tests/Feature/Carina/ModelSlashCommandTest.php`, `tests/Feature/Carina/ProviderRoutingTest.php` |
| B7 | `brain/knowledge/130-carina-provider-policy.md` (synced to Carina brain) |

**Tier 2 tests (C1-C5):**

| ID | Test / doc |
|----|------------|
| C1 | `tests/Feature/Carina/TranscriptionToolHandlerTest.php`, `tests/fixtures/carina/sample-voice-note.ogg` |
| C2 | `summary-tts.ts`, `summary-generator.ts` (includeAudio), Vitest `summary-tts.test.ts` |
| C3 | `tests/Feature/Carina/WebhookToolHandlerTest.php` |
| C5 | `PropreneurAivaEventWebhookService`, `tests/Feature/Integrations/PropreneurAivaEventWebhookTest.php`, Carina `propreneur-event-webhook.test.ts` |
| Docs | `brain/knowledge/131-carina-voice-and-webhooks.md` |

**Principle:** Unity is strength. Addition, not replacement. Each capability has one **owner**; the other system **consumes** it via flags and HTTP contracts.

**Related prompts:** `01-devends/prompts/02-archived_prompts/archives_from_pending_prompts/sprint-6/` (master index + convergence 01-06 + original bridge; all COMPLETED)
**Pilot onboarding (config only):** `SOP/007-aiva-pilot-onboarding.md`
**Sprint 6 bridge spec (Phase 1 complete):** `archives_from_pending_prompts/sprint-6/sprint-6-email-ingestion-carina-propreneur-bridge.md`
**Parity source:** `01-devends/planning/operations/carina_propreneur_parity_audit.md`

---

## Legend

| Status | Meaning |
|--------|---------|
| DONE | Shipped and test-covered |
| PARTIAL | Code exists; gaps in wiring, flags, tests, or docs |
| PENDING | Not started or explicitly deferred |
| N/A | Concept-only (Tier 3); no runtime merge |

---

## A. Bridge and shared runtime (Sprint 6)

| ID | Capability | Owner | Consumer | Flag(s) | Sprint 6 item | Status |
|----|------------|-------|----------|---------|---------------|--------|
| A1 | Portfolio read API | Propreneur | Carina Aiva | `aiva_external_bridge` (PP), `PROPREENEUR_BRIDGE_ENABLED` (Carina) | B1 | DONE |
| A2 | Property / compliance / deals read | Propreneur | Carina Aiva | same | B1 | DONE |
| A3 | Email activity digest (no IMAP dup) | Propreneur | Carina Aiva | same | B1 + `email-activity` endpoint | DONE |
| A4 | Bridge HTTP client + types | Carina | (internal) | `PROPREENEUR_BRIDGE_ENABLED` | `propreneur-bridge.ts` | DONE |
| A5 | Read-only bridge tools in tool-runner | Carina | Aiva sessions | `PROPREENEUR_BRIDGE_ENABLED` + `AI_WORKERS_ENABLED` | B2 | DONE |
| A6 | Worker workspace binding (slug + key ref) | Carina | Aiva | `AI_WORKERS_ENABLED` | B3, migration 011 | DONE |
| A7 | Portfolio context injection on message | Carina | Aiva | `PROPREENEUR_BRIDGE_ENABLED` | D1 | DONE |
| A8 | Daily summary cron (text) | Carina | Telegram/WhatsApp | `AIVA_DAILY_SUMMARY_ENABLED` | C1-C3 | DONE |
| A9 | Carina-only IMAP (connect/test) | Carina | Aiva | `EMAIL_INGESTION_ENABLED` | A1-A3 | DONE |
| A10 | Email digest storage (Carina DB) | Carina | Summary + Q&A | `EMAIL_INGESTION_ENABLED` | A2, A4 | DONE |
| A11 | Tenant isolation (A cannot read B) | Propreneur + Carina | both | bridge key per tenant | Phase 1 Done When | DONE (tests exist) |
| A12 | Scout audit on bridge tool calls | Scout | Carina | `LABYRINTH_ENABLED` | B2 | DONE (tool-runner path) |
| A13 | Bridge writes (deals, compliance) | Propreneur | Carina Aiva | `aiva_bridge_writes` (PP), `PROPREENEUR_BRIDGE_WRITES` (Carina) | Phase 2 | DONE |
| A14 | Carina IMAP poller (non-PP mailboxes only) | Carina | Aiva | `EMAIL_INGESTION_ENABLED` | Phase 2 | DONE |

**Risk rules (non-negotiable):**

- If mailbox is in Propreneur `/settings/email-ingestion`, **only Propreneur polls it**.
- No direct SQL from Carina into Propreneur tenant DBs.
- All bridge flags default **false** in production until pilot onboarding.

---

## B. Tier 1 parity ports (brain, not body)

| ID | Capability | Owner | Consumer | Flag(s) | Parity tier | Status |
|----|------------|-------|----------|---------|-------------|--------|
| B1 | Provider switching (/model, task routing) | Propreneur `AiRouterService` | In-app Carina | `carina_ai`, `carina_provider_routing_v2`, tenant BYOK | Tier 1 #1 | DONE |
| B2 | Persistent memory (`remember` / `recall`) | Propreneur | In-app Carina | `carina_agent` | Tier 1 #2 | DONE |
| B3 | No emojis / no dash enforcement | Propreneur | In-app Carina | persona + `TOOL_INSTRUCTION` | Tier 1 #3 | DONE |
| B4 | Clarify before costly actions | Propreneur | In-app Carina | `carina_agent` | Tier 1 #4 | DONE |
| B5 | Multi-engine web search (Tavily + fallback) | Propreneur | In-app Carina | `config/ai.php` Tavily gates | Tier 1 #5 | DONE |
| B6 | Flexible scheduled tasks (user cron) | Propreneur | In-app Carina | `carina_agent` | Tier 1 #6 | DONE |
| B7 | Provider policy alignment doc | Shared planning | both engines | N/A | supports B1 | DONE |

**Consumer note:** Standalone Carina already has 23 providers; Propreneur should **align policy** (when to use Claude vs DeepSeek), not reimplement the Node router.

---

## C. Tier 2 parity ports (safe, needs testing)

| ID | Capability | Owner | Consumer | Flag(s) | Parity tier | Status |
|----|------------|-------|----------|---------|-------------|--------|
| C1 | Speech-to-text (viewing voice notes) | Propreneur | In-app Carina | `carina_agent` | Tier 2 #7 | DONE |
| C2 | TTS (Edge / OpenAI) for summaries | Carina | Aiva channels | `AIVA_DAILY_SUMMARY_ENABLED` + `includeAudio` | Tier 2 #8 | DONE |
| C3 | Webhook subscriptions (external events) | Propreneur | In-app Carina | `carina_agent` | Tier 2 #9 | DONE |
| C4 | SKILL.md auto-generation from brain | Carina sync | property-uk (opt-in) | `BRAIN_KNOWLEDGE_SKILLS_ENABLED` | Tier 2 #10 | DONE |
| C5 | Propreneur -> Carina event webhooks (optional) | Propreneur | Carina workers | `propreneur_event_webhooks` + `PROPREENEUR_EVENT_WEBHOOKS` | bridge extension | DONE |

---

## D. Tier 3 concept adoption (no engine merge)

| ID | Capability | Owner | Consumer | Flag(s) | Parity tier | Status |
|----|------------|-------|----------|---------|-------------|--------|
| D1 | Workspace files (USER.md, portfolio profile) | Propreneur tenant settings | Carina context via bridge | tenant settings | Tier 3 #11 | N/A |
| D2 | Config over hardcoded values | both codebases | maintainers | env + feature flags | Tier 3 #12 | N/A |
| D3 | Heartbeat / proactive briefing extensions | Propreneur cron + Carina summary | both | existing briefing + `AIVA_DAILY_SUMMARY_ENABLED` | Tier 3 #13 | N/A |

---

## E. What each engine owns permanently

| Domain | Owner | Why |
|--------|-------|-----|
| CRM, pipeline, calculators, compliance **writes** | Propreneur | Tenant DB, confirmation gates, Filament audit |
| 18 channel adapters, Aiva fleet, subagents | Carina core | Already built; Scout fleet integration |
| Property RAG corpus (authoring) | Shared `brain/` | Single source; ingest into both stores |
| Scout security envelope | Scout | Optional; `LABYRINTH_ENABLED=false` leaves Propreneur untouched |
| In-app chat agent loop | Propreneur | Low latency; do not proxy every turn to Node |

---

## F. Implementation order (completed)

1. DONE - Close Sprint 6 Phase 1 gaps (A6-A10) (prompt 01 closeout 2026-06-24)
2. DONE - Shared knowledge sync (C4, RAG parity) (prompt 02)
3. DONE - Tier 1 gaps (B1, B5, B7) (prompt 03)
4. DONE - Tier 2 gaps (C1-C2, C5) (prompt 04)
5. DONE - Complement paths (Propreneur defers channels to Aiva; Carina defers writes to Propreneur). (2026-06-24)
6. DONE - Phase 2 writes + review queue (A13). (2026-06-24)

---

## G. Validation matrix

| Check | Command / test |
|-------|----------------|
| Bridge read isolation | `php artisan test --filter=AivaBridge` |
| Bridge proposal queue | `php artisan test --filter=AivaBridgeProposal` |
| Tier 1 brain parity | `php artisan test --filter=Carina` (Memory, Clarify, ScheduledTask, WebSearchFallback, ModelSlashCommand, ProviderRouting) |
| Carina bridge tools | `pnpm test` in `core.carinaai.uk` (propreneur-portfolio, bridge) |
| Flags default off | `.env.example` + `ENV-INVENTORY.md` |
| No duplicate IMAP | Manual: PP mailbox not in Carina poller |
| Scout optional | `LABYRINTH_ENABLED=false` smoke test |
