---
id: 2026-07-13_carina_aiva_cost_workspace_comms_05_aiva_direct_employee_comms
title: Direct Aiva employee chat, tasks, and monitoring in web and mobile
product: aiva
capability: employee-comms
status: completed
source: agent-chat
source_chat: 01-devends/prompts-library/source-chats/2026-07-13_carina-aiva-cost-workspace-comms.md
created: 2026-07-13
completed: 2026-07-13
canonical_path: 01-devends/prompts-library/archived/carina-aiva-cost-workspace-comms--05-aiva-direct-employee-comms.md
repo_paths:
  - 02-backends/core.carinaai.uk/src
  - 03-frontends/client-apps/app.carinaai.uk
  - 03-frontends/client-apps/carinaMobile
depends_on:
  - 2026-07-13_carina_aiva_cost_workspace_comms_02_policy_router
tags:
  - aiva
  - employees
  - mobile
  - web
validation:
  - cd 02-backends/core.carinaai.uk && pnpm check && pnpm test
  - Run web app validation
  - cd 03-frontends/client-apps/carinaMobile && pnpm test && pnpm typecheck
---

# Direct Aiva Employee Chat, Tasks, and Monitoring in Web and Mobile

## What This Builds

Users can manage Aiva employees inside the app without switching to WhatsApp, Slack, Telegram, or email.

## Target Files

- `02-backends/core.carinaai.uk/src/aiva/`
- `02-backends/core.carinaai.uk/src/api/`
- `03-frontends/client-apps/app.carinaai.uk/`
- `03-frontends/client-apps/carinaMobile/`

## Implementation Prompt

Build an Aiva employee communication layer with:

- Employee directory.
- Direct employee chat.
- Assign task action.
- Task status view.
- Activity timeline.
- Completed work view.
- Escalation and handoff state.
- Notifications in web and mobile.
- Ability to continue a conversation from channel into app, and from app into channel.

The user should be able to:

- Open an Aiva employee profile.
- Send a message directly to that employee.
- Assign a task with due date, priority, attachments, and expected output.
- See whether the employee is idle, working, blocked, waiting approval, escalated, or done.
- Open completed work and approve, reject, or ask for changes.
- See channel messages as context, not as the only control surface.

Backend requirements:

- A canonical Aiva employee object.
- A canonical task object.
- A conversation thread per employee and user workspace.
- Events for assignment, progress, block, completion, approval, escalation, and handoff.
- Role and tenant isolation.
- Cost policy integration from prompts 02 and 04.

Frontend requirements:

- Web UI screen or panel for Aiva employees.
- Mobile screen for Aiva employees with chat and task status.
- Clear empty states and action buttons.
- No hidden-only menus for primary actions.

## Acceptance Criteria

- A user can chat with an Aiva employee in web and mobile without opening a channel app.
- A user can assign and track a task.
- Completed work is visible as a work object, not buried in chat.
- Events are audit logged.
- Tests cover API permissions, task lifecycle, and mobile/web rendering where test harnesses exist.

## Validation

```bash
cd 02-backends/core.carinaai.uk
pnpm check
pnpm test
cd ../../03-frontends/client-apps/carinaMobile
pnpm test
pnpm typecheck
```

## Post-build

Archive this prompt after web, mobile, backend, and tests are complete.
