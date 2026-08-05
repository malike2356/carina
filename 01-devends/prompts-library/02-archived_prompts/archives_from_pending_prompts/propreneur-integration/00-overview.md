# Carina <-> Propreneur Integration - Build Prompts

**Status: COMPLETED 2026-07-19**

**What was built:** Propreneur bridge tools, workspace binding UI, skill packs, and env/E2E checklists (verified already shipped).


Execute these prompts in order in Cursor. Each is self-contained and maps to one
coherent unit of work. All prompts target two local codebases:

- Carina core: `/opt/lampp/htdocs/verlox/carina/02-backends/core.carinaai.uk/`
- Propreneur v2: `/opt/lampp/htdocs/verlox/propreneur/propreneur-v2/`

**Updated:** 2026-06-28

Prompts 01-11 implemented. Prompt 08 skipped (shared `carina.remote` auth). Prompt 10 done in `app.carinaai.uk` (`PropreneurBindingPanel`). See `ENV-CHECKLIST.md` for deploy verification.

## What already exists (do not rebuild)

In Carina:
- `src/bridges/propreneur-bridge.ts` calls `/api/aiva-bridge/*` read/write endpoints
- `src/tools/propreneur-portfolio.ts` exposes those as agent tools
- `src/workers/worker-bridge-store.ts` stores per-worker Propreneur credentials
- `src/api/aiva-propreneur-webhook-api.ts` receives events FROM Propreneur

In Propreneur:
- `app/Services/Carina/Remote/` has the full Remote API (channels, gateway, registry)
- Channel adapters: Telegram, WhatsApp, Slack, Email, GenericWebhook
- Route `POST /api/remote/carina/chat` - Bearer token auth, full agent execution
- `app/Console/Commands/Carina/CompileSkillsCommand.php` - compiles local SKILL.md files

## What is missing (build these, in order)

| Prompt | What it builds | Status |
|---|---|---|
| 01 | Propreneur: CarinaHub channel adapter | Done |
| 02 | Propreneur: register CarinaHub adapter in registry | Done |
| 03 | Carina: `chatWithCarina` bridge function + type | Done |
| 04 | Carina: `propreneur-carina-chat` agent tool | Done |
| 05 | Carina: `propreneur-workspace` skill pack | Done |
| 06 | Propreneur: extend CompileSkillsCommand to pull Hub packs | Done |
| 07 | Hub: propreneur-reply webhook receiver | Done |
| 08 | Propreneur: aiva-bridge carina chat endpoint | Skipped (same auth as Remote API) |
| 09 | Propreneur: Skills Hub settings UI | Done (`/settings/carina-remote` > Skills Hub tab) |
| 10 | Carina: Connect Propreneur workspace UI | Done (`app.carinaai.uk` `PropreneurBindingPanel`) |
| 11 | Propreneur: CarinaHub outbound push service | Done |
| 12 | E2E test and env checklist | Done (`ENV-CHECKLIST.md`) |

## Integration map (after all prompts are done)

```
User types in Carina Standalone
  --> propreneur-carina-chat tool (Prompt 04)
      --> chatWithCarina() bridge (Prompt 03)
          --> POST https://{tenant}.propreneur.uk/api/remote/carina/chat
              --> CarinaRemoteGateway dispatches to CarinaAgentService
              --> Full tenant context, property tools, compliance, CRM
              <-- { reply, sessionId }
      <-- reply text
  <-- shown to user in Carina Standalone

Hub sends a skill invocation to Propreneur tenant
  --> POST https://{tenant}.propreneur.uk/api/remote/inbound/carina-hub (Prompt 01, 02)
      --> CarinaHubChannelAdapter verifies X-Carina-Hub-Key header
      --> CarinaRemoteGateway dispatches to CarinaAgentService
      --> POST back to Hub callback URL with reply (core.carinaai.uk/api/inbound/propreneur-reply)

Propreneur tenant's Carina gets Hub skill packs
  --> php artisan carina:compile-skills (Prompt 06)
      --> reads local resources/carina/skills/*.md
      --> fetches GET https://hub.carinaai.uk/api/packs/{slug} for subscribed packs
      --> merges into storage/app/carina/compiled-skills.json
```

## Deploy after each prompt

Carina: `cd /opt/lampp/htdocs/verlox/carina/02-backends/core.carinaai.uk && bash deploy.sh`
Propreneur: `cd /opt/lampp/htdocs/verlox/propreneur/propreneur-v2 && ./scripts/deploy-to-production.sh`
