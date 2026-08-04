# Carina Remote API

**Last updated:** 2026-05-20

**Slack-specific guide and Marketplace build plan:** `docs/CARINA_SLACK_INTEGRATION.md`

## Overview

The Carina Remote API lets external systems and messaging platforms send messages to Carina and receive replies without the user being in the Propreneur web UI. Each tenant generates API keys and maps external user identities (e.g. a Telegram user ID or WhatsApp number) to their Propreneur user account. Supported delivery channels are HTTP (direct API call), Telegram, WhatsApp (both Baileys-bridge and Meta Cloud), Slack, email (Mailgun inbound), and a generic signed webhook.

## Key tables

All tables are in the tenant database.

| Table | Key columns |
|---|---|
| `carina_remote_api_keys` | `id`, `name`, `key_prefix` (12 chars, unique), `key_hash` (SHA-256), `abilities` (JSONB, default `["carina:chat"]`), `user_id` (nullable - pinned user), `is_active`, `last_used_at`, `expires_at` |
| `carina_remote_sessions` | `id`, `session_key` (64 chars, unique), `channel` (e.g. `telegram`, `whatsapp`, `http`), `external_id` (platform user ID), `conversation_id` (FK to `carina_conversations`), `user_id`, `api_key_id`, `pending_token`, `last_active_at` |
| `carina_remote_channel_mappings` | `id`, `channel`, `external_id`, `user_id`, `is_active`; unique on `(channel, external_id)` |

## Routes / entry points

| Route | Name | Description |
|---|---|---|
| `POST /api/remote/carina/chat` | `carina.remote.chat` | Direct HTTP chat - Bearer token auth via `carina.remote` middleware; throttled at `carina_remote_api` rate |
| `POST /api/remote/inbound/telegram` | `carina.remote.inbound.telegram` | Telegram bot webhook |
| `POST /api/remote/inbound/whatsapp-web` | `carina.remote.inbound.whatsapp_web` | WhatsApp Web (Baileys bridge) webhook |
| `GET/POST /api/remote/inbound/whatsapp` | `carina.remote.inbound.whatsapp` | WhatsApp Cloud API (Meta) - GET for verification, POST for messages |
| `POST /api/remote/inbound/slack` | `carina.remote.inbound.slack` | Slack Events API webhook |
| `POST /api/remote/inbound/email` | `carina.remote.inbound.email` | Mailgun inbound email webhook |
| `POST /api/remote/inbound/webhook` | `carina.remote.inbound.webhook` | Generic signed webhook |
| `GET /settings/carina-remote` | - | Tenant settings page - manage API keys and channel mappings |

## How it works

### Authentication

HTTP API requests must include an `Authorization: Bearer {key}` header. The `carina.remote` middleware looks up the key by prefix (`key_prefix`), hashes the full key with SHA-256, and compares against `key_hash`. The key must be `is_active` and not expired.

Channel webhooks (Telegram, WhatsApp, Slack, email, generic) each use their own verification:
- **Telegram**: `X-Telegram-Bot-Api-Secret-Token` header matched against `services.telegram.webhook_secret`
- **WhatsApp Cloud**: HMAC-SHA256 of the raw body using `services.whatsapp_cloud.app_secret`
- **Slack**: standard Slack signing secret verification
- **Email**: Mailgun signature check
- **Generic webhook**: HMAC-SHA256 signature in `X-Carina-Signature` header

### Message dispatch flow

1. A message arrives at one of the inbound routes. `CarinaRemoteInboundController` delegates to the appropriate `RemoteChannelAdapter`.
2. The adapter's `verify(Request $request)` validates the webhook signature and returns false if invalid.
3. The adapter's `parse(Request $request)` extracts `channel`, `externalId`, `message`, and `replyTarget` into a `RemoteChannelPayload`.
4. `CarinaRemoteGateway::dispatch()` is called with the channel, externalId, message text, and the resolved API key.
5. **User resolution**: If `externalId` is non-empty, the gateway looks up `carina_remote_channel_mappings` to find the mapped Propreneur user. If `externalId` is empty (HTTP API call without identity), it falls back to the API key's pinned `user_id`.
6. **Session resolution**: A `CarinaRemoteSession` is looked up or created using a `session_key` derived either from `clientSessionId` (HTTP) or `sha256("{channel}:{externalId}")`. Sessions expire after 4 hours of inactivity.
7. **Conversation**: The session's `conversation_id` is reused if present. Otherwise a new `CarinaConversation` of type `remote` is created.
8. `CarinaAgentService::agentChat()` processes the message and returns a reply.
9. If the agent requires confirmation (destructive action), Carina replies: "This action needs your approval. Log in to Propreneur and check Carina's pending actions." The `pending_token` is stored on the session.
10. `CarinaSecurityAuditLogger` records the dispatch event.
11. The adapter's `reply()` method sends the text reply back to the platform (e.g. `POST api.telegram.org/sendMessage`).

### Channel registry

`CarinaRemoteChannelRegistry` holds one adapter instance per channel:

| Slug | Adapter | Configured by |
|---|---|---|
| `http` | - (direct API) | Always configured |
| `telegram` | `TelegramChannelAdapter` | `services.telegram.bot_token` + `webhook_secret` |
| `whatsapp-web` | `WhatsAppWebChannelAdapter` | `services.whatsapp_web.*` |
| `whatsapp` | `WhatsAppCloudChannelAdapter` | `services.whatsapp_cloud.*` |
| `slack` | `SlackChannelAdapter` | `services.slack_remote.*` (`SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`) |
| `email` | `EmailChannelAdapter` | `services.mailgun.*` inbound |
| `webhook` | `GenericWebhookChannelAdapter` | `CARINA_REMOTE_WEBHOOK_SECRET` |

### Channel-to-key mapping

Each channel adapter can be assigned a specific API key via `CarinaRemoteChannelKeyResolver`. The setting is stored as `TenantSetting` with key `carina_remote_channel_key_{channel}` holding the `carina_remote_api_keys.id`. This allows using different API keys (and therefore different pinned users or abilities) per channel.

### User identity mapping

Admins map external IDs to Propreneur users via the settings UI, which writes rows to `carina_remote_channel_mappings`. Until a mapping exists, messages from that external ID are rejected (returns `CarinaRemoteResult::unauthorized`).

## Carina context

Carina should know that Remote API messages are treated as full `agentChat` calls - the same tools and context available in the web UI are available remotely, subject to the `abilities` on the API key (currently only `carina:chat` is defined). Actions requiring confirmation are blocked at the remote boundary; the user must approve them through the web UI.

Users may ask:
- "How do I connect Carina to WhatsApp?"
- "What is my Telegram external ID?"
- "Can Carina send me property updates on Slack?"
- "Why is Carina not responding on Telegram?"

Admin staff may ask:
- "How do I create a remote API key?"
- "How do I map a WhatsApp number to a user?"
- "What channels does the Remote API support?"
