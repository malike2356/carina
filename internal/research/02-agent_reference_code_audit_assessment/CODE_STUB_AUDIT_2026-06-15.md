# Carina Code Stub Audit

Date: 2026-06-15

## Scope

I scanned the live Carina product code under:

- `core.carinaai.uk/`
- `ops.carinaai.uk/`
- `console.labyrinthscout.com/`
- `carinaMobile/`
- `labyrinth-scout-sdk/`

I excluded:

- `node_modules/`
- build and dist output
- worktree mirrors under `.claude/`
- markdown docs and strategy notes
- tests that only stub `fetch`, env vars, or globals for isolation
- normal UI placeholders such as input hints, loading text, and empty-state copy

This report covers confirmed runtime stubs and adjacent partial implementations that should be surfaced for follow-up.

## Confirmed runtime stubs

### 1. IRC gateway adapter (resolved 2026-06-15)

- Files: `src/gateway/channels/adapters/irc-adapter.ts`, `irc-client.ts`
- Status: **Live TLS client** with reconnect, channel join, mention gating, webhook fallback (`IRC_LIVE=false`)

### 2. UK Land Registry tool (resolved 2026-06-15)

- Files: `packages/packs/property-uk/tools/land-registry.ts`, `land-registry-client.ts`
- Status: **Implemented** via PropertyData.co.uk (`title`, `freeholds`, `address-match-uprn`, `uprn-title`)
- Env: `LAND_REGISTRY_API_KEY` or fallback `PROPERTY_DATA_API_KEY`
- Note: Raw HM Land Registry Business Gateway SOAP remains deferred

### 3. n8n Carina API credential template still points at localhost by default

- File: `core.carinaai.uk/integrations/n8n-carina-node/credentials/CarinaApi.credentials.ts`
- Evidence: `default: 'http://localhost:3333'`
- Status: Developer template stub
- Impact: New n8n installs will default to a dev-only host unless the user overrides it
- Follow-up: Keep the placeholder, but make the setup flow loudly steer users to the real deployed host

### 4. Scout Discord adapter (resolved 2026-06-15)

- Files: `console.labyrinthscout.com/src/alerts/discord.ts`, `core.carinaai.uk/packages/transport/`
- Status: **Consolidated** via `@verlox/carina-transport` `sendDiscordWebhook`
- Scout retains templates and severity routing

### 5. Scout SMS adapter (resolved 2026-06-15)

- Files: `console.labyrinthscout.com/src/alerts/sms.ts`, `core.carinaai.uk/packages/transport/`
- Status: **Consolidated** via `@verlox/carina-transport` `sendTwilioSms`
- Core `sms-adapter.ts` outbound path also uses shared transport; Twilio SDK kept for webhook signature validation

## Adjacent placeholders and partials

These are not runtime stubs in the strict sense, but they are partial or placeholder-shaped and should be tracked separately.

- `core.carinaai.uk/docker/supervisor/carina-hub.conf`
  - Comment says to replace placeholder values or rely on `.env`
  - This is deployment scaffolding, not product logic

- `core.carinaai.uk/.env.example`
  - Contains placeholder Stripe prices and IRC sidecar notes
  - This is expected config scaffolding, not a code stub

- `core.carinaai.uk/packages/web/assets/web/ops/*`
  - Several tables render `Loading...` or `No ... yet`
  - These are normal empty states, not stubs

- `ops.carinaai.uk/views/settings.ejs`
  - Placeholder URLs and masked secret inputs are config UI, not unfinished functionality

- `core.carinaai.uk/apps/cloud/src/pages/*`
  - Inputs use placeholder text for onboarding and login
  - These are normal form hints, not stubs

## Findings by severity

### High

- ~~IRC gateway adapter is still stub-only~~ (live client shipped)
- ~~Land Registry tool is still stub-only~~ (PropertyData integration shipped)

### Medium

- n8n credential template defaults to localhost
- ~~Scout Discord transport is duplicated~~ (shared `@verlox/carina-transport`)
- ~~Scout SMS transport is duplicated~~ (shared `@verlox/carina-transport`)

## What I would do next

1. ~~Decide whether IRC is real enough to keep exposed~~ Live adapter enabled via `IRC_ENABLED=true`.
2. ~~Replace the Land Registry stub~~ Done (PropertyData-backed `land-registry-search`).
3. ~~Standardize the alert transport boundary~~ Done (`@verlox/carina-transport`).
4. Revisit the n8n credential defaults so first use does not point at localhost.

## Notes

The automated search returned many additional matches, but most were not stubs:

- user input placeholders
- loading states
- empty-state copy
- test doubles
- documentation warnings

I did not count those as stubs because they do not represent unfinished runtime behavior.

