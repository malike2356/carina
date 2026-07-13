---
id: 2026-07-13_carina_aiva_cost_workspace_comms_06_agentic_workspace_launcher
title: Agentic workspace and Aiva launcher redesign
product: carina-aiva
capability: workspace-ux
status: completed
source: agent-chat
source_chat: 01-devends/prompts-library/source-chats/2026-07-13_carina-aiva-cost-workspace-comms.md
created: 2026-07-13
completed: 2026-07-13
canonical_path: 01-devends/prompts-library/archived/carina-aiva-cost-workspace-comms--06-agentic-workspace-and-launcher-redesign.md
repo_paths:
  - 03-frontends/client-apps/app.carinaai.uk
  - 03-frontends/client-apps/admin.carinaai.uk
  - 03-frontends/client-apps/carinaMobile
depends_on:
  - 2026-07-13_carina_aiva_cost_workspace_comms_05_aiva_direct_employee_comms
tags:
  - workspace
  - launcher
  - ux
validation:
  - Run changed frontend typecheck, tests, lint, and build commands
  - Capture desktop and mobile screenshots
---

# Agentic Workspace and Aiva Launcher Redesign

## What This Builds

A workspace that feels like an agentic OS for work, not a generic chat interface.

## Target Files

- `03-frontends/client-apps/app.carinaai.uk/`
- `03-frontends/client-apps/admin.carinaai.uk/`
- `03-frontends/client-apps/carinaMobile/`

## Implementation Prompt

Redesign the workspace IA and key screens around work objects:

- Today
- Employees
- Tasks
- Approvals
- Completed work
- Channels
- Documents
- Automations
- Settings

Chat remains important, but it becomes the instruction surface for work, not the whole product.

Design rules:

- First screen should show operational state: active workers, tasks in progress, pending approvals, completed work, channel health, and next best actions.
- Primary actions must be visible: assign task, chat with employee, review completed work, connect channel, add document, create automation.
- Use restrained, modern UI. Avoid dashboard clutter and avoid hiding the product behind generic chat.
- Do not make a marketing landing page inside the app.
- The Aiva launcher must feel polished and credible. It should guide the user into hiring, configuring, or talking to an employee with a simple choice.
- Copy must use plain user language. Avoid technical platform words unless the user is in admin or developer mode.

Build:

- A new workspace home layout.
- Aiva launcher redesign.
- Empty states for first-time users.
- Mobile equivalents or mobile-adapted navigation.
- Completed work gallery or list.
- Worker state cards.
- Approval queue.
- Direct task assignment flow.

## Acceptance Criteria

- A first-time user can understand what to do in under 30 seconds.
- A returning user can see what Aiva is doing without opening chat.
- Completed tasks are easy to find.
- The launcher no longer feels generic or unfinished.
- Mobile layout does not hide primary workflows.
- Screenshots prove no overlap, illegible text, or cramped controls.

## Validation

```bash
cd 03-frontends/client-apps/app.carinaai.uk
pnpm typecheck
pnpm test
pnpm build
cd ../carinaMobile
pnpm test
pnpm typecheck
```

Run Playwright or available screenshot tooling for desktop and mobile. Save screenshots in the product QA folder if the repo has one.

## Post-build

Archive this prompt after frontend validation and screenshot QA.
