---
id: 2026-07-13_carina_tui_command_center_04_renderer
title: Carina TUI Command Center 04, renderer contracts and benchmarks
product: carina
capability: tui-command-center
status: completed
source: operator-request
source_chat:
created: 2026-07-13
completed: 2026-07-13
canonical_path: 01-devends/prompts-library/archived/carina-tui-command-center--04-renderer-contracts-and-benchmarks.md
repo_paths:
  - 02-backends/core.carinaai.uk/src/tui
depends_on:
  - carina-tui-command-center--01-contract-audit-and-test-harness.md
tags:
  - carina-tui
  - renderer
validation:
  - cd 02-backends/core.carinaai.uk && pnpm check && pnpm exec vitest run src/tui
---

# Prompt 04: Renderer Contracts and Benchmarks

**Status: COMPLETED 2026-07-13**

**What was built:**

- Added `src/tui/renderer/primitives.ts` for cell width measurement, wide-character handling, streaming markdown merge, code block rendering, tool output folding, viewport slicing, resize reflow, and bounded transcript rendering.
- Re-exported cell-aware helpers from `src/tui/terminal.ts`.
- Added renderer contract and benchmark-style tests for large transcripts, markdown chunks, tool folding, and terminal widths.
- Marked renderer contracts and benchmarks as present in the Command Center contract.

## Objective

Upgrade the Carina TUI renderer so it handles long sessions, streaming markdown, tool output, terminal resizing, selection, wide characters, and fault recovery with explicit contracts and benchmarks.

## Target Files

- `02-backends/core.carinaai.uk/src/tui/ink/components/MessageList.tsx`
- `02-backends/core.carinaai.uk/src/tui/ink/components/InlineMarkdown.tsx`
- `02-backends/core.carinaai.uk/src/tui/ink/components/StreamingMessage.tsx`
- `02-backends/core.carinaai.uk/src/tui/terminal.ts`
- `02-backends/core.carinaai.uk/src/tui/responsive-frame.ts`
- New `02-backends/core.carinaai.uk/src/tui/renderer/`
- Tests under `02-backends/core.carinaai.uk/src/tui`

## Implementation Prompt

Build renderer primitives for:

- Cell width measurement.
- Unicode and wide-character handling.
- Markdown streaming assembly.
- Code block rendering.
- Tool output folding.
- Viewport slicing.
- Selection-safe transcript lines.
- Resize reflow.
- Long transcript virtualization or bounded rendering.

Add benchmark-style tests that enforce:

- Large transcript render stays within a reasonable budget.
- Streaming token append does not re-render unnecessary state.
- Markdown chunks merge correctly.
- Tool output is folded until expanded.
- Terminal resize does not drop content or corrupt layout.

Do not introduce a new UI framework. Work inside the current Ink and operator TUI architecture unless a small isolated renderer helper is needed.

## Acceptance Criteria

- Long transcript rendering is stable and tested.
- Streaming markdown output is deterministic.
- Resize handling is tested across narrow, normal, and wide terminals.
- Renderer helpers are decoupled enough to test without launching a full TUI.
- No visible text uses competitor names.

## Validation

```bash
cd 02-backends/core.carinaai.uk
pnpm check
pnpm exec vitest run src/tui
```
