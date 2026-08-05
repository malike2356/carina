# Phase 1.3; Daily Briefing Verification

## Task
Verify and fix the daily portfolio briefing task. Carina runs a scheduled task that compiles a morning briefing: portfolio summary, compliance status, arrears, and recent email activity.

## Files involved
- app/Services/Carina/CarinaScheduledAgentService.php
- app/Services/Carina/CarinaScheduledAgentDelivery.php
- app/Services/Ai/TextToSpeechService.php
- app/Services/Carina/ToolHandlers/PortfolioToolHandler.php
- app/Services/Carina/ToolHandlers/EmailToolHandler.php
- routes/console.php

## What to verify

1. daily-portfolio-summary task is registered
   - Check taskList() includes slug 'daily-portfolio-summary'
   - Verify prompt instructs Carina to call: get_portfolio_summary, get_compliance_items, get_rent_arrears, get_recent_email_activity
   - Verify max_steps is set to 8

2. Task runs end-to-end
   - Test: trigger manually via tinker
   - Verify: Carina calls all four tools
   - Verify: output is a formatted briefing with real data
   - Verify: briefing format matches: Rent / Maintenance / Compliance / Activity / Attention needed

3. Delivery triggers after task completion
   - Check runTask() has delivery hook for daily-portfolio-summary
   - Check CarinaScheduledAgentDelivery delivers text + audio
   - Audio is best-effort (does not crash if TTS fails)

4. TTS generates valid audio
   - Test: TextToSpeechService::generate("Test message")
   - Verify: MP3 file appears in storage/app/tts/
   - Verify: audio plays correctly
   - Verify: cleanup removes temp files after sending

5. Scheduler is registered
   - Check routes/console.php has daily-portfolio-summary scheduling
   - Verify schedule frequency and time window

## Dependencies
- edge-tts Python CLI must be installed (pip3 install edge-tts)
- TTS_PROVIDER and TTS_VOICE must be set in .env
- PortfolioToolHandler must have get_portfolio_summary
- EmailToolHandler must have get_recent_email_activity
- ComplianceToolHandler must have get_compliance_items
- TenancyToolHandler must have get_rent_arrears
- TelegramBotService must be functional for delivery

## Expected output
- Every morning at the configured time, Carina sends:
  - A text message with the portfolio briefing
  - An audio version of the same briefing
- Briefing includes real numbers from the database
- User can configure telegram_delivery_time and telegram_audio_enabled

## Verification
```bash
php artisan tinker
>>> $user = App\Models\Tenant\User::first();
>>> $service = app(App\Services\Carina\CarinaScheduledAgentService::class);
>>> $task = collect($service->taskList())->firstWhere('slug', 'daily-portfolio-summary');
>>> $result = $service->runTask($task, $user);
>>> echo $result;
```
