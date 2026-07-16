# Carina voice, webhooks, and cross-system events

**Last updated:** 2026-06-24

## Speech-to-text (in-app Carina, C1)

**Owner:** Propreneur `CarinaSpeechTranscriptionService` + `transcribe_audio` tool.

**Use case:** Property viewing voice notes in the in-app Carina agent and mobile app.

| Setting | Default |
|---------|---------|
| Provider priority | `openai,groq` (Whisper-compatible APIs) |
| Max file size | 25 MB (`AI_SPEECH_MAX_FILE_BYTES`) |
| Allowed formats | ogg, mp3, wav, m4a, webm |

**Mobile:** `POST /api/mobile/v1/chat/voice` sends multipart audio; server transcribes then runs the agent loop. See `docs/carina-mobile-architecture.md` section 8.

**Agent tool:** `transcribe_audio` with `file_url` (local path or HTTPS URL) and optional `language`.

## Text-to-speech on Aiva daily summary (C2)

**Owner:** Carina `summary-generator.ts` + `summary-tts.ts`.

When `worker_config.summary.includeAudio` is true and `AIVA_DAILY_SUMMARY_ENABLED=true`, the daily cron:

1. Sends the text briefing to Telegram (existing).
2. Generates MP3 via Edge TTS (OpenAI fallback if configured).
3. Sends a voice note with `sendAudio` after the text message.

Configure via:

```http
POST /api/aiva/email/summary/config/{workerId}
{ "enabled": true, "includeAudio": true, "summarySchedule": "0 7 * * *" }
```

Cap: `AIVA_SUMMARY_TTS_MAX_CHARS` (default 1500) before synthesis.

**Scope:** Telegram only in Phase 1; WhatsApp TTS deferred.

## In-app webhook subscriptions (C3)

**Owner:** Propreneur `WebhookToolHandler`.

Tools: `webhook_subscribe`, `list_webhooks`, `delete_webhook`.

Example: Bank of England rate change webhook triggers an in-app Carina briefing when the external source POSTs to the returned URL. Delivery is to the subscribing user in-app (web channel), not automatically forwarded to Aiva unless configured separately.

## Propreneur to Carina event webhooks (C5)

**Owner:** Propreneur emits; Carina Aiva consumes (read-only Telegram notification).

| Side | Flag / config |
|------|----------------|
| Propreneur | `propreneur_event_webhooks` (tenant); settings `integrations.aiva.webhook_url`, `integrations.aiva.webhook_secret`, `integrations.aiva.worker_id` |
| Carina | `PROPREENEUR_EVENT_WEBHOOKS=true`, `PROPREENEUR_WEBHOOK_HMAC_SECRET` (shared with tenant secret) |

**Events (Phase 1):** `email_processed` after Propreneur `EmailProcessingPipeline` completes.

**Carina ingress:** `POST /api/aiva/webhooks/propreneur` with header `X-Propreneur-Signature: sha256=...`

**Explicit SKIP:** No auto-writes to Propreneur from these events (see prompt 06).

## Intentional split

| Direction | Capability |
|-----------|------------|
| Voice in | Propreneur in-app + mobile |
| Voice out (briefings) | Carina Aiva Telegram |
| Events in (external) | Propreneur webhook_subscribe |
| Events out (tenant ops) | Propreneur to Carina optional webhooks |
