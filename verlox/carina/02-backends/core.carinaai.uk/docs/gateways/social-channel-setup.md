# AIVA social channel setup

Per-worker OAuth and inbound webhooks for LinkedIn, Meta (Messenger and Instagram), X (Twitter), and TikTok.

Production inbound base URL:

```
https://core.carinaai.uk/api/aiva/channels/inbound/{channel}/{workerId}
```

Replace `{channel}` with `linkedin`, `messenger`, `instagram`, or `twitter`. Replace `{workerId}` with the AIVA worker UUID from the admin UI.

## Environment variables (core)

Add to `core.carinaai.uk/.env`:

```
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=
META_APP_ID=
META_APP_SECRET=
TWITTER_API_KEY=
TWITTER_API_SECRET=
TWITTER_CONSUMER_SECRET=
TIKTOK_CLIENT_KEY=
TIKTOK_CLIENT_SECRET=
AIVA_APP_URL=https://app.carinaai.uk
AIVA_SOCIAL_OAUTH_REDIRECT_ORIGINS=https://app.carinaai.uk,https://admin.hireaiva.co.uk
```

OAuth callbacks are served by the app at `/api/aiva/social/oauth/{provider}/callback` and proxied to core.

## LinkedIn

1. Create a LinkedIn Developer app and add redirect URI:
   `https://app.carinaai.uk/api/aiva/social/oauth/linkedin/callback`
   (and `https://admin.hireaiva.co.uk/...` if using admin host).
2. Request scopes: `openid`, `profile`, `w_member_social` (add messaging scopes when approved).
3. Set `LINKEDIN_CLIENT_ID` and `LINKEDIN_CLIENT_SECRET` on core.
4. In the worker UI, open Channels and click **Connect LinkedIn**.
5. **Webhooks:** LinkedIn may allow only one app-level webhook URL. If so, register a fan-in URL:
   `https://core.carinaai.uk/api/aiva/channels/inbound/linkedin`
   and route by worker identifier in the payload. Per-worker URLs are attempted first; check core logs for `social_webhook_registered`.

## Meta (Messenger and Instagram)

1. Create a Meta app with Facebook Login and Messenger products.
2. Add OAuth redirect:
   `https://app.carinaai.uk/api/aiva/social/oauth/meta/callback`
3. Permissions: `pages_show_list`, `pages_messaging`, `instagram_manage_messages`, `pages_manage_metadata`.
4. Set `META_APP_ID` and `META_APP_SECRET` on core.
5. In the worker UI, click **Connect Meta**, authorize, then pick a Facebook Page in the modal.
6. Optional: enable Instagram on the same Page when an Instagram Business account is linked.
7. **Webhooks:** Meta subscribes the app to the Page automatically (`messages`, `messaging_postbacks`, `message_reads`). Configure the Meta app webhook URL to:
   `https://core.carinaai.uk/api/aiva/channels/inbound/messenger/{workerId}`
   Use the per-worker `verify_token` shown in the worker Channels tab (non-production) or stored encrypted in `ai_worker_channels`.

## X (Twitter)

1. Create a Twitter developer app with OAuth 1.0a user authentication enabled.
2. Callback URL:
   `https://app.carinaai.uk/api/aiva/social/oauth/twitter/callback`
3. Set `TWITTER_API_KEY`, `TWITTER_API_SECRET`, and `TWITTER_CONSUMER_SECRET` (webhook signing).
4. Connect from the worker UI; the app stores a short-lived OAuth 1.0a cookie during the flow.
5. **Account Activity / webhooks:** Register either:
   - Per worker: `https://core.carinaai.uk/api/aiva/channels/inbound/twitter/{workerId}`, or
   - Fan-in: `https://core.carinaai.uk/api/aiva/channels/inbound/twitter` with worker routing in the payload.
6. CRC GET challenges use `TWITTER_CONSUMER_SECRET`; inbound POSTs are HMAC-SHA256 verified.

## TikTok

See `docs/gateways/tiktok.md` for full setup.

1. Register TikTok Login Kit / Messaging API when available.
2. Set `TIKTOK_CLIENT_KEY` and `TIKTOK_CLIENT_SECRET`.
3. Connect from the worker UI; channel is stored with `verified: false` until TikTok app review completes.
4. Poll fallback runs every 5 minutes when webhooks are not registered.
5. Other channels are unaffected if TikTok is pending.

## Token refresh

Core runs an hourly scheduler (`startSocialTokenRefreshScheduler`) to refresh LinkedIn and TikTok tokens before expiry. On failure, the channel is marked unverified and a `social_token_expired` Scout event is emitted.

## Manual sandbox checks

| Platform | Test |
| --- | --- |
| Meta | Send a Messenger message to the connected Page; confirm inbound in worker activity |
| LinkedIn | Sandbox message or POST fixture to inbound URL |
| X | DM the bot account in dev; confirm CRC GET returns `response_token` |

## Related code

- OAuth API: `src/api/aiva-social-oauth-api.ts`
- Inbound: `src/api/aiva-channels-inbound-api.ts`
- App proxies: `app.carinaai.uk/src/app/api/aiva/social/oauth/**`
