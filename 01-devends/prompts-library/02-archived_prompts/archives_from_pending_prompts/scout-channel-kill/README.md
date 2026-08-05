# Scout channel-native kill switch

**Updated:** 2026-07-28  
**Status:** COMPLETED  
**Design source of truth:** `/opt/lampp/htdocs/verlox/shared/security-assurance/programme/baseline/CHANNEL-EMERGENCY-CONTROL.md`

## Why

Dashboard-only kill is too slow for emergencies. Trusted operators must halt agents from Telegram, WhatsApp, Slack, or the web dashboard with authenticated commands and audit ids, without replacing live `console.labyrinthscout.com`.

## Execution order

| # | File | Outcome |
|---|------|---------|
| 01 | `01-schema-and-control-api.md` | Links, audit tables, control ladder, internal control API |
| 02 | `02-telegram-gateway.md` | Trusted Telegram control path with confirm flow |
| 03 | `03-dashboard-channel-linking.md` | Settings UX to link and manage trusted channels |
| 04 | `04-whatsapp-gateway.md` | WhatsApp inbound control path after Telegram is green |
| 05 | `05-e2e-and-docs.md` | Scripts, CLIENT-INTEGRATION update, sales-line gate |

See `IMPLEMENTATION-MAP.md` for the concrete Scout engine and console files that each prompt maps to.
See `BUILD-CHECKLIST.md` for the execution sequence I will follow in code.

## Rules

- No em dashes, en dashes, or emojis
- Do not cut over or modify live enterprise console deploy in this series
- Kill is easier than resume
- Trusted operator channels only; customer chats cannot trigger controls
- Never accept free-text kill from unknown chats
- Stripe/plans: kill via channel still requires plan killswitch feature (Monitor+)

## Post-build

Archived to `02-archived_prompts/archives_from_pending_prompts/scout-channel-kill/` after 01-05 were completed.
