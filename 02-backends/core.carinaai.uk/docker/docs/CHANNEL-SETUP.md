# Aiva channel setup

Webhook base URL: `https://core.carinaai.uk/api/channels/webhook/`

Set `CHANNEL_CREDENTIAL_KEY` on core (32-byte hex from `openssl rand -hex 32`) before saving channel credentials in the portal.

## WhatsApp Business API

1. Create a Meta Business app and add the WhatsApp product.
2. Verify a phone number and note the Phone Number ID.
3. Webhook URL: `https://core.carinaai.uk/api/channels/webhook/whatsapp`
4. Verify token: value of `WHATSAPP_WEBHOOK_VERIFY_TOKEN` in core env.
5. Subscribe to `messages`.
6. In the portal Channels tab (or `POST /api/channels`), save:
   - `phone_number_id` as routing identifier
   - credentials: `access_token`, `phone_number_id`, optional `app_secret`
7. Set `WHATSAPP_APP_SECRET` on core for signature verification (v1 single Meta app).

### 24-hour messaging window

WhatsApp only allows free-form replies within 24 hours of the client's last message. After that, only approved template messages can be sent.

VERLOX v1 does not send template messages. When the 24-hour window expires:

1. Outbound send fails with Meta error code `131047`.
2. Core creates an escalation for the VA team with reason "24-hour reply window expired".
3. Scout receives a `channel_window_expired` signal.

The VA team should follow up with the client by email or phone. The client can also send a new WhatsApp message to reopen the window.

## Email (Postmark inbound + Resend outbound)

1. Configure Postmark inbound for `mail.carinaai.uk` (MX record: `mail.carinaai.uk MX 10 inbound.postmarkapp.com`).
2. Inbound webhook: `https://core.carinaai.uk/api/channels/webhook/email`
3. Set `POSTMARK_INBOUND_WEBHOOK_TOKEN` on core; Postmark sends it as `X-Postmark-Inbound-Token` (also accepts `X-Postmark-Token`).
4. Each Aiva gets `name-slug@mail.carinaai.uk` (auto-generated on channel create via `generateEmailSlug()`).
5. Outbound replies use Resend (`RESEND_API_KEY` must be configured) with `Reply-To` set to the Aiva address.
6. Thread continuity uses `In-Reply-To` and `References` headers on every reply.

Portal copy: "Your Aiva replies from your business email."

## Slack

1. Create a Slack app at api.slack.com.
2. Bot scopes: `app_mentions:read`, `chat:write`, `im:history`, `im:read`, `im:write`, `users:read`, `channels:history`, `groups:history`, `channels:read`, `groups:read`, `reactions:write`.
3. Event subscription URL: `https://core.carinaai.uk/api/channels/webhook/slack`
4. Subscribe to `message.im`, `message.channels`, `message.groups`, and `app_mention`.
5. Install to workspace; save `bot_token` and `team_id` in channel credentials.
6. Set `SLACK_SIGNING_SECRET` on core.
7. For ambient channel reading, set `CARINA_AMBIENT_MODE_ENABLED=true` on core (default off).
8. Optional per-channel controls: `/ambient on|off|status|quiet 4h` and `/carina channel-config mode thread|channel|ephemeral`.

## Telegram

1. Create a bot via @BotFather; copy the bot token.
2. Save token in channel credentials via `POST /api/channels`.
3. Core registers webhook: `/api/channels/webhook/telegram/:workerId`
4. Set `TELEGRAM_WEBHOOK_SECRET` on core (Telegram sends `X-Telegram-Bot-Api-Secret-Token`).

## Facebook Messenger

1. In Meta for Developers, create (or reuse) an app with the Messenger product, linked to your Facebook Page.
2. For OAuth in the portal, set on core: `META_APP_ID` and `META_APP_SECRET` (aliases: `FACEBOOK_APP_ID` / `FACEBOOK_APP_SECRET`).
3. Callback / redirect must match the app settings used by `resolveSocialOAuthRedirectUri` (typically `https://app.carinaai.uk/api/aiva/social/oauth/meta/callback` or the hireaiva equivalent).
4. Without OAuth env, connect manually in Channels with:
   - `page_id`
   - `page_access_token` (Page token with `pages_messaging`)
   - `verify_token` (any secret you also configure in Meta webhook verify)
5. Configure the Meta app webhook for Page messages to the URL your deploy exposes for Meta (core social / Messenger inbound). Subscribe to `messages`.

## SMS (Twilio)

1. Buy an SMS-capable Twilio number.
2. Messaging webhook POST: `https://core.carinaai.uk/api/channels/webhook/sms`
3. In the portal Channels tab, connect SMS with `account_sid`, `auth_token`, and `from_number` (E.164).

## Voice / phone call (Twilio PSTN)

Turn-based speech (Twilio `<Gather>` + Polly TTS). Not continuous Media Streams duplex yet.

1. Buy a **voice-capable** Twilio number (SMS numbers often work for voice too).
2. Twilio Console → Phone Numbers → Active numbers → your number → Voice configuration:
   - A call comes in: **Webhook**
   - URL: `https://core.carinaai.uk/api/channels/webhook/voice`
   - HTTP: **POST**
3. In the portal Channels tab, connect **Phone call (PSTN) / Voice** with:
   - `account_sid`
   - `auth_token`
   - `from_number` (same E.164 number)
4. **Inbound:** dial that number; speak after the greeting; Aiva replies and asks “Anything else?”
5. **Outbound:** Call tab → Dial a destination number. Core places the call with
   `?workerId=…&direction=outbound` so the answered leg routes to the correct Aiva.

Optional later: Twilio Media Streams for true duplex barge-in over PSTN.

## Web chat widget

1. Embed script (portal Channels tab) loads `GET /api/widget/:workerId/config`.
2. Visitor session: `POST /api/widget/:workerId/session`.
3. Messages: `POST /api/widget/:workerId/message` (SSE stream).
4. CORS is open only on `/api/widget/*`.
