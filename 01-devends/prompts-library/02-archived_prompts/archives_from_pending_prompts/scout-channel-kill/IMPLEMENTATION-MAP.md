# Scout channel kill prompt map

**Updated:** 2026-07-28  
**Scope:** map the prompt pack to the current Scout engine and console code paths

## Scope note

The Scout control surface is split across two runtime areas today:

- `carina/02-backends/scout-engine/` for engine-side control, event ingest, and admin APIs
- `carina/02-backends/console.labyrinthscout.com/` for the operator dashboard, webhook-adjacent APIs, and current kill or resume routes

This map keeps that split explicit. It does not assume the new channel-native controls already exist in one place.

## Prompt to implementation map

| Prompt | Existing files to anchor on | New or missing files to add | Tests to extend or create |
|---|---|---|---|
| `01-schema-and-control-api.md` | `carina/02-backends/scout-engine/src/control/instance-control.ts`<br>`carina/02-backends/scout-engine/src/api/admin.ts`<br>`carina/02-backends/scout-engine/src/db/migrate.ts`<br>`carina/02-backends/console.labyrinthscout.com/src/lib/instance-control.ts`<br>`carina/02-backends/console.labyrinthscout.com/src/api/kill.ts`<br>`carina/02-backends/console.labyrinthscout.com/src/api/resume.ts`<br>`carina/02-backends/console.labyrinthscout.com/src/api/quarantine.ts` | `carina/02-backends/scout-engine/src/db/migrations/010-channel-operator-links.sql`<br>`carina/02-backends/scout-engine/src/db/migrations/011-channel-control-events.sql`<br>`carina/02-backends/scout-engine/src/messaging/control.ts` or an equivalent shared control service<br>`carina/02-backends/scout-engine/src/api/internal/control.ts` or equivalent internal route mount | `carina/02-backends/console.labyrinthscout.com/src/api/__tests__/kill.test.ts`<br>`carina/02-backends/console.labyrinthscout.com/src/api/__tests__/quarantine.test.ts`<br>`carina/02-backends/console.labyrinthscout.com/src/api/__tests__/admin.test.ts`<br>new internal control API tests in `carina/02-backends/scout-engine/src/api/__tests__/` |
| `02-telegram-gateway.md` | `carina/02-backends/console.labyrinthscout.com/src/alerts/telegram.ts`<br>`carina/02-backends/console.labyrinthscout.com/src/actions/telegram-guidance.test.ts`<br>`carina/02-backends/console.labyrinthscout.com/src/lib/alert-channels.ts` | `carina/02-backends/scout-engine/src/api/webhooks/telegram.ts` or `carina/02-backends/scout-engine/src/messaging/telegram.ts`<br>nonce or confirm state storage tied to the shared control service | new Telegram webhook tests for secret token verification, linked operator lookup, confirm flow, and deny cases |
| `03-dashboard-channel-linking.md` | `carina/02-backends/console.labyrinthscout.com/src/api/alert-channels.ts`<br>`carina/02-backends/console.labyrinthscout.com/src/lib/alert-channels.ts`<br>`carina/02-backends/console.labyrinthscout.com/src/api/dashboard.ts`<br>`carina/02-backends/console.labyrinthscout.com/src/dashboard/widgets/response-terminal.ts`<br>`carina/02-backends/console.labyrinthscout.com/src/dashboard/widgets/incident-ops.ts`<br>`carina/02-backends/console.labyrinthscout.com/public/dashboard/js/widgets/kill-switch.js`<br>`carina/02-backends/console.labyrinthscout.com/public/dashboard/js/partials/kill-switch-markup.js` | dashboard channel-link settings surface for trusted operator channels, link-code creation, panic mode toggle, and revoke flow | `carina/02-backends/console.labyrinthscout.com/src/api/__tests__/dashboard.test.ts`<br>`carina/02-backends/console.labyrinthscout.com/src/api/__tests__/admin.test.ts`<br>`carina/02-backends/console.labyrinthscout.com/src/dashboard/__tests__/incident-ops.test.ts`<br>`carina/02-backends/console.labyrinthscout.com/src/dashboard/widgets/__tests__/defense-console.test.ts`<br>add channel-linking API tests if the routes move behind a dedicated module |
| `04-whatsapp-gateway.md` | `carina/02-backends/console.labyrinthscout.com/src/alerts/whatsapp.ts`<br>`carina/02-backends/console.labyrinthscout.com/src/lib/alert-channels.ts` | `carina/02-backends/scout-engine/src/api/webhooks/whatsapp.ts` or `carina/02-backends/scout-engine/src/messaging/whatsapp.ts`<br>signature verification and operator lookup for inbound control messages | new WhatsApp webhook tests for signature validation, link-code pairing, confirm flow, and unlinked deny cases |
| `05-e2e-and-docs.md` | `carina/02-backends/scout-engine/src/warden/scorer.test.ts`<br>`carina/02-backends/scout-engine/src/api/index.ts`<br>`carina/02-backends/scout-engine/src/api/openapi.yaml`<br>existing console kill and quarantine tests | `carina/02-backends/scout-engine/scripts/e2e-channel-kill.sh` or `carina/02-backends/console.labyrinthscout.com/scripts/e2e-channel-kill.sh` depending on which service owns the full flow<br>docs updates in the Scout engine and console READMEs | an e2e test path that proves link, confirm, audit, suspend, and resume behavior together |

## Current implementation reality

The prompt pack is ahead of the code for inbound channel control.

What already exists:

- Dashboard kill and resume routes
- Dashboard quarantine routes
- Control event logging for kill and resume in both engine and console code paths
- Alert channel configuration for outbound notifications

What is still missing for this prompt pack:

- Trusted inbound Telegram control handling
- Trusted inbound WhatsApp control handling
- Shared operator link schema and audit tables
- A single internal control service that both dashboard and channels call
- Dedicated e2e coverage for the channel-native flow

## Recommended implementation order

1. Add the shared control schema and service in the Scout engine
2. Refactor the current dashboard kill and resume paths to use that shared service
3. Add Telegram inbound control on top of the shared service
4. Add the dashboard channel-linking UX
5. Add WhatsApp only after Telegram is stable and green
6. Add the e2e script and update docs last

