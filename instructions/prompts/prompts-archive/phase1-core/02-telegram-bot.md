# Phase 1.2; Telegram Bot Verification

## Task
Verify and fix the Telegram bot integration. Glenn interacts with Carina via Telegram. Messages arrive through a webhook, get queued, and Carina responds through the agentic loop.

## Files involved
- app/Services/Telegram/TelegramBotService.php
- app/Http/Controllers/Api/TelegramWebhookController.php
- app/Jobs/ProcessTelegramMessage.php
- app/Services/Carina/CarinaTelegramAgent.php
- app/Console/Commands/RegisterTelegramWebhook.php
- app/Models/Tenant/TelegramChatId.php
- routes/api.php (telegram webhook route)

## What to verify

1. Webhook receives updates and returns 200 within 2 seconds
   - Test: curl the webhook endpoint with a valid Telegram update payload
   - Verify: response is {"ok": true} and returns in under 2 seconds
   - Verify: ProcessTelegramMessage job is dispatched to the queue

2. ProcessTelegramMessage processes messages
   - ChatId resolution: finds TelegramChatId, resolves User
   - Unknown user: sends welcome/linking message, does not process
   - Known user: processes message through CarinaTelegramAgent
   - Commands: /start, /summary, /properties, /help work
   - Voice: transcribes if CarinaSpeechTranscriptionService exists, skips gracefully if not

3. CarinaTelegramAgent uses correct persona
   - Loads telegram_persona prompt from brain/prompts/carina_extended/carina-assistant-prompts.php
   - Substitutes {property_context_from_database} with live data
   - Creates/finds CarinaConversation with channel='telegram'
   - Calls the agentic loop and returns formatted response

4. TelegramBotService sends messages correctly
   - sendMessage: text arrives on Telegram
   - sendAudio: audio file arrives on Telegram
   - sendDocument: file arrives on Telegram
   - getFile: returns correct download URL
   - Reads bot token from config('services.telegram.token')

5. RegisterTelegramWebhook command works
   - Test: php artisan telegram:register-webhook
   - Verify: calls setWebhook API with correct URL
   - Verify: returns success response

## Dependencies
- TELEGRAM_BOT_TOKEN must be set in .env
- TELEGRAM_WEBHOOK_URL must be set in .env
- Telegram bot must be created via @BotFather
- config/services.php must have telegram section
- Queue worker must be running for job processing

## Expected output
- User sends message to Telegram bot
- Bot responds within seconds
- Bot handles commands (/start, /summary) correctly
- Bot uses warm, direct tone matching the telegram_persona prompt
- Bot can reference the user's actual property portfolio

## Verification
```bash
php artisan telegram:register-webhook
# Send message to bot on Telegram
# Check laravel.log for job processing
# Run: php artisan queue:work --once --queue=telegram
# Verify bot response in Telegram
```
