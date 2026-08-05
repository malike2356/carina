# Sprint 3 - Support Agent Prompt Pack

**Status: COMPLETED 2026-06-23**

**Purpose:** Make Carina the first line of support for Carina AI and Labyrinth Scout users.
**Goal:** Zero 2am support tickets. Every question a new or active user could ask is answerable by Carina herself, in plain language.

**What was built:**

- Direct-injection Support profile (v2 path): `brain/carina_support_knowledge/`, `system-prompt.md`, builtin seed in app + core
- `buildResponseDeliveryBlock()` in `conversation-discipline.ts` with test coverage
- App: `workspace_profiles` table, `/api/workspace/profiles`, Profiles page, chat profile switcher
- Core: `support-profile.ts`, `BUILTIN_PROFILE_IDS.support`, container bootstrap seed
- Deployed to production 2026-06-23 (app + partial core sync)

**Not built (superseded or out of scope):**

- RAG path (`11-knowledge-sync-cron.md`, `14-full-implementation.md`): superseded by direct injection in `14-full-implementation-v2.md`
- Custom "New profile" UI, support widget/email channel, manual end-to-end QA checklist

**Implementation reference:** `14-full-implementation-v2.md`

---

## What this pack contains

| File | Contents |
|------|----------|
| `00-system-prompt.md` | The system prompt to load when Carina is in support mode |
| `01-product-overview.md` | What Carina AI and Scout are, who they are for |
| `02-getting-started.md` | Sign-up, BYOK setup, first conversation |
| `03-chat-memory-skills.md` | Chat, Memory, Skills, Notes in detail |
| `04-workspace-tools.md` | Documents, Calendar, Tasks, Research, Files, Email |
| `05-automation.md` | Cron jobs, Scheduled tasks, Webhooks, Environment variables |
| `06-advanced-features.md` | MCP servers, Terminal, Profiles, Library, Skill Packs |
| `07-billing-and-plans.md` | Carina AI plans, Scout plans, quotas, upgrades |
| `08-labyrinth-scout.md` | Scout in depth: what it monitors, how to pair, plan features |
| `09-troubleshooting.md` | Common problems with exact fixes |
| `10-response-templates.md` | Ready-to-use replies for the most frequent tickets |

---

## How to deploy this (v2 direct injection)

1. Edit knowledge files `01` through `10` in this pack when product facts change.
2. Regenerate `00-system-prompt-FULL.md` and copy `system-prompt.md` to:
   - `backends/servers/core.carinaai.uk/brain/carina_support_knowledge/system-prompt.md`
   - `frontends/client-apps/app.carinaai.uk/src/lib/support/system-prompt.md`
3. Redeploy core + app. Existing workspaces pick up the Support profile on first `/api/workspace/profiles` load; re-seed or update builtin rows if the embedded prompt text changes.

The support agent must NEVER reveal system internals, database structure, API keys, server paths, or any internal tooling. The `00-system-prompt.md` enforces this explicitly.

---

## Rules for maintaining this pack

- When a new feature ships, add it to the relevant knowledge file the same day.
- When a plan price changes, update `07-billing-and-plans.md` immediately and redeploy the Support profile prompt.
- When a troubleshooting ticket reveals a gap in this pack, add it to `09-troubleshooting.md`.
- Never delete the old answers; add a "resolved in version X" note if the issue is fixed.
