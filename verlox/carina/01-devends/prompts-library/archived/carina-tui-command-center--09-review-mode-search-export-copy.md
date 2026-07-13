---
id: 2026-07-13_carina_tui_command_center_09_review_mode
title: Carina TUI Command Center 09, review mode, search, export, and copy
product: carina
capability: tui-command-center
status: completed
source: operator-request
source_chat:
created: 2026-07-13
completed: 2026-07-13
canonical_path: 01-devends/prompts-library/archived/carina-tui-command-center--09-review-mode-search-export-copy.md
repo_paths:
  - 02-backends/core.carinaai.uk/src/tui
depends_on:
  - carina-tui-command-center--04-renderer-contracts-and-benchmarks.md
  - carina-tui-command-center--08-session-map-and-branch-navigation.md
tags:
  - carina-tui
  - review-mode
validation:
  - cd 02-backends/core.carinaai.uk && pnpm check && pnpm exec vitest run src/tui
---

# Prompt 09: Review Mode, Search, Export, and Copy

**Status: COMPLETED 2026-07-13**

**What was built:**

- Added `src/tui/review/review-mode.ts` with transcript blocks, search, last assistant reply, sanitized markdown export, sanitized JSON export, safe URL detection, and clipboard fallback.
- Added `ReviewMode` Ink component and wired `/review`, `/search`, `/copy`, `/export`, and `/export json`.
- Preserved live composer and streaming state by opening review as an overlay.
- Added review tests and marked review mode, search, export, and copy as present in the Command Center contract.

## Objective

Add a review mode that lets operators inspect, search, copy, and export transcript data without disturbing the live session.

## Target Files

- New `02-backends/core.carinaai.uk/src/tui/review/`
- New `02-backends/core.carinaai.uk/src/tui/ink/components/ReviewMode.tsx`
- `02-backends/core.carinaai.uk/src/tui/ink/components/MessageList.tsx`
- `02-backends/core.carinaai.uk/src/tui/operator/external-editor.ts`
- `02-backends/core.carinaai.uk/src/tui/operator/hyperlinks.ts`

## Implementation Prompt

Implement review mode with:

- Enter and exit commands.
- Transcript search.
- Copy last assistant reply.
- Copy selected block.
- Export transcript as markdown.
- Export runtime summary as JSON.
- Open detected URLs safely.
- Preserve live streaming state while review mode is open.
- Handle partial data and empty transcripts.

Use platform-appropriate clipboard behavior. If clipboard is unavailable, write a clear path or command that lets the operator retrieve the output.

## Acceptance Criteria

- Review mode does not lose the live composer state.
- Search works across user, assistant, tool, and system messages.
- Export output is sanitized.
- Copy behavior is tested with a mock clipboard.
- URL opening is safe and asks for confirmation when needed.

## Validation

```bash
cd 02-backends/core.carinaai.uk
pnpm check
pnpm exec vitest run src/tui
```
