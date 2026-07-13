---
id: 2026-07-13_carina_aiva_cost_workspace_comms_04_usage_ledger_margins_dashboard
title: Usage ledger, margin accounting, and operator dashboard
product: core-carina
capability: billing-observability
status: completed
source: agent-chat
source_chat: 01-devends/prompts-library/source-chats/2026-07-13_carina-aiva-cost-workspace-comms.md
created: 2026-07-13
completed: 2026-07-13
canonical_path: 01-devends/prompts-library/archived/carina-aiva-cost-workspace-comms--04-usage-ledger-margins-and-ops-dashboard.md
repo_paths:
  - 02-backends/core.carinaai.uk/src
  - 02-backends/admin/ops.carinaai.uk
  - 03-frontends/client-apps/admin.carinaai.uk
depends_on:
  - 2026-07-13_carina_aiva_cost_workspace_comms_02_policy_router
  - 2026-07-13_carina_aiva_cost_workspace_comms_03_token_efficiency
tags:
  - usage-ledger
  - billing
  - margin
  - dashboard
validation:
  - cd 02-backends/core.carinaai.uk && pnpm check && pnpm test
  - Run ops or admin panel typecheck and tests where available
---

# Usage Ledger, Margin Accounting, and Operator Dashboard

## What This Builds

The business control system for token usage, provider cost, subscription allowance, BYOK, markup, and operator decisions.

## Target Files

- `02-backends/core.carinaai.uk/src/billing/`
- `02-backends/core.carinaai.uk/src/infrastructure/migrations/`
- `02-backends/core.carinaai.uk/src/api/`
- `02-backends/admin/ops.carinaai.uk/`
- `03-frontends/client-apps/admin.carinaai.uk/`

## Implementation Prompt

Create a provider usage ledger that records every model call:

- tenant id
- user id
- workspace id
- channel or surface
- plan id
- BYOK flag
- provider
- model
- policy tier
- input tokens
- output tokens
- cached tokens where provider reports them
- optimized tokens saved
- provider cost estimate
- provider cost actual if available
- Carina markup
- payment overhead allocation
- margin allocation
- subscription allowance impact
- request id
- timestamp

Cost formula must be configurable:

- `provider_cost = provider_unit_price * billable_tokens`
- `payment_overhead = provider_cost * 0.035`
- `platform_margin = provider_cost * 0.015`
- `internal_charge_basis = provider_cost + payment_overhead + platform_margin`

Use the Stripe billing source of truth for plan IDs and prices:

- `/opt/lampp/htdocs/verlox/.stripe-credentials-and-price-id.md`

Do not paste secrets or private Stripe values into logs, docs, UI, or chat.

Build dashboards for operators:

- top users by token cost
- users approaching plan loss threshold
- margin by plan
- BYOK usage
- cache savings
- model tier mix
- Claude usage and critical-task justification
- OpenAI tool-call usage
- local or mini model deflection rate
- alerts for abuse or broken routing

Add user-facing account usage summaries:

- remaining allowance
- BYOK status
- upgrade or BYOK prompt when needed
- plain explanation without exposing internal margin math

## Acceptance Criteria

- Usage ledger migration exists.
- Provider calls write ledger rows.
- Dashboard shows per-user, per-plan, and per-provider cost health.
- BYOK usage is separated from Carina-paid provider cost.
- Alerts identify users costing more than their plan can sustain.
- Tests cover cost formula, BYOK, subscription allowance, and dashboard API.

## Validation

```bash
cd 02-backends/core.carinaai.uk
pnpm check
pnpm test
rg -n "payment_overhead|platform_margin|usage ledger|BYOK" src
```

## Post-build

Archive this prompt after migrations, APIs, dashboards, and tests are complete.
