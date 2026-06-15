# Action: Telegram Gateway Verification (Standalone Carina)

## Goal
Verify and fix Carina's Telegram gateway so users can chat with Carina through Telegram with correct streaming, command handling, session management, and webhook/polling startup.

## Context
- Project: `core.carinaai.uk`. Node.js 22 + TypeScript 5, ESM imports (`.js` specifiers), pnpm, Vitest.
- This is NOT Propreneur's PHP Telegram integration (`TelegramBotService.php`, `CarinaTelegramAgent.php`, queue jobs). The original spec described a Laravel queue-based webhook flow with persona prompts and portfolio-aware replies - none of that applies here. Standalone Carina's Telegram gateway is a single self-contained file using `node-telegram-bot-api`, already wired into the shared gateway router.
- The real, existing implementation is `src/gateway/telegram.ts` (160 lines) - read it in full before making any changes. It already implements:
  - `startTelegram()`: reads `config.telegram.botToken` / `config.telegram.webhookUrl`, chooses polling vs webhook mode, registers a `bot.on('message', ...)` handler
  - `splitMessage()` / `sendLong()`: chunk long replies to Telegram's 4096-char limit
  - `streamToTelegram()`: live-edits a single sent message as the agent streams tokens, throttled to one edit per second (`EDIT_INTERVAL_MS`)
  - `handleTelegramCommand()`: handles `/start` only; `/clear`, `/provider`, `/help`, `/memories` are routed through `handleGatewayCommand(Async)` from `src/gateway/commands.ts`
  - Session resolution via `getRouter().getSession('telegram', userId)` and `router.handle(carinaMsg)` (an async generator yielding text chunks)
- Related files to read: `src/gateway/commands.ts` (`handleGatewayCommand`/`handleGatewayCommandAsync` return `{handled, reply}`), `src/gateway/router.ts` (`GatewayRouter.getSession`, `.clearSession`, `.handle` - an async generator), `src/config/index.ts` (`config.telegram`), `src/types/index.ts` (`CarinaMessage`)
- Conventions: no comments unless explaining non-obvious WHY, Vitest, no em dashes/emojis, functions under ~20 lines.

## Files to verify / fix
- `src/gateway/telegram.ts`
- New: `src/gateway/telegram.test.ts` (does not exist - create it; every other gateway/tool file with logic worth testing has a sibling `.test.ts`)

## Step-by-step

1. Read `src/gateway/telegram.ts` fully and trace one message end-to-end: webhook/poll receives `msg` -> command check -> `handleGatewayCommandAsync` -> session resolution -> `streamToTelegram`. Confirm there are no gaps (e.g. unhandled promise rejections inside `bot.on('message', ...)` beyond the existing `try/catch` around `streamToTelegram`).

2. Verify `streamToTelegram()` against Telegram's actual API limits:
   - `editMessageText` fails (400 `message is not modified`) when the new text equals the old text - confirm the `try { ... } catch { /* ignore */ }` swallows exactly this and not genuine errors you'd want surfaced (e.g. bot kicked from chat, rate-limited beyond recovery).
   - Telegram rate-limits `editMessageText` to roughly 1/sec per chat - confirm `EDIT_INTERVAL_MS = 1000` is not too aggressive in practice; consider whether Telegram's documented guidance (avoid editing more than ~20x/minute in groups) matters for this bot's usage pattern (1:1 chats vs groups).
   - Confirm the final `flushEdit()` after the loop ends actually sends the last chunk - trace what happens if `fullText` is empty (e.g. agent produced zero output) - does the user see `'...'` forever, or does something clean that up?

3. Verify `handleTelegramCommand()` vs `handleGatewayCommand(Async)` ordering and overlap:
   - `/start` is handled locally with `WELCOME`. `/clear` is handled twice - once inline in `startTelegram()` (`if (text === '/clear') { router.clearSession... }`) and the shared `handleGatewayCommandAsync` may also recognize `/clear`/`/memories`. Read `commands.ts` to determine whether `/clear` is double-handled (the async command check runs BEFORE the inline `/clear` check - confirm the async one returns `{handled: false}` for `/clear` so the inline handler is reached, otherwise the inline branch is dead code).
   - Confirm `/help` and `/provider` (handled by `handleGatewayCommand`, the sync one) are actually reachable - `telegram.ts` only calls `handleGatewayCommandAsync`, never the sync `handleGatewayCommand`. Check whether `handleGatewayCommandAsync` internally delegates to the sync one for non-async commands (read `commands.ts` lines ~39-74). If it does not, `/help` and `/provider` are silently broken in the Telegram gateway - this is exactly the kind of bug this verification pass exists to catch.

