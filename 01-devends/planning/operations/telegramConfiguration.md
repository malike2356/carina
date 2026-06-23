› guide me to configure telegram alerts and communication with scout and carina


Yes. Treat these as two separate Telegram integrations:

  - Carina: inbound chat on Telegram
  - Scout: outbound Telegram alerts

  Use one bot token per product unless you have a strong reason to reuse the same bot. Reusing the same bot is
  possible, but separate bots are cleaner.

  ## 1. Carina Telegram communication

  Carina talks to users on Telegram through its gateway.

  Set this in core.carinaai.uk/.env:

  TELEGRAM_BOT_TOKEN=123456:ABC-DEF...
  # optional, if you want webhook mode instead of polling
  TELEGRAM_WEBHOOK_URL=https://your-public-url/telegram-webhook

  Behavior:

  - if TELEGRAM_BOT_TOKEN is set, Carina starts the Telegram gateway
  - default is polling
  - if TELEGRAM_WEBHOOK_URL is set, it uses webhook mode

  What the user can do in Telegram:

  - /start
  - /help
  - /provider
  - /clear
  - /memories

  Carina also replies in the chat thread and keeps one persistent session per Telegram user id.

  ## 2. Scout Telegram alerts

  Scout sends incident alerts to Telegram.

  Set this in console.labyrinthscout.com/.env:

  SCOUT_TELEGRAM_BOT_TOKEN=123456:ABC-DEF...
  SCOUT_TELEGRAM_CHAT_ID=-1001234567890

  Notes:

  - SCOUT_TELEGRAM_CHAT_ID is the target chat, group, or channel id
  - if you want alerts in a group, add the bot to the group and use that group’s chat id
  - Scout will send critical or configured alerts through Telegram when the alert channel is enabled

  Legacy aliases also work in Scout:

  - TELEGRAM_BOT_TOKEN
  - TELEGRAM_CHAT_ID

  ## 3. Recommended setup

  Use:

  - one bot for Carina chat
  - one bot for Scout alerts

  That gives you cleaner separation and avoids cross-wiring the products.

  ## 4. Minimal local setup flow

  1. Create a bot with @BotFather (https://t.me/BotFather)
  2. Put the token into Carina or Scout .env
  3. Start Carina and/or Scout
  4. Send /start to the Carina bot
  5. Send a test alert in Scout if you have the alert channel enabled

  ## 5. Restart after config changes

  After editing env files:

  cd /opt/lampp/htdocs/verlox/carina/core.carinaai.uk && pnpm build
  cd /opt/lampp/htdocs/verlox/carina/console.labyrinthscout.com && pnpm build

  Then restart the running services on the VPS.

  ## 6. Common mistakes

  - Bot token missing: Carina logs Telegram gateway skipped
  - Wrong chat id in Scout: alerts send nowhere
  - Bot not added to a group: group alerts fail
  - Webhook mode without public HTTPS: Telegram cannot reach Carina
  - Mixing the Scout token and Carina token in the same .env: works only if you intend it, but it is easy to
    confuse later

  ## 7. If you want both to share the same bot

  You can do it, but I do not recommend it unless you need one identity across both products. If you do that,
  set:

  - Carina token in TELEGRAM_BOT_TOKEN
  - Scout token aliases to the same value or the same bot token in SCOUT_TELEGRAM_BOT_TOKEN

  But operationally, separate bots are better.

  If you want, I can give you the exact .env blocks for:

  - local dev
  - VPS production
  - group chat alerts
  - webhook mode

    
