---
id: 2026-07-13_carina_aiva_cost_workspace_comms_07_aiva_marketing_va_repositioning
title: Aiva marketing repositioning for honest human VA backup
product: aiva
capability: marketing-positioning
status: completed
source: agent-chat
source_chat: 01-devends/prompts-library/source-chats/2026-07-13_carina-aiva-cost-workspace-comms.md
created: 2026-07-13
completed: 2026-07-13
canonical_path: 01-devends/prompts-library/archived/carina-aiva-cost-workspace-comms--07-aiva-marketing-human-va-repositioning.md
repo_paths:
  - 03-frontends/marketing/hireaiva.co.uk
  - 03-frontends/marketing/carinaai.uk
  - 03-frontends/client-apps/app.carinaai.uk
depends_on: []
tags:
  - aiva
  - marketing
  - human-va
validation:
  - Run marketing site build or static validation command
  - python3 scripts/fix-writing-style.py
---

# Aiva Marketing Repositioning for Honest Human VA Backup

## What This Builds

Marketing and product copy that stops overpromising human VA capacity and explains the realistic value: AI employees first, human backup when escalation is needed and capacity is available.

## Target Files

- `03-frontends/marketing/hireaiva.co.uk/`
- `03-frontends/marketing/carinaai.uk/`
- Any app onboarding copy that claims human VA involvement.

## Implementation Prompt

Audit Aiva marketing and onboarding for copy that implies:

- A human VA silently handles work all the time.
- Every escalation is guaranteed immediately.
- Human intervention is unlimited.
- The user will not know when work moves from AI to human.

Rewrite the narrative:

- Aiva is an AI employee workspace.
- Human VA support is backup and escalation for work AI cannot complete alone.
- Escalation is clear, visible, and capacity managed.
- The user can see when a task is escalated.
- Human backup is a practical safety net, not the main product promise.

Use language like:

- "AI employees handle the routine work. Human backup can step in for escalations when needed."
- "Escalation is visible, tracked, and subject to plan and availability."
- "Aiva is built to reduce manual workload, not pretend every task is secretly handled by a person."

Avoid:

- "Your human VA is always there."
- "Silent human support."
- "Unlimited VA help."
- "We handle everything for you."

Update site sections, FAQs, pricing notes, onboarding, and any feature cards that currently overstate human VA involvement.

## Acceptance Criteria

- Marketing is still attractive, but honest.
- Human VA backup is framed as escalation, not the default delivery engine.
- No page promises unlimited or invisible human work.
- Pricing and plan copy reflect capacity and fair-use limits.
- App copy matches marketing copy.

## Validation

```bash
rg -n "human VA|VA|escalat|unlimited|silent|backup" 03-frontends/marketing 03-frontends/client-apps
python3 scripts/fix-writing-style.py
```

Run the marketing build command for the touched site.

## Post-build

Archive this prompt after copy, build, and manual review are complete.
