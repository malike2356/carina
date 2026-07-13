---
id: 2026-07-13_carina_tui_command_center_06_runtime_timeline
title: Carina TUI Command Center 06, runtime timeline
product: carina
capability: tui-command-center
status: completed
source: operator-request
source_chat:
created: 2026-07-13
completed: 2026-07-13
canonical_path: 01-devends/prompts-library/archived/carina-tui-command-center--06-runtime-timeline.md
repo_paths:
  - 02-backends/core.carinaai.uk/src/tui
  - 02-backends/core.carinaai.uk/src/telemetry
depends_on:
  - carina-tui-command-center--03-runtime-transport-proximity.md
tags:
  - carina-tui
  - runtime-timeline
validation:
  - cd 02-backends/core.carinaai.uk && pnpm check && pnpm exec vitest run src/tui
---

# Prompt 06: Runtime Timeline

**Status: COMPLETED 2026-07-13**

**What was built:**

- Added `src/tui/runtime-events/timeline-store.ts` with normalized runtime event types, bounded memory, filtering, redaction, and narrow rendering.
- Added `RuntimeTimeline` Ink component and wired `/timeline` plus `/events` through the TUI.
- Emitted timeline events for transport health, session start and switch, model start, token, completion, approvals, and runtime errors.
- Added timeline tests and marked runtime timeline as present in the Command Center contract.

## Objective

Add a runtime timeline that shows what Carina is doing during a session: model events, tool calls, approvals, worker-agent activity, Scout events, retries, interrupts, and errors.

## Target Files

- New `02-backends/core.carinaai.uk/src/tui/runtime-events/`
- New `02-backends/core.carinaai.uk/src/tui/ink/components/RuntimeTimeline.tsx`
- `02-backends/core.carinaai.uk/src/tui/ink/app.tsx`
- `02-backends/core.carinaai.uk/src/tui/log-buffer.ts`
- `02-backends/core.carinaai.uk/src/telemetry`

## Implementation Prompt

Define normalized TUI runtime events:

- `session.started`
- `session.switched`
- `model.started`
- `model.token`
- `model.completed`
- `tool.started`
- `tool.completed`
- `tool.failed`
- `approval.requested`
- `approval.resolved`
- `agent.started`
- `agent.completed`
- `scout.signal`
- `runtime.warning`
- `runtime.error`
- `interrupt.requested`
- `transport.reconnected`

Build a timeline store with bounded memory and filtering. Add a panel or overlay accessible by slash command and keyboard shortcut. The UI must be readable during active streaming and should degrade gracefully when runtime events are not available.

## Acceptance Criteria

- Runtime events are normalized and tested.
- Timeline can render recent events without leaking secrets.
- Tool, approval, Scout, interrupt, and model events have distinct Carina-native labels.
- The timeline works in narrow terminals.
- Tests cover event normalization, ordering, volume limits, redaction, and rendering.

## Validation

```bash
cd 02-backends/core.carinaai.uk
pnpm check
pnpm exec vitest run src/tui
```