4. Verify webhook vs polling mode selection:
   - `useWebhook = Boolean(config.telegram.webhookUrl)`. When true, `bot.setWebHook(...)` is called but there is no Express route registered anywhere to actually receive Telegram's POSTed updates (compare with `src/api/email-webhook.ts`, which has a real router). Search `src/index.ts` and `src/gateway/router.ts` for a Telegram webhook route (e.g. `/telegram/webhook` or `/api/telegram`). If none exists, **webhook mode is broken**: `setWebHook` tells Telegram to POST updates to a URL that nothing handles, while `bot.on('message', ...)` (which only fires in polling mode, or when you manually feed `bot.processUpdate()`) never receives them. This is the most likely root cause if anyone reports "the bot doesn't respond when `TELEGRAM_WEBHOOK_URL` is set."
   - If this gap is confirmed, fix it: either (a) register an Express route that calls `bot.processUpdate(req.body)` when in webhook mode, or (b) remove `webhookUrl` from `config.telegram` and document that this gateway only supports polling (the simpler, more honest fix if no one needs webhook mode for a single self-hosted instance). Pick (a) only if `TELEGRAM_WEBHOOK_URL` is actually set anywhere in deployment configs (`grep -r TELEGRAM_WEBHOOK_URL` across `.env*`, `docker-compose*.yml`, `deploy.sh`); otherwise prefer (b) to avoid shipping a half-wired feature.

5. Verify error handling in `bot.on('message', ...)`:
   - `if (!msg.text || !msg.from) return;` silently drops voice messages, photos, documents, stickers. Confirm this is intentional for Phase 1 (the spec mentions voice transcription as a "skip gracefully if not present" feature - standalone Carina has no transcription service, so silent drop is probably correct, but it should not look like a bug to a user who sends a voice note and gets no reply at all). Consider whether a one-line "I can only read text messages right now" reply is worth adding - if you add it, keep it to one line and do not build transcription infrastructure (out of scope).

6. Confirm `startTelegram()` is actually invoked at startup. Search `src/index.ts` for `startTelegram` and confirm it's awaited/called and that a missing `TELEGRAM_BOT_TOKEN` produces the warned-and-skipped behavior (`console.warn(... 'Telegram gateway skipped...')`) without crashing the whole process.

7. Write `src/gateway/telegram.test.ts` (Vitest):
   - Mock `node-telegram-bot-api` (the constructor and `sendMessage`/`editMessageText`/`setWebHook`/`sendChatAction` methods), `getRouter`, and `handleGatewayCommandAsync`.
   - Test `splitMessage` chunks correctly at the 4096 boundary (exact-length input, input one char over, empty input).
   - Test `streamToTelegram` sends an initial message on the first chunk, then edits on subsequent chunks respecting the 1-second throttle (use `vi.useFakeTimers()`), and sends overflow as additional messages when `fullText.length > TELEGRAM_MAX`.
   - Test `handleTelegramCommand` returns `true` and sends `WELCOME` for `/start`, returns `false` for anything else.
   - If you changed webhook handling in step 4, test the new route/behavior.

## Expected behavior
- A Telegram user sends a text message; Carina streams a live-updating reply within the chunk/throttle limits described above.
- `/start`, `/clear`, `/help`, `/provider` all work from Telegram (verify `/help` and `/provider` specifically - they are the most likely to be silently broken per step 3).
- Polling mode works out of the box with just `TELEGRAM_BOT_TOKEN` set. Webhook mode either works end-to-end or has been removed/documented as unsupported - it must not be left in its current half-wired state.
- Non-text messages (voice, photos) do not cause errors or hangs.

## Test
```bash
cd core.carinaai.uk
pnpm vitest run src/gateway/telegram.test.ts
pnpm test
pnpm build
```
Manual check (requires `TELEGRAM_BOT_TOKEN` from @BotFather):
```bash
pnpm cli   # or pnpm dev, whichever starts the gateways
# Open the bot in Telegram, send: /start, then a normal question, then /help
# Confirm streaming edits appear, then settle on final text
```

## Dependencies
- `TELEGRAM_BOT_TOKEN` set in `.env` (create a bot via @BotFather if none exists)
- `getRouter()` must be initialized (`initRouter(memoryReady)` called before `startTelegram()` in `src/index.ts`)
- Redis/session store reachable if `GatewayRouter.getSession` depends on it (confirm in `router.ts`)
