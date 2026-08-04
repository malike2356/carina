---
sidebar_position: 1
---

# Channel adapters

Gateways live under `src/gateway/`. Each channel implements `ChannelAdapter` in `channels/`.

**18 registered adapters** (enablement is config-dependent): `telegram`, `whatsapp`, `web`, `discord`, `slack`, `sms`, `signal`, `matrix`, `mattermost`, `dingtalk`, `feishu`, `wechat`, `imessage`, `email`, `homeassistant`, `api`, `webhooks`, `cli`.

WhatsApp supports Twilio and Baileys paths. See `src/cli/completion-metadata.ts` (`CHANNEL_NAMES`) for the canonical list.

## Bootstrap

`channel-bootstrap.ts` registers adapters and mounts webhook routes (for example `/webhooks/*`).

## Adding a channel

1. Create `src/gateway/channels/<name>-adapter.ts`
2. Register in `channel-bootstrap.ts` and `channel-registry.ts`
3. Add env vars to `.env.example`
4. Add `carina channels setup <name>` guide
5. Add Vitest adapter tests

## Per-platform toolsets

The gateway passes `platform: <channel>` to `CarinaOrchestrator`. Tool availability is filtered via `~/.carina/toolsets.yaml` presets (see [Toolsets](/docs/developer/tools/toolsets)).

Outbound formatting: `src/gateway/formatting.ts` enforces per-platform length and markdown rules.
