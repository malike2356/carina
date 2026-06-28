# SOP 021: Telegram Configuration
**Classification:** Internal VERLOX only. Do not share externally.
**Source:** Migrated from planning/operations/telegramConfiguration.md
**Last reviewed:** 2026-06-25

---

# Telegram configuration guide

Treat these as two separate Telegram integrations:

- **Carina:** inbound chat on Telegram (user talks to Aiva via Telegram)
- **Scout:** outbound Telegram alerts (operator receives security incident notifications)

Use one bot token per product unless you have a strong reason to reuse the same bot. Separate bots are cleaner.

---

## 1. Carina / Aiva Telegram communication

Carina (and Aiva workers) talk to users on Telegram through the gateway.

Set this in `core.carinaai.uk/.env` (or via Aiva worker channel settings in app.carinaai.uk):

```
TELEGRAM_BOT_TOKEN=123456:ABC-DEF...
# optional: webhook mode instead of polling
TELEGRAM_WEBHOOK_URL=https://your-public-url/telegram-webhook
```

Behavior:

- If `TELEGRAM_BOT_TOKEN` is set, Carina starts the Telegram gateway.
- Default is polling mode.
- If `TELEGRAM_WEBHOOK_URL` is set, it uses webhook mode instead.

What the user can do in Telegram:

- `/start`
- `/help`
- `/provider`
- `/clear`
- `/memories`

Carina replies in the chat thread and keeps one persistent session per Telegram user ID.

---

## 2. Scout Telegram alerts

Scout sends security incident alerts to Telegram.

Set this in `console.labyrinthscout.com/.env`:

```
SCOUT_TELEGRAM_BOT_TOKEN=123456:ABC-DEF...
SCOUT_TELEGRAM_CHAT_ID=-1001234567890
```

Notes:

- `SCOUT_TELEGRAM_CHAT_ID` is the target chat, group, or channel ID.
- If you want alerts in a group, add the bot to the group and use that group's chat ID.
- Scout sends critical or configured-severity alerts through Telegram when the alert channel is enabled.

Legacy aliases also work in Scout:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`

---

## 3. Recommended setup

Use:

- One bot for Carina / Aiva chat
- One bot for Scout alerts

That gives you cleaner separation and avoids cross-wiring the products.

---

## 4. Minimal local setup flow

1. Create a bot with @BotFather at https://t.me/BotFather
2. Copy the token into the relevant `.env` file (Carina core or Scout)
3. Start Carina and/or Scout
4. Send `/start` to the Carina bot to begin a session
5. Send a test alert in Scout if the alert channel is enabled

---

## 5. Production VPS restart after config changes

After editing env files on the VPS:

```bash
# Restart Carina (carina-web container handles the Telegram gateway)
cd ~/apps/core.carinaai.uk
docker compose -f docker-compose.prod.yml restart carina-web

# Restart Scout (if Scout alert channel changed)
cd ~/apps/console.labyrinthscout.com
docker compose -f docker-compose.prod.yml restart labyrinth-scout
```

For local dev: rebuild via pnpm then restart the process.

---

## 6. Common mistakes

- **Bot token missing:** Carina logs "Telegram gateway skipped"
- **Wrong chat ID in Scout:** alerts send nowhere (check with `npm run doctor` on Scout)
- **Bot not added to a group:** group alerts fail silently
- **Webhook mode without public HTTPS:** Telegram cannot reach Carina (use polling mode locally)
- **Mixing the Scout token and Carina token in the same .env:** works only if intentional, but easy to confuse later

---

## 7. If you want both to share the same bot

You can do it, but it is not recommended unless you need one identity across both products. If you do:

- Set Carina token in `TELEGRAM_BOT_TOKEN`
- Set Scout token to the same value in `SCOUT_TELEGRAM_BOT_TOKEN`

Operationally, separate bots are better.

---

## 8. Env blocks for common setups

### Local dev

```bash
# core.carinaai.uk/.env
TELEGRAM_BOT_TOKEN=your-carina-bot-token
# polling mode is default; no TELEGRAM_WEBHOOK_URL needed

# console.labyrinthscout.com/.env (only if running Scout locally)
SCOUT_TELEGRAM_BOT_TOKEN=your-scout-bot-token
SCOUT_TELEGRAM_CHAT_ID=your-personal-chat-id
```

### VPS production

```bash
# ~/apps/core.carinaai.uk/.env.docker.runtime
TELEGRAM_BOT_TOKEN=your-carina-bot-token
# webhook mode (recommended in production):
TELEGRAM_WEBHOOK_URL=https://core.carinaai.uk/telegram-webhook

# ~/apps/console.labyrinthscout.com/.env
SCOUT_TELEGRAM_BOT_TOKEN=your-scout-bot-token
SCOUT_TELEGRAM_CHAT_ID=-1001234567890  # ops group or personal chat
```

### Group chat alerts

Add the Scout bot to your Telegram group. Use the group's chat ID (negative integer, e.g. `-1001234567890`) as `SCOUT_TELEGRAM_CHAT_ID`.
