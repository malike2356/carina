---
id: 2026-07-13_carina_tui_command_center_07_tool_cards
title: Carina TUI Command Center 07, tool cards, redaction, and details
product: carina
capability: tui-command-center
status: completed
source: operator-request
source_chat:
created: 2026-07-13
completed: 2026-07-13
canonical_path: 01-devends/prompts-library/archived/carina-tui-command-center--07-tool-cards-redaction-and-details.md
repo_paths:
  - 02-backends/core.carinaai.uk/src/tui
depends_on:
  - carina-tui-command-center--04-renderer-contracts-and-benchmarks.md
  - carina-tui-command-center--06-runtime-timeline.md
tags:
  - carina-tui
  - tool-cards
validation:
  - cd 02-backends/core.carinaai.uk && pnpm check && pnpm exec vitest run src/tui
---

# Prompt 07: Tool Cards, Redaction, and Details

**Status: COMPLETED 2026-07-13**

**What was built:**

- Added `src/tui/details/tool-card.ts` with tool-card status, risk, summaries, duration, approval token safety, and deterministic redaction.
- Added session details preferences in `src/tui/details/preferences.ts` and wired `/details <section> <mode>`.
- Upgraded `ToolCallBlock` to render redacted tool cards and toggle result details with `x`.
- Added details tests and marked tool cards with redaction and details as present in the Command Center contract.

## Objective

Upgrade Carina tool display from simple tool blocks into expandable, redacted, test-covered tool cards with details sections for thinking, tools, worker agents, approvals, and activity.

## Target Files

- `02-backends/core.carinaai.uk/src/tui/ink/components/ToolCallBlock.tsx`
- `02-backends/core.carinaai.uk/src/tui/ink/components/ThinkingBlock.tsx`
- `02-backends/core.carinaai.uk/src/tui/ink/components/AssistantMessage.tsx`
- New `02-backends/core.carinaai.uk/src/tui/ink/components/ToolCard.tsx`
- New `02-backends/core.carinaai.uk/src/tui/details/`
- Tests under `02-backends/core.carinaai.uk/src/tui`

## Implementation Prompt

Create a tool card model:

- Tool name.
- Status: pending, running, success, failed, blocked, cancelled.
- Duration.
- Risk level.
- Arguments summary.
- Output summary.
- Error summary.
- Redaction state.
- Expand/collapse state.
- Related approval token if safe to show.

Create details section settings:

- `thinking`: hidden, collapsed, expanded.
- `tools`: hidden, collapsed, expanded.
- `agents`: hidden, collapsed, expanded.
- `activity`: hidden, collapsed, expanded.
- `approvals`: hidden, collapsed, expanded.

Expose details controls through slash commands and keyboard shortcuts.

Redact:

- API keys.
- OAuth tokens.
- Bearer tokens.
- Cookie values.
- Email access tokens.
- Internal workspace IDs where not needed.
- Any configured secret pattern.

## Acceptance Criteria

- Tool cards render safely in streaming and completed messages.
- Expansion state is stable.
- Redaction is deterministic and tested.
- Details section preferences persist for the session or local TUI config.
- Existing approval display still works.

## Validation

```bash
cd 02-backends/core.carinaai.uk
pnpm check
pnpm exec vitest run src/tui
```
