# Scout Channel Kill -- Prompt 04 of 05: WhatsApp Gateway
# Depends on: Prompt 01, 02, 03 (Telegram proven)
# Blocks: Multi-channel sales claim
# Estimated time: 4-6 hours

## Task

### 1. Webhook

`POST /webhooks/whatsapp` verifying Meta/WhatsApp signature (`WHATSAPP_APP_SECRET`).

Env: `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET`, verify token for challenge.

### 2. Auth

Allowlist by E.164 in `channel_operator_links` (channel=`whatsapp`, channel_user_ref=phone).

Linking: dashboard generates code; user sends `LINK <code>` to the business number (document in UI).
Only linked operator numbers can issue control commands. Customer threads remain read-only.

### 3. Commands

Same vocabulary as Telegram: `KILL`, `/kill`, `STATUS`, `RESUME`, `PAUSE`, `SUSPEND`, `RESTRICT` (case-insensitive). Confirm via reply `CONFIRM` within 30s for kill/freeze/restrict.

### 4. Replies

Same audit id format in the WA message body.

## Acceptance Criteria

- Allowlisted number can kill org agents
- Unknown number ignored/denied
- Signature verification required
- Do not enable until Telegram e2e is green
- WhatsApp behavior matches CHANNEL-EMERGENCY-CONTROL.md

## Guidance

- Ship behind feature flag `SCOUT_WHATSAPP_ENABLED=true`
- Prefer Cloud API; no unofficial WhatsApp web scrapers

## Post-build

Mark COMPLETED; batch-archive after 05.
