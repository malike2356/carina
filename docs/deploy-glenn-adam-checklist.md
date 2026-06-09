# Glenn & Adam; Carina Extended Deployment Checklist

Last updated: 5 June 2026
Status: All code built Done: , this is ops-to-live

---

## Pre-flight: Server Readiness

- [ ] **PHP 8.3+** on production server (`php -v`; project requires >= 8.3)
- [ ] **Composer deps** installed (`composer install --no-dev --optimize-autoloader`)
- [ ] **Node/edge-tts** for TTS: `pip install edge-tts` on server
- [ ] **Laravel cache** cleared post-deploy: `php artisan optimize`
- [ ] **Queue worker** running (`php artisan queue:work` as systemd service)
- [ ] **Scheduler** running (`* * * * * php artisan schedule:run` in crontab)

---

## Database & Migrations

- [ ] Push code to production server
- [ ] Run tenant migrations:
  ```
  php artisan tenants:migrate --path=database/migrations/tenant
  ```
- [ ] Verify tables exist in tenant DBs: `email_ingestion_configs`, `email_processing_logs`, `telegram_chat_ids`, `floor_plans`, `boq_reports`
- [ ] Verify `users` table has `telegram_chat_id`, `telegram_notifications_enabled`, `telegram_audio_enabled` columns
- [ ] Verify `carina_conversations` table has `channel` column

---

## Glenn; Email Pipeline

- [ ] Open HestiaCP → Mail → create dedicated inbound mailbox (e.g. `carina@glenn-domain.com` or use existing)
- [ ] Get IMAP credentials (host, port 993, username, password)
- [ ] Log in to Glenn's workspace in Propreneur
- [ ] Go to Email Ingestion Config → add IMAP credentials
- [ ] Set `process_inbound_emails` to active
- [ ] Add cron for email processing (every 15 min):
  ```
  */15 * * * * php /path/to/artisan process:inbound-emails >> /var/log/carina-email.log 2>&1
  ```
- [ ] Send a test email to the mailbox
- [ ] Verify it appears in `email_processing_logs` with classification
- [ ] Verify the correct action handler fires (check `HandleRentStatement` etc.)

---

## Glenn; Telegram Bot

- [ ] Create a Telegram bot via @BotFather → get bot token
- [ ] Set webhook URL via command:
  ```
  php artisan register:telegram-webhook https://glenn-domain.com/api/telegram/webhook
  ```
- [ ] Verify webhook is live: visit `https://api.telegram.org/bot<TOKEN>/getWebhookInfo`
- [ ] Add Glenn's Telegram user to the bot (he sends /start)
- [ ] Store his `telegram_chat_id` in his user record
- [ ] Set `telegram_notifications_enabled = true`
- [ ] Send a test message via `TelegramBotService` → he should receive it
- [ ] Test two-way chat: Glenn sends message → bot processes → reply arrives

---

## Glenn; TTS (Text-to-Speech)

- [ ] Install edge-tts on server: `pip install edge-tts`
- [ ] Verify `edge-tts --list-voices` works (lists installed voices)
- [ ] Test TTS from command line: `php artisan tinker` → `app(TextToSpeechService::class)->synthesize('Hello Glenn, this is your daily briefing.')`
- [ ] Verify MP3 file is generated in `storage/app/tts-cache/`
- [ ] Test Telegram audio delivery: send him a voice message via bot
- [ ] Set `telegram_audio_enabled = true` in Glenn's user record

---

## Glenn; Daily Briefing

- [ ] Populate Glenn's workspace: add properties, tenancies, rent records, compliance certificates
- [ ] Add cron for daily briefing (e.g. 7:00 AM):
  ```
  0 7 * * * php /path/to/artisan carina:scheduled-agent --task=daily-portfolio-summary >> /var/log/carina-briefing.log 2>&1
  ```
- [ ] Manually trigger first briefing: `php artisan carina:scheduled-agent --task=daily-portfolio-summary`
- [ ] Verify Glenn receives Telegram message with portfolio summary + rents + compliance + email activity
- [ ] Verify audio version arrives as voice memo (if audio enabled)

---

## Adam; Floor Plan Pipeline

- [ ] Configure a vision-capable AI provider (OpenAI GPT-4V, Anthropic Claude Vision, or local)
  - [ ] Set API key in `.env` (`VISION_AI_PROVIDER=openai`, `VISION_AI_API_KEY=...`)
  - [ ] Verify `AiRouterService::routeVisionAnalysis()` routes to the right provider
- [ ] Upload a test floor plan: `POST /api/floor-plans/upload` with an image file
- [ ] Verify `AnalyseFloorPlan` job queues and processes
- [ ] Check `floor_plans` table; status should go: `pending` → `processing` → `completed`
- [ ] Verify extracted data: `property_type`, `extracted_rooms`, `overall_dimensions`, `structural_notes`
- [ ] Generate a BOQ: `POST /api/floor-plans/generate-boq` with `refurb_type`
- [ ] Verify `boq_reports` table has row with `grand_total`, `line_items`, `compliance_flags`
- [ ] Run comparison: `POST /api/floor-plans/compare` with two BOQ report IDs
- [ ] Verify comparison output with `preferred_scenario` and cost breakdown

---

## Adam; Carina Agent Integration

- [ ] Verify Adam can ask Carina: "analyse my floor plan at 123 High Street"
  - Carina calls `analyze_floor_plan` tool → returns status
- [ ] Verify: "what would it cost to refurbish 123 High Street as light refresh?"
  - Carina calls `generate_boq` → returns GBP total + breakdown
- [ ] Verify: "compare light refresh vs full refurb for 123 High Street"
  - Carina calls `compare_refurb_scenarios` → returns recommendation
- [ ] Verify compliance advisory fires automatically with each BOQ

---

## Mobile App

- [ ] Test `POST /api/mobile/v1/auth/login` with Glenn's/Adam's credentials → get token
- [ ] Test `POST /api/mobile/v1/chat/send` → Carina responds
- [ ] Test `POST /api/mobile/v1/chat/voice` → voice note processed
- [ ] Test `POST /api/mobile/v1/chat/image` → floor plan uploaded via mobile
- [ ] Test `GET /api/mobile/v1/briefing/latest` → returns daily briefing
- [ ] Test `GET /api/mobile/v1/briefing/audio` → returns TTS audio URL
- [ ] Test `GET /api/mobile/v1/compliance/status` → compliance dashboard
- [ ] Test `POST /api/mobile/v1/notifications/register` → push token stored

---

## Final Verification

- [ ] Both tenants can see their workspace dashboard
- [ ] Email pipeline is ingesting real mail
- [ ] Telegram two-way chat works for both
- [ ] Daily briefing arriving at 7 AM with audio
- [ ] Floor plan upload → BOQ → compliance works end-to-end
- [ ] Mobile API returns correct data for both tenants

---

## Known Gaps (Needs Product Decision)

| Gap | Impact | Options |
|-----|--------|---------|
| No tests | Risk of regression during updates | Add PHPUnit + Pest tests for critical paths |
| AI provider not configured | Vision + LLM calls fail | Set up Anthropic or OpenAI API key |
| BOQ pricing not calibrated | Estimates may be wrong | Run 3-5 real quotes alongside manual BOQs to tune |
| No error alerting | Failures go unnoticed | Add Sentry/Bugsnag or simple email on queue failures |
| No usage tracking | Can't bill accurately | Add tool-call counters per tenant |
