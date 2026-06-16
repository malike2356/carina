# Scout alert transport

Scout alert delivery uses `@verlox/carina-transport` for outbound Discord webhooks and Twilio SMS. Scout keeps alert-specific behavior in this directory.

## Boundary

| Surface | Location | Role |
|---------|----------|------|
| Shared transport | `core.carinaai.uk/packages/transport/` | `sendDiscordWebhook`, `sendTwilioSms` |
| Carina core channels | `core.carinaai.uk/src/gateway/channels/adapters/` | Inbound/outbound messaging for the agent |
| Scout alerts | `console.labyrinthscout.com/src/alerts/` | Security templates, severity routing, fan-out |

`discord.ts` and `sms.ts` here are thin wrappers: they resolve Scout env/channel config, format alert copy, then call the shared transport package.

## Dependency

Scout links the package locally:

```json
"@verlox/carina-transport": "file:../core.carinaai.uk/packages/transport"
```

Build transport before Scout:

```bash
cd ../core.carinaai.uk/packages/transport && pnpm build
cd ../../../console.labyrinthscout.com && npm install && npm run build
```

## Safe changes here

- Alert templates and severity routing (`templates.ts`, `routing.ts`)
- New Scout-only alert channels
- Env examples for Scout-prefixed credentials (`SCOUT_DISCORD_WEBHOOK_URL`, etc.)

## Do not duplicate

- Raw Discord webhook POST logic (use `sendDiscordWebhook`)
- Raw Twilio Messages API fetch logic (use `sendTwilioSms`)
