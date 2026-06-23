# Telegram Gateway

Carina connects to Telegram via long polling when `TELEGRAM_BOT_TOKEN` is set.

## Setup

1. Open [@BotFather](https://t.me/BotFather), create a bot, copy the token.
2. Add to `.env`:

   ```
   TELEGRAM_BOT_TOKEN=123456:ABC-DEF...
   ```

3. Start Carina (`pnpm cli`, `carina`, or `pnpm dev`).
4. Find your bot in Telegram and send `/start`.

## Behaviour

- **Streaming** - Responses update the same message about every second until complete.
- **Long messages** - Text over 4096 characters is split into multiple messages automatically.
- **Commands** - `/help`, `/provider`, `/provider deepseek`, `/clear`, `/memories`, `/memories delete <id>` work like the CLI.
- **Session** - One persistent session per Telegram user id; memory survives bot restarts when Postgres is configured.

## Webhook mode

Set `TELEGRAM_WEBHOOK_URL` to your public HTTPS endpoint if you prefer webhooks over polling. The gateway must be reachable from Telegram servers.

## Limits

- No `/recall` or `/skills` on Telegram (CLI-only).
- Tool confirmation uses Telegram reply flow when a dangerous tool is proposed (same y/N semantics as CLI where supported).

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Telegram gateway skipped` at startup | Set `TELEGRAM_BOT_TOKEN` |
| Bot silent | Check token and restart Carina. If `TELEGRAM_WEBHOOK_URL` is set, it must point at **core** (`https://core.carinaai.uk/webhooks/telegram`), not `app.carinaai.uk` (that URL 404s). Or clear `TELEGRAM_WEBHOOK_URL` to use polling. |
| Rate limits from Telegram | Reduce message frequency; Carina batches edits during streaming |
