# Channel Completion Checklist

**File:** `src/gateway/channels/catalog-channel-specs.ts`  
**Status:** Complete (2026-06-16)  
**Adapter implementation:** `src/gateway/channels/adapters/catalog-stub-adapters.ts` + per-channel `*-adapter.ts` re-exports

All 20 former stub channels now have full `ChannelAdapter` implementations: inbound webhook parsing, outbound API delivery, webhook validation where applicable, and gateway registration via `channel-bootstrap.ts`.

IRC was already implemented (`irc-adapter.ts` + live client); it is no longer listed as a catalog stub.

---

## Live catalog channels (31 total in catalog)

Includes push-only (ntfy, pushover, gotify), Meta Graph (messenger, instagram), and full webhook/API adapters below.

| Channel | Transport | Adapter file |
|---------|-----------|--------------|
| zulip | zulip-bot-api | `zulip-adapter.ts` |
| reddit | reddit-webhook-bridge | `reddit-adapter.ts` |
| bluesky | bluesky-atproto | `bluesky-adapter.ts` |
| skype | skype-bot-framework | `skype-adapter.ts` |
| pumble | pumble-webhook | `pumble-adapter.ts` |
| twist | twist-api | `twist-adapter.ts` |
| ryver | ryver-webhook | `ryver-adapter.ts` |
| workplace | workplace-graph-webhook | `workplace-adapter.ts` |
| naver-works | naver-works-bot-api | `naver-works-adapter.ts` |
| qq | qq-bot-api | `qq-adapter.ts` |
| weibo | weibo-open-api | `weibo-adapter.ts` |
| openhab | openhab-notifications | `openhab-adapter.ts` |
| synology-chat | synology-chat-webhook | `synology-chat-adapter.ts` |
| gitter | gitter-api | `gitter-adapter.ts` |
| element | element-webhook-bridge | `element-adapter.ts` |
| mastodon | mastodon-rest-api | `mastodon-adapter.ts` |
| snapchat | snapchat-webhook | `snapchat-adapter.ts` |
| bridge-generic | bridge-generic-webhook | `bridge-generic-adapter.ts` |
| apple-business-chat | abc-messages-api | `apple-business-chat-adapter.ts` |

Plus previously live catalog channels: rocketchat, twitch, nextcloud-talk, groupme, linkedin, threema, kakaotalk, keybase, wire, zalo, webex, youtube, twitter.

---

## IRC (non-catalog, live)

| Channel | Transport | Webhook | Env |
|---------|-----------|---------|-----|
| irc | irc-bot / webhook-inbound | `/webhooks/irc` | `IRC_SERVER`, `IRC_CHANNEL`, `IRC_NICK` |

---

## Env vars (former stubs)

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
| bridge-generic | /webhooks/bridge (+ /webhooks/bridge-generic) | BRIDGE_CHANNEL_SECRET, BRIDGE_CHANNEL_ENABLED=true |
| apple-business-chat | /webhooks/apple-business-chat | ABC_MERCHANT_ID, ABC_API_KEY |

---

## Architecture

Shared modules:

- `catalog-webhook-base.ts` - `CatalogWebhookAdapter` (parse, send, validate, Express router)
- `catalog-webhook-parsers.ts` - platform inbound parsers
- `catalog-webhook-sends.ts` - platform outbound API calls
- `catalog-stub-adapters.ts` - registry + exported adapter classes

Registration:

1. Adapter class under `src/gateway/channels/adapters/<channel>-adapter.ts`
2. Registered in `channel-bootstrap.ts` via `STUB_CHANNEL_NAMES`
3. `CATALOG_STUB_CHANNELS` is empty; transports are no longer `webhook-stub`
4. Tests: `catalog-stub-adapters.test.ts` (221 channel tests pass)

---

## Verification

```bash
cd core.carinaai.uk
pnpm exec vitest run src/gateway/channels/
carina channels status   # when gateway is running
```
