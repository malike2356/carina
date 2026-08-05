# Scout Channel Kill -- Prompt 02 of 05: Telegram Gateway
# Depends on: Prompt 01
# Blocks: 03 linking UI, 05 e2e
# Estimated time: 4-5 hours

## Task

### 1. Webhook

`POST /webhooks/telegram` on scout-engine (raw/json as required by Bot API):

- Verify `X-Telegram-Bot-Api-Secret-Token` === `TELEGRAM_WEBHOOK_SECRET`
- Ignore non-message / non-callback updates safely

Env: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`

### 2. Auth

Resolve operator via `channel_operator_links` where channel=`telegram`, channel_user_ref=from.id, enabled, not revoked.

Unknown user: silent ignore or short "Not linked. Open Scout Settings -> Channels."

### 3. Commands

Implement per design doc:

- `/status`, `/help`
- `/pause`, `/suspend-channel`, `/quarantine`, `/restrict`
- `/freeze`, `/kill` (and aliases `/scout-stop`, `/halt`)
- `/resume`

For `/kill`, `/freeze`, and `/restrict`: send inline keyboard **CONFIRM** (callback_data with nonce, 30s TTL in Redis or memory). On confirm, call internal control action.

Org setting `panic_mode` (JSONB on organizations.settings): if true, skip confirm for `/kill` only.

### 4. Reply contract

On success:

```text
All 3 agents halted.
Audit: K-2026-07-28-001
```

On deny: short reason (`plan_limit`, `forbidden`, `not_linked`, `expired`, `ambiguous`).

### 5. Outbound alert hook (optional in this prompt)

If alert delivery already can hit Telegram, include a "Kill now" deep link/button that starts confirm flow. If too large, skip and note in What was built.

## Acceptance Criteria

- Linked operator can /kill with confirm and agents suspend
- Unlinked chat cannot kill
- Audit code returned in chat
- Webhook secret enforced
- Live console.labyrinthscout.com unchanged
- Telegram flow matches CHANNEL-EMERGENCY-CONTROL.md

## Guidance

- Keep gateway in `scout/scout-engine/src/messaging/`; do not add to Carina core in this prompt
- Prefer grammY or raw fetch to api.telegram.org; avoid heavy frameworks

## Post-build

Mark COMPLETED; batch-archive after 05.
