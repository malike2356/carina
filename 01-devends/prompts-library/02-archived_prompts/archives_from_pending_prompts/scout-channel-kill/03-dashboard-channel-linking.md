# Scout Channel Kill -- Prompt 03 of 05: Dashboard Channel Linking
# Depends on: Prompt 01 (and ideally 02)
# Blocks: Real operator onboarding
# Estimated time: 3-4 hours

## Task

### 1. API

Under `/api/dashboard/channels`:

- `GET /` list links for org (mask tokens)
- `POST /telegram/link-code` -> create one-time code (5 min TTL) stored hashed
- `POST /whatsapp/link-code` -> create one-time code for phone pairing, hashed
- `POST /slack/link-code` -> create one-time code for Slack DM or private channel pairing, hashed
- `DELETE /:id` revoke link
- `PATCH /org-settings` panic_mode boolean (owner only)

Telegram `/start <code>` (prompt 02) consumes code and creates `channel_operator_links`.
WhatsApp and Slack consume equivalent one-time link codes from their own trusted channel flows.

### 2. UI

`scout-dashboard` Settings page section **Channels**:

- Show linked trusted operator channels (user ref masked)
- Button "Link Telegram" -> shows code + bot username from `NEXT_PUBLIC_SCOUT_TELEGRAM_BOT`
- Button "Link WhatsApp" -> shows code + phone pairing instructions
- Button "Link Slack" -> shows code + workspace or DM instructions
- Toggle "Panic mode (skip confirm on /kill)" with warning copy
- Revoke button

Copy must say: kill is for emergencies; resume is harder; do not share the bot chat; customer chats are never control channels.

### 3. Docs pointer

Link to `shared/security-assurance/programme/baseline/CHANNEL-EMERGENCY-CONTROL.md` from Settings help text (short).

## Acceptance Criteria

- Owner can generate code, link via bot, see link, revoke
- panic_mode persists on organization.settings
- No secrets in UI beyond one-time code
- Channel UI matches the shared control note
- No em dashes / emojis

## Post-build

Mark COMPLETED; batch-archive after 05.
