---
id: 2026-07-13_carina_aiva_cost_workspace_comms_02_policy_router
title: Task-aware model policy router and tier enforcement
product: core-carina
capability: model-routing
status: completed
source: agent-chat
source_chat: 01-devends/prompts-library/source-chats/2026-07-13_carina-aiva-cost-workspace-comms.md
created: 2026-07-13
completed: 2026-07-13
canonical_path: 01-devends/prompts-library/archived/carina-aiva-cost-workspace-comms--02-policy-router-and-model-tiers.md
repo_paths:
  - 02-backends/core.carinaai.uk/src
  - 02-backends/core.carinaai.uk/tests
depends_on:
  - 2026-07-13_carina_aiva_cost_workspace_comms_01_research_architecture
tags:
  - model-routing
  - byok
  - subscriptions
validation:
  - cd 02-backends/core.carinaai.uk && pnpm check && pnpm test
---

# Task-Aware Model Policy Router and Tier Enforcement

## What This Builds

A central policy router that chooses the cheapest acceptable model tier for the task while preserving quality and safety.

## Target Files

- `02-backends/core.carinaai.uk/src/model-router/`
- `02-backends/core.carinaai.uk/src/billing/`
- `02-backends/core.carinaai.uk/src/api/`
- Existing provider, tool, task, and chat routing files discovered during implementation.

## Implementation Prompt

Build a `ModelPolicyRouter` with explicit tiers:

1. `mini_or_local`: default for simple chat, rewriting, classification, routine summarisation, cheap background work, drafts, and low-risk planning.
2. `openai_action`: action-based work, tool calling, UI operations, structured function calls, multi-step app tasks, channel operations, and medium-risk work.
3. `claude_deep`: serious calculations, mathematical work, deep reasoning, long persistent tasks, critical business decisions, high-risk output, and tasks explicitly marked mission critical.

The router must consider:

- User plan.
- BYOK status.
- Remaining allowance.
- Workspace policy.
- Task type.
- Risk level.
- Required tool capability.
- Context length.
- Expected output value.
- Cost estimate.

Do not route to Claude just because a user writes a long message. Require a task reason such as high reasoning depth, criticality, complex math, persistent planning, or operator override.

Add policy outputs:

- selected provider and model
- fallback provider and model
- reason
- estimated input tokens
- estimated output tokens
- estimated cost
- budget impact
- whether approval or subscription upgrade is required

Add enforcement:

- Subscription users receive soft warnings before allowance exhaustion.
- Hard stop or downgrade when usage would exceed plan economics.
- BYOK users bypass Carina provider-cost enforcement but keep safety, rate, and abuse controls.
- Admin override must be auditable.

## Acceptance Criteria

- All model calls pass through the policy router or a documented compatibility shim.
- Router decisions are logged to the usage ledger without sensitive prompt content.
- Tests cover mini, OpenAI, Claude, BYOK, low balance, hard stop, and admin override.
- User-facing downgrade messages are clear and calm.

## Validation

```bash
cd 02-backends/core.carinaai.uk
pnpm check
pnpm test
rg -n "ModelPolicyRouter|mini_or_local|openai_action|claude_deep" src tests
```

## Post-build

Archive this prompt after code, tests, and migration or config changes are complete.
