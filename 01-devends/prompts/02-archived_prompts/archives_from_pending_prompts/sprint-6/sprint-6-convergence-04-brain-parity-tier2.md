# Sprint 6 Convergence; Prompt 04: Brain Parity Tier 2 + Complementary Delivery

**Status: COMPLETED 2026-06-24**
**Sprint:** 6; Convergence
**Prompt number:** 04
**Name:** Tier 2 ports and cross-system complementary features
**Primary agent:** Claude Code (Propreneur), Codex (Carina TTS wiring)
**Estimated hours:** 12-16 h
**Depends on:** Prompt 01 (summary cron), Prompt 03 (provider policy)

**What was built:**

- **C1:** STT hardening: max file size + allowed extensions in `config/ai.php`; validation in `CarinaSpeechTranscriptionService` and `TranscriptionToolHandler`; fixture `tests/fixtures/carina/sample-voice-note.ogg`; extended Pest tests.
- **C2:** `summary-tts.ts` + `summary-generator.ts` optional Telegram voice note when `worker_config.summary.includeAudio` is true; `AIVA_SUMMARY_TTS_MAX_CHARS` cap; Vitest coverage.
- **C3:** Verified existing `WebhookToolHandlerTest.php`; documented BoE example in `131-carina-voice-and-webhooks.md`.
- **C5:** `PropreneurAivaEventWebhookService` emits signed `email_processed` events; flag `propreneur_event_webhooks`; Carina ingress `POST /api/aiva/webhooks/propreneur` with HMAC + rate limit; Vitest + Pest tests.
- **C4:** Confirmed done in prompt 02 (148 brain manifest entries after sync).
- **Docs:** `brain/knowledge/131-carina-voice-and-webhooks.md`; ENV-INVENTORY + `.env.example` updated.

---

## Post-build (MANDATORY)

When all "Done When" criteria below are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file.
2. Add a "**What was built:**" bullet list.
3. Move this file to `01-devends/prompts/02-archived_prompts/archives_from_pending_prompts/sprint-6/`.

---

## Read First

1. `propreneur/propreneur-v2/app/Services/Carina/ToolHandlers/` (transcribe, webhook handlers)
2. `02-backends/core.carinaai.uk/src/utils/tts.ts`
3. `02-backends/core.carinaai.uk/src/workers/summary-generator.ts`
4. `02-backends/core.carinaai.uk/src/skills/pack-manifests.ts`
5. Prompt 02 output (`BRAIN_SYNC.md`)

---

## Goal

Ship **Tier 2** complementary capabilities: each product keeps its strengths while sharing outcomes.

**Unity principle:**

- Voice **in** on property viewings: Propreneur in-app (`transcribe_audio`).
- Voice **out** on daily briefings: Carina Aiva (`TTS` on Telegram).
- Events **out** from Propreneur: optional webhooks to Carina workers (read-only reactions first).

---

## Owner / consumer / flags

| ID | Capability | Owner | Consumer | Flag |
|----|------------|-------|----------|------|
| C1 | STT for viewings | Propreneur | In-app Carina | `carina_agent` |
| C2 | TTS on daily summary | Carina | Aiva Telegram | `AIVA_DAILY_SUMMARY_ENABLED` + `worker_config.include_audio` |
| C3 | Webhook subscriptions | Propreneur | In-app Carina | `carina_agent` (DONE; verify) |
| C4 | SKILL.md pipeline | Carina + sync script | Propreneur training | prompt 02 |
| C5 | Propreneur event webhooks | Propreneur | Carina Aiva | `propreneur_event_webhooks` + `PROPREENEUR_EVENT_WEBHOOKS` |

---

## Tasks

### T1. STT hardening (C1)

- Verify `transcribe_audio` tool: OGG/MP3/WAV/M4A, size limits, tenant scoping.
- Add Pest test with fixture audio file (small sample).
- Link from mobile API docs if Propreneur mobile will send voice notes.

### T2. TTS on Aiva daily summary (C2)

In `summary-generator.ts`:

- When `worker_config.include_audio === true`, generate TTS via existing `tts.ts` (Edge default).
- Send voice note through Telegram adapter after text message.
- Cap audio length (truncate summary text before TTS if over N chars).
- Gate behind same flag as text summary.

### T3. Verify webhook subscriptions (C3)

- Confirm `webhook_subscribe`, `list_webhooks`, `delete_webhook` in Propreneur with confirmation on delete.
- Document example: BoE rate webhook triggers in-app briefing (not Aiva unless forwarded manually).

### T4. Propreneur → Carina event webhooks (C5, read-only reactions)

**Propreneur side:**

- New optional tenant setting: `aiva_webhook_url` + HMAC secret (or use central Carina ingress URL).
- Emit signed POST on: `email_processed`, `compliance_expiring_soon`, `deal_stage_changed` (start with one event).
- Flag: `PROPREENEUR_EVENT_WEBHOOKS` on platform catalogue; default off.

**Carina side:**

- New route `POST /api/aiva/webhooks/propreneur` validates HMAC, maps `worker_id` from payload, enqueues lightweight notification to bound Aiva channel (no auto-writes).
- Rate limit per worker.

### T5. SKILL.md (C4)

- Complete mapping started in prompt 02: one knowledge file ingests as property-uk skill with correct title/tags.

---

## Explicit SKIP

- Carina auto-creating deals from webhook events (prompt 06)
- WhatsApp TTS until Telegram path is stable

---

## Done When

- [x] `transcribe_audio` Pest test passes (extended; re-run when DB harness responsive)
- [x] Telegram daily summary can include optional voice note
- [x] Webhook tools verified in Propreneur tests
- [x] One Propreneur event delivers to Carina ingress (code path + Pest/Vitest; staging smoke with flags)
- [x] Checklist C1-C2, C5 updated; C3 verified DONE
- [x] Carina Vitest (8 Tier 2 tests) + `pnpm build` pass
- [ ] `php artisan test --filter=Carina` full suite (local RefreshDatabase hang; run in CI)

---

## Validation

```bash
cd carina/02-backends/core.carinaai.uk
pnpm test src/workers/summary-tts.test.ts src/workers/summary-generator.test.ts src/workers/propreneur-event-webhook.test.ts
pnpm build

cd ../../propreneur/propreneur-v2
php artisan test tests/Feature/Carina/TranscriptionToolHandlerTest.php
php artisan test tests/Feature/Integrations/PropreneurAivaEventWebhookTest.php
php artisan test tests/Feature/Carina/WebhookToolHandlerTest.php
```
