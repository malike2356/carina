# Channel setup

Step-by-step guides for enabling Carina gateway channels. See also per-channel docs under `docs/gateways/`.

## Web gateway

1. Start the web server: `carina web` (or `composer run dev` in a full stack).
2. Set `CARINA_OPS_TOKEN` (or run `carina doctor --deep --repair`).
3. Open the local URL printed by `carina web` (or your pinned `WEB_PORT`).
4. Optional: set `CARINA_WEB_PASSWORD` for browser login.

**Status:** complete

## CLI

1. Install Carina CLI globally or use `npx carina`.
2. Run `carina chat` or `carina gateway`.
3. Configure provider keys in `.env` (`DEEPSEEK_API_KEY`, etc.).

**Status:** complete

## Telegram

1. Create a bot via [@BotFather](https://t.me/BotFather); copy the token.
2. Set `TELEGRAM_BOT_TOKEN` in `.env`.
3. Enable polling or webhook per `docs/gateways/telegram.md`.
4. Restart gateway after `carina secrets reload`.

**Status:** complete (webhook mode needs public HTTPS URL)

## WhatsApp

1. Configure Meta Cloud API credentials (`WHATSAPP_*` env vars).
2. Follow `docs/gateways/whatsapp.md` for webhook verification.
3. Point webhook URL to your gateway `/api/whatsapp/webhook`.

**Status:** partial (requires Meta Business verification in production)

## Mobile pairing (phone node)

1. Enable node host: `CARINA_NODE_HOST_ENABLED=true`.
2. On desktop: `carina pair` (shows QR + LAN URI).
3. On mobile: scan QR or open `carina://pair?...` URI.
4. Optional: set `CARINA_PHONE_NODE_ID` to the paired node id for presence.
5. File access: dispatch `file.push` / `file.pull` via `/api/nodes/:id/command`.

**Status:** complete for pairing API; mobile shell app is deployment-specific

## ACP (IDE clients)

1. Set `CARINA_ACP_ENABLED=true`.
2. Restart web gateway.
3. IDE health: `GET /acp/ide/health`.
4. Optional auth: `CARINA_OPS_TOKEN` or `CARINA_WEB_PASSWORD`.

**Status:** complete

## Tenant-level channel toggles (hosted)

Use ops API:

```bash
curl -X PUT -H "Authorization: Bearer $CARINA_OPS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"channels":{"telegram":{"enabled":true}},"activeSkillPacks":["finance"]}' \
  http://localhost:<gateway-port>/api/ops/tenant-config/my-tenant
```

**Status:** complete for config persistence; enforcement at message ingress is partial per channel adapter

## Agent routing

Inbound messages resolve to an agent workspace using bindings in `~/.carina/agents.json`.

```bash
carina agents list --bindings
carina agents bind add work telegram
carina agents route --channel telegram --account default --explain
```

Precedence (highest wins): thread ownership, contact, peer, guild, team, account, channel, default.

**Status:** complete (CLI testable); configure during `carina onboard` or first `carina` run

## Messenger slash commands

After a channel is connected, users can type:

- `/help`, `/model`, `/provider`, `/new`, `/stop`, `/status`

Full reference: [Messaging gateway](../messaging-gateway.md).

## Cross-surface continuity

Set `CARINA_OPERATOR_SESSION=true` in `~/.carina/.env` to share one gateway session across CLI, web, TUI, and messengers.

## Remote access

Before exposing the gateway beyond localhost, read [Remote gateway access](./remote-access.md).

**Status:** complete
