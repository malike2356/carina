# Phase 3 - Messaging Gateways

**Status: COMPLETE**

All deliverables built by Cursor. Do not rebuild.

## What Was Built

- `src/gateway/router.ts` - `GatewayRouter`: maps source+externalUserId to stable sessionId via Redis (in-memory fallback); holds `CarinaOrchestrator` per session; `handle()` yields string chunks; `recall()` and `clearSession()`
- `src/gateway/commands.ts` - `handleGatewayCommand` (sync: `/provider`, `/help`) and `handleGatewayCommandAsync` (async: `/memories`, `/memories delete <id>`)
- `src/gateway/cli.ts` - full CLI with streaming, `/recall`, `/skills`, `/clear`, `/memories`, tool confirmation prompt
- `src/gateway/telegram.ts` - polling/webhook mode; streaming via edit-based approach (edits every 1s); splits messages >4096 chars; routes `/start` locally; routes `/help`, `/provider`, `/memories`, `/clear` through `handleGatewayCommandAsync` (fixed in this review session)
- `src/gateway/whatsapp.ts` - Twilio signature verification; collects full response (WhatsApp no streaming); saves media attachments to `data/`; splits >1600 chars across messages
- `src/gateway/web.ts` - Express; CORS headers (fixed in this review session); rate limit 30 req/min on `/api/chat` (fixed in this review session); `POST /api/chat` (non-streaming); `GET /api/chat/stream` (SSE, `data: [DONE]`); `POST /api/clear`; mounts email and WhatsApp webhooks; mounts hosted auth routes
- `src/gateway/web/index.html` - 347-line self-contained chat UI; SSE streaming; localStorage session ID; provider badge
- `src/api/email-webhook.ts` - saves Resend inbound payloads to `inbound_emails`
