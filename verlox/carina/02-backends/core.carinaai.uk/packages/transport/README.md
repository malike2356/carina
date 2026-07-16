# @verlox/carina-transport

Shared outbound transport primitives used by Carina core gateway adapters and Labyrinth Scout alert delivery.

## Exports

| Function | Purpose |
|---|---|
| `sendDiscordWebhook` | POST plain-text or structured payloads to a Discord webhook URL |
| `sendTwilioSms` | Send SMS via Twilio REST API (fetch-based, no SDK required for send) |
| `buildTwilioBasicAuth` | Build Twilio Basic auth header |

## Consumers

- `core.carinaai.uk/src/gateway/channels/adapters/sms-adapter.ts` (outbound SMS)
- `console.labyrinthscout.com/src/alerts/discord.ts` (security alerts)
- `console.labyrinthscout.com/src/alerts/sms.ts` (security alerts)

Gateway adapters keep inbound parsing, formatting, and webhook validation. Scout keeps alert templates and severity routing. This package owns only the shared send primitives.
