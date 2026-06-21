# Phase 1.4; TTS Delivery Verification

## Task
Verify and fix the text-to-speech delivery system. Carina generates audio versions of briefings using Microsoft Edge TTS and delivers them via Telegram.

## Files involved
- app/Services/Ai/TextToSpeechService.php
- app/Services/Carina/CarinaScheduledAgentDelivery.php
- config/services.php (tts section)

## What to verify

1. TextToSpeechService generates valid audio
   - Test standalone: generate("Good morning. Your portfolio is looking healthy today.")
   - Verify: MP3 appears in storage/app/tts/ with correct filename (UUID.mp3)
   - Verify: audio plays correctly and voice is en-GB-SoniaNeural
   - Verify: cleanup() removes temp files after use

2. Text cleaning works
   - Strips markdown symbols (*, _, `, #)
   - Replaces bullet markers with commas
   - Truncates to 4000 characters max
   - Uses escapeshellarg() on ALL dynamic values

3. CarinaScheduledAgentDelivery delivers correctly
   - Text delivery: checks telegram_notifications_enabled, sends via sendMessage()
   - Audio delivery: checks telegram_audio_enabled, generates via TTS, sends via sendAudio()
   - Audio failure is caught, logged as warning, never rethrown
   - Caption includes "Daily briefing - {date}"

4. Integration with daily briefing
   - After daily-portfolio-summary task completes, delivery fires
   - If user has telegram_audio_enabled=true: they get both text and audio
   - If user has telegram_audio_enabled=false: they get text only

## Dependencies
- edge-tts Python CLI installed (pip3 install edge-tts)
- TTS_PROVIDER=edge and TTS_VOICE=en-GB-SoniaNeural in .env
- config/services.php has tts section
- TelegramBotService is functional
- User model has telegram_notifications_enabled, telegram_audio_enabled fields

## Expected output
- Text briefing delivered to Telegram
- Audio briefing (MP3) delivered to Telegram
- Audio file cleaned up after sending
- No crash if TTS fails (text still delivered)

## Verification
```bash
php artisan tinker
>>> app(App\Services\Ai\TextToSpeechService::class)->generate("Good morning.");
# Check storage/app/tts/ for MP3 file
# Play the MP3 to verify audio quality
```
