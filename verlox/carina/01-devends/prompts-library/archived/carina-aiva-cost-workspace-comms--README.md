---
id: 2026-07-13_carina_aiva_cost_workspace_comms_readme
title: Carina and Aiva cost control, workspace, comms, and channel friction pack
product: carina-aiva
capability: cost-control-workspace-comms
status: completed
source: agent-chat
source_chat: 01-devends/prompts-library/source-chats/2026-07-13_carina-aiva-cost-workspace-comms.md
created: 2026-07-13
completed: 2026-07-13
canonical_path: 01-devends/prompts-library/archived/carina-aiva-cost-workspace-comms--README.md
repo_paths:
  - 02-backends/core.carinaai.uk
  - 03-frontends/client-apps/app.carinaai.uk
  - 03-frontends/client-apps/admin.carinaai.uk
  - 03-frontends/client-apps/carinaMobile
  - 03-frontends/marketing/carinaai.uk
  - 03-frontends/marketing/hireaiva.co.uk
depends_on: []
tags:
  - model-routing
  - token-cost
  - aiva
  - workspace
  - whatsapp
validation:
  - cd 02-backends/core.carinaai.uk && pnpm check && pnpm test
  - Run relevant frontend typecheck, tests, and build commands for changed apps
  - Manual QA on web, mobile, billing dashboard, and WhatsApp setup
---

# Carina and Aiva Cost, Workspace, Comms, and Channel Friction Pack

## Goal

Make Carina and Aiva commercially sustainable and easier to use:

- Route work to the right model tier based on task value, risk, and cost.
- Reduce token burn without reducing output quality.
- Enforce subscription usage economics while preserving BYOK.
- Give operators a real usage, cost, and margin dashboard.
- Let users chat with, assign tasks to, and monitor Aiva employees directly inside web and mobile.
- Make the workspace feel like an agentic OS, not another chat box.
- Correct Aiva marketing so human VA backup is honest and scalable.
- Add a low-friction WhatsApp Web pairing option.

## External Patterns To Study First

Do not invent from scratch when a proven pattern exists. Research and adapt patterns from:

- LiteLLM: proxy budget tracking, model routing, spend logs, caching.
- GPTCache: semantic cache for repeated or similar LLM requests.
- LLMLingua and LLMLingua-2: prompt compression for long context and RAG inputs.
- Langfuse, Helicone, or similar observability products: per-user usage and cost dashboards.
- Baileys and whatsapp-web.js: WhatsApp Web pairing flow and session storage.

Respect licenses. Do not vendor external code unless license, maintenance, and security review are recorded.

## Execution Order

1. `carina-aiva-cost-workspace-comms--01-research-and-architecture.md`
2. `carina-aiva-cost-workspace-comms--02-policy-router-and-model-tiers.md`
3. `carina-aiva-cost-workspace-comms--03-token-efficiency-cache-and-compression.md`
4. `carina-aiva-cost-workspace-comms--04-usage-ledger-margins-and-ops-dashboard.md`
5. `carina-aiva-cost-workspace-comms--05-aiva-direct-employee-comms.md`
6. `carina-aiva-cost-workspace-comms--06-agentic-workspace-and-launcher-redesign.md`
7. `carina-aiva-cost-workspace-comms--07-aiva-marketing-human-va-repositioning.md`
8. `carina-aiva-cost-workspace-comms--08-whatsapp-web-pairing-channel.md`

## Global Rules

- No em dashes, en dashes, or emojis.
- Use Carina and Aiva voice, not competitor copy.
- Do not expose internal provider costs to customers unless intentionally designed as transparent billing copy.
- BYOK users should not be charged for provider tokens Carina did not buy, but usage still needs metering and safety limits.
- Subscription users must have soft and hard usage controls so provider cost does not exceed plan economics.
- Human VA language must be honest: backup, escalation, best effort, capacity managed.
- WhatsApp Web pairing must be presented as an easier option, with clear reliability and policy caveats.

## Completion Standard

The pack is complete when:

- Core routing, cost, and token efficiency policies are implemented with tests.
- Operators can view per-user token use, estimated provider cost, markup, margin, and alerts.
- Web and mobile users can work with Aiva employees directly without changing channel.
- Workspace UI shows work objects, worker state, task results, approvals, and completed work.
- Aiva marketing no longer overpromises human VA involvement.
- WhatsApp channel setup offers Business API and WhatsApp Web paths.
- All changed products pass their validation commands.
- Completed prompts are archived according to `01-devends/prompts-library/docs/POST-BUILD-CHECKLIST.md`.
