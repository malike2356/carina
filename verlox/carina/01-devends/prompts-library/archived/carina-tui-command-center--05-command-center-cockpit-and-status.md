---
id: 2026-07-13_carina_tui_command_center_05_cockpit
title: Carina TUI Command Center 05, cockpit and status
product: carina
capability: tui-command-center
status: completed
source: operator-request
source_chat:
created: 2026-07-13
completed: 2026-07-13
canonical_path: 01-devends/prompts-library/archived/carina-tui-command-center--05-command-center-cockpit-and-status.md
repo_paths:
  - 02-backends/core.carinaai.uk/src/tui
depends_on:
  - carina-tui-command-center--02-command-registry-and-slash-fallthrough.md
  - carina-tui-command-center--03-runtime-transport-proximity.md
tags:
  - carina-tui
  - cockpit
validation:
  - cd 02-backends/core.carinaai.uk && pnpm check && pnpm exec vitest run src/tui
---

# Prompt 05: Command Center Cockpit and Status

**Status: COMPLETED 2026-07-13**

**What was built:**

- Added `src/tui/command-center/cockpit.ts` for session, model, connection, streaming, queue, agents, Scout, approvals, tokens, mode, and command hints.
- Upgraded Ink `StatusLine` to render the cockpit across minimal, compact, and wide terminal modes.
- Wired the Ink app into active agent and Scout snapshots without removing the startup splash.
- Reused the cockpit model in the operator status bar and marked the Command Center cockpit contract as present.

## Objective

Turn Carina TUI from a chat panel plus overlays into a true Command Center with a useful operator cockpit, without losing the Carina splash or making the UI look like Keprix.

## Target Files

- `02-backends/core.carinaai.uk/src/tui/ink/app.tsx`
- `02-backends/core.carinaai.uk/src/tui/ink/components/StatusLine.tsx`
- `02-backends/core.carinaai.uk/src/tui/status-bar.ts`
- New `02-backends/core.carinaai.uk/src/tui/command-center/`
- `02-backends/core.carinaai.uk/src/tui/ink/theme/`

## Implementation Prompt

Build a Carina cockpit model that can be rendered in Ink and used by the operator TUI:

- Current session.
- Current model and provider.
- Connection status.
- Streaming state.
- Queue state.
- Active worker agents.
- Scout trust state.
- Pending approvals.
- Token count.
- Prompt cache refresh state.
- Current panel or mode.
- Top command hints.

Create a cockpit component that:

- Adapts to narrow terminals.
- Does not crowd the transcript.
- Uses Carina colors and Carina copy.
- Keeps the Carina splash on startup.
- Gives the left or top status area real operational value.

Add empty, loading, offline, degraded, and error states.

## Acceptance Criteria

- Operators can understand runtime state without opening multiple overlays.
- The cockpit is useful in narrow and wide terminals.
- The Carina splash remains on startup.
- Existing StatusLine behavior is preserved or upgraded.
- Tests cover cockpit state mapping and responsive rendering.

## Validation

```bash
cd 02-backends/core.carinaai.uk
pnpm check
pnpm exec vitest run src/tui
```
