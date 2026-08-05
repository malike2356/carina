# Scout pilot readiness prompts
**Status: COMPLETED 2026-07-27**

**What was built:** Pilot readiness series executed; see sibling COMPLETED prompts


**Updated:** 2026-07-27  
**Status:** PENDING  
**Goal:** Make the isolated Scout SaaS under `/opt/lampp/htdocs/verlox/scout/` honest enough for a supervised external pilot on `console.labyrinthscout.com` (keep Carina Scout on the existing console stack until a later migration).

## Execution order (do not reorder)

| # | File | Depends on | Outcome |
|---|------|------------|---------|
| 01 | `01-kill-switch-enforcement.md` | nothing | Suspended agents cannot filter/events |
| 02 | `02-sdk-contract-and-governed-loop.md` | 01 | SDK matches `/v1`, kill-switch helper, example loop |
| 03 | `03-production-hosting-console.md` | 01 | Compose/Docker/proxy for console + API |
| 04 | `04-client-integration-runbook.md` | 02, 03 | Docs + dashboard onboarding URLs |
| 05 | `05-e2e-pilot-and-stripe-dry-run.md` | 02, 03, 04 | Automated happy path + Stripe test |

## Non-goals (explicit)

- Do **not** replace production Carina Scout / existing `console.labyrinthscout.com` Labyrinth control plane in this series.
- Do **not** claim Trust Passport, connectors, LLM judge Injection Shield, or automatic codebase scanning.
- Do **not** create new Stripe prices. Use `/opt/lampp/htdocs/verlox/.access/.stripe-credentials-and-price-id.md` only (Monitor / Govern / Team). Never paste secrets into prompts, commits, chat, or UI.
- Do **not** use em dashes, en dashes, or emojis anywhere.

## Product truth for clients

Scout SaaS protects agents only when the client **instruments** their runtime:

1. `filter` before model/tool use  
2. `trackEvent` after tool use  
3. Honor kill switch via status check / 403 from API  

No transparent repo or API monitoring without that wiring.

## Paths

| Path | Role |
|------|------|
| `/opt/lampp/htdocs/verlox/scout/scout-engine/` | Public `/v1`, dashboard API, billing, webhooks |
| `/opt/lampp/htdocs/verlox/scout/scout-dashboard/` | Customer UI (target host: console.labyrinthscout.com) |
| `/opt/lampp/htdocs/verlox/scout/scout-sdk/` | `@scout-security/client` |
| Existing prod reference | `propreneur/.../console.labyrinthscout.com/docker-compose.prod.yml` |

## Post-build

After each prompt: follow `00-library-docs/POST-BUILD-CHECKLIST.md`.  
When all five are COMPLETED, move this entire folder to:

`02-archived_prompts/archives_from_pending_prompts/scout-pilot-readiness/`
