# Scout Engine

Scout Engine runs the emergency control path for Carina and Scout. It owns the trusted operator channel flow, internal control API, and audit trail.

## Key docs

- [Channel kill switch design](./docs/CHANNEL-KILL-SWITCH-DESIGN.md)
- [Client integration](./docs/CLIENT-INTEGRATION.md)
- [Sales claims](./docs/SALES-CLAIMS.md)

## Emergency control channels

- Telegram: enabled when the bot token and webhook secret are configured
- WhatsApp: disabled by default; enable with `SCOUT_WHATSAPP_ENABLED=true`
- Dashboard: always available through the console

## Local development

- `pnpm dev`
- `pnpm test`
- `pnpm exec tsc --noEmit`
- `scripts/e2e-channel-kill.sh` for the channel kill flow smoke test
