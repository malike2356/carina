# Action: Multi-Channel Integration (Discord, Slack, SMS)

## Goal
Extend Carina beyond Telegram/WhatsApp/Web to Discord, Slack, and SMS by introducing a shared `IChannelAdapter` interface and refactoring the existing gateway adapters to implement it, fulfilling "Every channel, one agent."

## Context
- Spec file: `chat.carinaai.uk/prompts/phase2-gap-closure/01-carina-core-gaps/03-multi-channel.md`
- Project root: `/opt/lampp/htdocs/verlox/carina/core.carinaai.uk/`
- Existing channel code lives in `core.carinaai.uk/src/gateway/`:
  - `telegram.ts` (160 lines), `whatsapp.ts` (158 lines), `web.ts` (223 lines), `cli.ts` (149 lines), `router.ts` (127 lines), `commands.ts` (75 lines)
  - `grep -ril "discord\|slack\|twilio\|sms" src/gateway/*.ts` returns NOTHING; Discord, Slack and SMS are completely absent today
- `router.ts` is almost certainly the existing message-dispatch hub; read it first to understand how `telegram.ts`/`whatsapp.ts` currently plug in, since the new adapters must plug in the same way (or `router.ts` must be refactored to use the new `IChannelAdapter` interface uniformly).
- The gap: no `IChannelAdapter` interface exists yet; each channel (`telegram.ts`, `whatsapp.ts`, `web.ts`) has its own bespoke message-handling shape. The spec asks for a formal interface, a registry, and three brand-new adapters (Discord, Slack, SMS).
- Conventions: TypeScript strict, Node.js 18+, no emojis/em-dashes, every adapter gets a `*.test.ts`.

## Files to create
```
core.carinaai.uk/src/gateway/channels/
  channel-adapter.interface.ts; IChannelAdapter, ChannelMessage, SendOptions, Attachment types
  channel-registry.ts; Registry: register/getForInbound/getByName/listActive
  channel-formatter.ts; Platform-specific markdown/length formatting
  channel-capabilities.ts; supportsReactions/Embeds/Threading/maxMessageLength per channel
  adapters/
    discord-adapter.ts; discord.js bot, slash commands, embeds, reactions
    slack-adapter.ts; Slack Bolt, Socket Mode (dev) / HTTP (prod), threads, Block Kit
    sms-adapter.ts; Twilio inbound webhook + outbound Messages API
  channel-registry.test.ts
  channel-formatter.test.ts
  adapters/discord-adapter.test.ts
  adapters/slack-adapter.test.ts
  adapters/sms-adapter.test.ts
```

## Files to modify
- `core.carinaai.uk/src/gateway/telegram.ts`; wrap the existing implementation behind `IChannelAdapter` (rename internal handler to `parseInbound`/`sendMessage`/etc, do not rewrite the Telegram-specific logic itself)
- `core.carinaai.uk/src/gateway/whatsapp.ts`; same wrapping treatment
- `core.carinaai.uk/src/gateway/router.ts`; change dispatch to go through `ChannelRegistry.getForInbound()` instead of per-channel `if`/`switch` branches (read the current branching logic first; preserve its group-chat / @mention rules, just route them through the registry)
- `core.carinaai.uk/src/config/index.ts`; add config sections for `discord`, `slack`, `sms` (bot token, signing secret, Twilio SID/auth token; reference env var names only, never hardcode credentials)
- `package.json`; add `discord.js`, `@slack/bolt`, `twilio` (check first with `grep -E "discord.js|@slack/bolt|twilio" package.json` to avoid duplicate deps)

## Step-by-step
1. Read `src/gateway/router.ts` end to end; this defines today's dispatch contract. Note exactly what shape it expects from each channel handler.
2. Read `src/gateway/telegram.ts` and `src/gateway/whatsapp.ts` to see the current per-channel message shapes that must be normalized into `ChannelMessage`.
3. Create `channel-adapter.interface.ts` with the `IChannelAdapter` interface and `ChannelMessage` type exactly as specified (see spec lines 23-43 and 86-98), adding `Attachment` and `SendOptions` types referenced but not fully defined in the spec; infer their shape from how `telegram.ts` currently handles file/voice attachments.
4. Create `channel-registry.ts`: a `Map<string, IChannelAdapter>`-backed registry with `register`, `getForInbound(channel, raw)`, `getByName(name)`, `listActive()`.
5. Create `channel-capabilities.ts` and `channel-formatter.ts` per the spec's per-platform tables (Discord 2000 chars/embeds/reactions, Slack 3000 chars/threads/Block Kit, Telegram 4096 chars/no embeds, SMS 160 chars/plain text only).
6. Refactor `telegram.ts` to implement `IChannelAdapter`; wrap, do not rewrite, the existing bot logic.
7. Refactor `whatsapp.ts` the same way.
8. Build `discord-adapter.ts` using `discord.js`: register `/chat`, `/summary`, `/briefing`, `/help` slash commands; only respond in allowed channels/DMs or on `@mention`; wrap URLs in `<>`; split messages over 2000 chars.
9. Build `slack-adapter.ts` using `@slack/bolt`: Socket Mode for local dev (env-flagged), HTTP endpoints for production; thread-aware replies; Block Kit for structured briefings; 3000-char limit.
10. Build `sms-adapter.ts` using `twilio`: inbound webhook parses `req.body.Body`/`req.body.From`; outbound via Twilio Messages API; prefix every message with `"[Carina] "`; concatenate messages over 160 chars.
11. Update `router.ts` to dispatch via `ChannelRegistry.getForInbound(channel, raw)` and apply the spec's group-chat rule uniformly: respond only on direct @mention, slash command, or in an agent-specific channel; preserve whatever rule `telegram.ts` already enforces and apply it generically.
12. Add `discord`/`slack`/`sms` config sections to `src/config/index.ts` using env var names (`DISCORD_BOT_TOKEN`, `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`); never hardcode values.

## Expected behavior
- `@Carina hello` in a Discord server channel gets a response; casual banter without a mention is ignored
- `/carina summary` in Slack returns a Block Kit-formatted portfolio summary, threaded if invoked in a thread
- A text message to the configured Twilio number gets a `[Carina] ...` reply within 5 seconds
- `ChannelRegistry.listActive()` returns `['telegram', 'whatsapp', 'web', 'discord', 'slack', 'sms']` once all adapters are registered and configured

## Test
- `channel-registry.test.ts`: register/lookup/list behave correctly; `getForInbound` routes a raw Discord payload to the Discord adapter and a Twilio webhook payload to the SMS adapter
- `channel-formatter.test.ts`: verify per-platform truncation/splitting at the documented length limits
- `adapters/*.test.ts`: each adapter's `parseInbound` normalizes a representative raw payload into `ChannelMessage` correctly; `formatForChannel` respects platform formatting rules; `validateWebhook` rejects an unsigned/forged request
- Run `pnpm test -- channels` and confirm all pass
- Manual: invite the Discord bot to a test server, install the Slack app in a test workspace, send an SMS to the Twilio sandbox number; confirm responses per the spec's verification block

## Dependencies
- Read `router.ts`, `telegram.ts`, `whatsapp.ts` fully before writing the interface (Step 1-2); the interface must fit the existing dispatch contract, not invent a new one
- `discord.js`, `@slack/bolt`, `twilio` npm packages
- Bot tokens / signing secrets / Twilio credentials must be supplied via env vars by the user; do not fabricate or hardcode them
