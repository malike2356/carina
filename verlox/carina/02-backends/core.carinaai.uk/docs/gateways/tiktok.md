# TikTok Business Messaging (Aiva channel)

TikTok DMs for Aiva workers use the TikTok for Business Messaging API when your developer app is approved. Until then, OAuth connect stores credentials with `verified: false` and the worker UI shows a pending review state.

## Prerequisites

1. TikTok for Business account linked to a Business (not personal-only) profile.
2. TikTok Developer app with **Login Kit** enabled.
3. **Business Messaging API** product requested and approved (timeline varies by region; often days to weeks).
4. `TIKTOK_CLIENT_KEY` and `TIKTOK_CLIENT_SECRET` set on core (`core.carinaai.uk/.env`).

## OAuth scopes

Carina pins scopes in `tiktok-oauth.ts` (`TIKTOK_OAUTH_SCOPES`). At minimum:

- `user.info.basic` (Login Kit)

Add Business Messaging scopes in the developer portal when TikTok grants access, then update `TIKTOK_OAUTH_SCOPES` to match.

## Connect flow

1. Open the worker **Channels** tab and choose **TikTok**.
2. Click **Connect with TikTok** (redirects through `app.carinaai.uk` OAuth proxy).
3. On success, core stores encrypted `access_token`, `refresh_token`, `open_id`, and `expires_at`.
4. Channel remains `verified: false` until messaging API access is confirmed (`pendingReview: true` in OAuth callback).

## Inbound messages

**Webhook (preferred):** Register per-worker URL when TikTok allows:

```
https://core.carinaai.uk/api/aiva/channels/inbound/tiktok/{workerId}
```

Set `webhook_secret` on the channel row for HMAC verification (`tiktok-signature` header).

**Poll fallback:** If `webhook_registered` is not `true`, core runs `tiktok-poller` every 5 minutes, fetching messages since `last_polled_at` and routing them through the same approval inbox path as webhooks.

## Outbound messages

After you approve a draft in the social approval inbox, core calls the Business Messaging send endpoint (`TIKTOK_MESSAGING_API_VERSION` in `tiktok-messaging.ts`, currently `v1.3`).

## Token refresh

The hourly social token scheduler refreshes TikTok tokens using `refresh_token` before `expires_at`. On failure, the channel is marked unverified and a Scout `social_token_expired` event is emitted.

## Rate limits

The adapter backs off on HTTP 429 responses (up to two retries with increasing delay).

## Graceful degradation

- OAuth not configured: connect button returns 503; other channels are unaffected.
- App review pending: channel connects but stays unverified; poller and send no-op safely when API returns errors.
- Do not scrape the TikTok web UI; API only.

## Related code

- Adapter: `src/channels/adapters/tiktok-worker-adapter.ts`
- Messaging helpers: `src/ingestion/social/tiktok-messaging.ts`
- Poller: `src/ingestion/social/tiktok-poller.ts`
- OAuth: `src/ingestion/social/tiktok-oauth.ts`
- Setup overview: `docs/gateways/social-channel-setup.md`
