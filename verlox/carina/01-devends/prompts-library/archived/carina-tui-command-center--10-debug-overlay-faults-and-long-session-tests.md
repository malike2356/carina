---
id: 2026-07-13_carina_tui_command_center_10_debug_faults
title: Carina TUI Command Center 10, debug overlay, faults, and long-session tests
product: carina
capability: tui-command-center
status: completed
source: operator-request
source_chat:
created: 2026-07-13
completed: 2026-07-13
canonical_path: 01-devends/prompts-library/archived/carina-tui-command-center--10-debug-overlay-faults-and-long-session-tests.md
repo_paths:
  - 02-backends/core.carinaai.uk/src/tui
depends_on:
  - carina-tui-command-center--04-renderer-contracts-and-benchmarks.md
  - carina-tui-command-center--06-runtime-timeline.md
  - carina-tui-command-center--09-review-mode-search-export-copy.md
tags:
  - carina-tui
  - debug
  - fault-tests
validation:
  - cd 02-backends/core.carinaai.uk && pnpm check && pnpm exec vitest run src/tui && bash scripts/check-tui-command-center.sh
---

# Prompt 10: Debug Overlay, Faults, and Long-Session Tests

**Status: COMPLETED 2026-07-13**

**What was built:**

- Added `src/tui/debug/debug-state.ts` and `DebugOverlay` for sanitized render, transport, runtime, log, session, model, terminal, and command state.
- Wired `/debug` and Ctrl+D into the Ink TUI.
- Added fault contract tests for transport-style failures, backend command errors, malformed events, huge tool output, resize loops, empty sessions, long sessions, and unavailable slash commands.
- Disabled test-time skin preference persistence and repaired malformed local Carina config so TUI tests load reliably.
- Marked debug overlay and fault/long-session contracts as present.

## Objective

Add a Carina TUI debug overlay and harden the TUI against real operational failures: dropped transports, malformed events, resize churn, huge outputs, approval interruptions, and long sessions.

## Target Files

- New `02-backends/core.carinaai.uk/src/tui/debug/`
- New `02-backends/core.carinaai.uk/src/tui/ink/components/DebugOverlay.tsx`
- New `02-backends/core.carinaai.uk/src/tui/faults/`
- `02-backends/core.carinaai.uk/src/tui/ink/app.tsx`
- `02-backends/core.carinaai.uk/src/tui/terminal.ts`
- Tests under `02-backends/core.carinaai.uk/src/tui`

## Implementation Prompt

Build a debug overlay with:

- Render state summary.
- Active overlay state.
- Runtime transport state.
- Recent runtime events.
- Recent errors.
- Last command dispatch.
- Session ID shortened for display.
- Model and provider.
- Terminal size.
- Memory and transcript counters.

Build fault tests for:

- Transport disconnect and reconnect.
- Backend command failure.
- Malformed runtime event.
- Tool output too large.
- Terminal resize loop.
- Empty sessions.
- Long sessions.
- Approval modal interrupted by disconnect.
- Slash command unavailable.
- Clipboard unavailable.
- External editor unavailable.

All user-facing errors must be calm, short, and actionable. Internal details can be copied through debug tools only when explicitly requested and sanitized.

## Acceptance Criteria

- Debug overlay is available through a command and keyboard shortcut.
- Normal users do not see raw stack traces.
- Fault tests cover the listed cases.
- Long-session tests protect rendering and memory budgets.
- The final check script includes these tests.

## Validation

```bash
cd 02-backends/core.carinaai.uk
pnpm check
pnpm exec vitest run src/tui
bash scripts/check-tui-command-center.sh
```
