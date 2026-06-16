# Channel Completion Checklist

**File:** `src/gateway/channels/catalog-channel-specs.ts`
**Date audited:** 15 June 2026

All 20 stub channels share the same pattern: catalog entry exists, env vars defined, webhook route reserved, but transport resolves to `webhook-stub`. Inbound webhook would be accepted but no actual adapter processes it.

---

## Done:  Live (16 channels)

| Channel | Transport | Status |
|---------|-----------|--------|
| telegram | telegram-bot-api | Live |
| whatsapp | baileys-web | Live |
| discord | discord-bot | Live |
| sms | sms-webhook | Live |
| web | express-session | Live |
| slack | slack-bolt | Live |
| signal | signal-bot | Live |
| matrix | matrix-bot | Live |
| rocketchat | rocketchat-webhook | Live |
| kakaotalk | kakaotalk-skill | Live |
| threema | threema-gateway | Live |
| keybase | keybase-bot-poll | Live |
| twitch | twitch-eventsub | Live |
| groupme | groupme-callback | Live |
| nextcloud-talk | nextcloud-talk-webhook | Live |
| linkedin | linkedin-messaging-webhook | Live |

## Done:  Push-only (3 channels)

| Channel | Transport | Status |
|---------|-----------|--------|
| ntfy | push-api | Live |
| pushover | push-api | Live |
| gotify | push-api | Live |

## Done:  Meta Graph (2 channels)

| Channel | Transport | Status |
|---------|-----------|--------|
| messenger | meta-graph-webhook | Live |
| instagram | meta-graph-webhook | Live |

## Failed:  Stubs; need adapters (20 channels)

| Channel | Webhook Route | Env Vars Needed |
|---------|--------------|-----------------|
| irc | /webhooks/irc | IRC_SERVER, IRC_CHANNEL, IRC_NICK |
| zulip | /webhooks/zulip | ZULIP_BOT_EMAIL, ZULIP_API_KEY, ZULIP_SITE |
| reddit | /webhooks/reddit | REDDIT_WEBHOOK_SECRET |
| bluesky | /webhooks/bluesky | BLUESKY_HANDLE, BLUESKY_APP_PASSWORD |
| skype | /webhooks/skype | SKYPE_APP_ID, SKYPE_APP_SECRET |
| pumble | /webhooks/pumble | PUMBLE_WEBHOOK_URL |
| twist | /webhooks/twist | TWIST_INTEGRATION_TOKEN |
| ryver | /webhooks/ryver | RYVER_WEBHOOK_URL |
| workplace | /webhooks/workplace | WORKPLACE_APP_SECRET, WORKPLACE_VERIFY_TOKEN |
| naver-works | /webhooks/naver-works | NAVER_WORKS_BOT_ID, NAVER_WORKS_BOT_SECRET |
| qq | /webhooks/qq | QQ_BOT_APP_ID, QQ_BOT_TOKEN |
| weibo | /webhooks/weibo | WEIBO_APP_KEY, WEIBO_APP_SECRET |
| openhab | /webhooks/openhab | OPENHAB_URL, OPENHAB_TOKEN |
| synology-chat | /webhooks/synology-chat | SYNOLOGY_CHAT_TOKEN |
| gitter | /webhooks/gitter | GITTER_TOKEN |
| element | /webhooks/element | ELEMENT_WEBHOOK_URL |
| mastodon | /webhooks/mastodon | MASTODON_INSTANCE, MASTODON_ACCESS_TOKEN |
| snapchat | /webhooks/snapchat | SNAPCHAT_WEBHOOK_SECRET |
| bridge-generic | /webhooks/bridge | BRIDGE_CHANNEL_SECRET |
| apple-business-chat | /webhooks/apple-business-chat | ABC_MERCHANT_ID, ABC_API_KEY |

---

## To implement a stub channel

Each stub needs the same pattern as the existing adapters under `src/gateway/channels/adapters/`:

1. Create `src/gateway/channels/adapters/<channel>-adapter.ts`
2. Implement `ChannelAdapter` interface (init, sendMessage, close)
3. Register in `channel-registry.ts`
4. Remove from `CATALOG_STUB_CHANNELS` in `catalog-channel-specs.ts`
5. Add to `FULL_ADAPTER_CHANNELS`
6. Update transport function in `buildCatalogChannelSpecs()`
