---
id: 2026-07-13_carina_aiva_cost_workspace_comms_01_research_architecture
title: Research and architecture for cost-aware Carina and Aiva
product: carina-aiva
capability: architecture-research
status: completed
source: agent-chat
source_chat: 01-devends/prompts-library/source-chats/2026-07-13_carina-aiva-cost-workspace-comms.md
created: 2026-07-13
completed: 2026-07-13
canonical_path: 01-devends/prompts-library/archived/carina-aiva-cost-workspace-comms--01-research-and-architecture.md
repo_paths:
  - 02-backends/core.carinaai.uk
  - 03-frontends/client-apps/app.carinaai.uk
  - 03-frontends/client-apps/admin.carinaai.uk
  - 03-frontends/client-apps/carinaMobile
  - 03-frontends/marketing/carinaai.uk
  - 03-frontends/marketing/hireaiva.co.uk
depends_on: []
tags:
  - research
  - architecture
  - token-cost
validation:
  - Documentation compiles or lints if the touched docs site has a validation command
  - Research notes include source links, license notes, and implementation decisions
---

# Research and Architecture for Cost-Aware Carina and Aiva

## What This Builds

A concrete architecture document and implementation map for all later prompts in this pack.

## Target Files

- `02-backends/core.carinaai.uk/docs/cost-aware-routing.md`
- `02-backends/core.carinaai.uk/src/platform/platform-knowledge.md`
- `01-devends/prompts-library/reference-prompts/carina-aiva-cost-workspace-comms--architecture.md`

## Implementation Prompt

Research current open-source and public patterns for:

- LLM gateway routing, user budgets, and spend logs.
- Token accounting across OpenAI, Anthropic, and local or mini models.
- Prompt caching, semantic caching, and response reuse.
- Prompt compression and context trimming.
- Per-user AI cost dashboards.
- Agent workspace UX that surfaces tasks and completed work, not only chat.
- WhatsApp Web pairing options using Baileys and whatsapp-web.js.

Study at minimum:

- LiteLLM budget, routing, spend, and caching patterns.
- GPTCache semantic cache patterns.
- LLMLingua and LLMLingua-2 compression patterns.
- Langfuse or Helicone usage dashboard patterns.
- Baileys and whatsapp-web.js setup, session persistence, and operational risks.

For each source, record:

- What to adopt.
- What not to adopt.
- License and maintenance risk.
- Security risk.
- Product fit for Carina or Aiva.
- Implementation path in this repo.

Produce an architecture reference that later prompts must follow. Include:

- Model tier policy: mini or local, OpenAI, Claude.
- BYOK versus subscription usage policy.
- Cost formula and margin model.
- Usage ledger schema.
- Cache and compression decision tree.
- Workspace object model: task, employee, channel, approval, result, handoff.
- WhatsApp Web pairing architecture and fallback to official Business API.

## Acceptance Criteria

- Architecture doc exists and is specific to this repo.
- It includes source links and license notes.
- It defines the business policy for model choice and cost control.
- It defines the sequence and dependencies for prompts 02 through 08.
- It does not contain secrets or real provider keys.

## Validation

```bash
rg -n "LiteLLM|GPTCache|LLMLingua|Baileys|whatsapp-web.js" 02-backends/core.carinaai.uk/docs 01-devends/prompts-library/reference-prompts
python3 scripts/fix-writing-style.py
```

## Post-build

Archive this prompt only after the research document and architecture reference are written and reviewed.
