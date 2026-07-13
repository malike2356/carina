---
id: 2026-07-13_carina_tui_command_center_08_session_map
title: Carina TUI Command Center 08, session map and branch navigation
product: carina
capability: tui-command-center
status: completed
source: operator-request
source_chat:
created: 2026-07-13
completed: 2026-07-13
canonical_path: 01-devends/prompts-library/archived/carina-tui-command-center--08-session-map-and-branch-navigation.md
repo_paths:
  - 02-backends/core.carinaai.uk/src/tui
  - 02-backends/core.carinaai.uk/src/surfaces
depends_on:
  - carina-tui-command-center--03-runtime-transport-proximity.md
tags:
  - carina-tui
  - sessions
validation:
  - cd 02-backends/core.carinaai.uk && pnpm check && pnpm exec vitest run src/tui
---

# Prompt 08: Session Map and Branch Navigation

**Status: COMPLETED 2026-07-13**

**What was built:**

- Added `src/tui/sessions/session-map.ts` with session map nodes, search, current path, cycle, fork fallback, local rename, and compact or wide rendering.
- Upgraded `SessionSwitcher` to render branch-aware session map rows.
- Wired `/sessions`, `/resume`, and `/fork` through the Ink TUI and command registry.
- Added session map tests and marked session map and branch navigation as present in the Command Center contract.

## Objective

Upgrade Carina session switching into a session map that supports branch-aware navigation, resume, fork, rename, inspect, and search.

## Target Files

- `02-backends/core.carinaai.uk/src/tui/ink/components/SessionSwitcher.tsx`
- `02-backends/core.carinaai.uk/src/tui/ink/hooks/useSession.ts`
- New `02-backends/core.carinaai.uk/src/tui/sessions/`
- `02-backends/core.carinaai.uk/src/surfaces/session-store.ts`

## Implementation Prompt

Create a session map model:

- Session ID.
- Display title.
- Created and updated time.
- Parent session ID when available.
- Branch/fork metadata.
- Message count.
- Token count.
- Current model.
- Last activity.
- Status.

Implement actions:

- Open session.
- Resume previous session.
- Fork current session.
- Rename session title locally when supported.
- Search sessions.
- Show current session path.
- Cycle previous/next session.

Add a compact rendering for narrow terminals and a richer rendering for wide terminals.

## Acceptance Criteria

- Current session switcher still works.
- Branch/fork data is shown when available and hidden when not.
- `/session`, `/sessions`, `/resume`, and `/fork` are wired through the new command registry.
- Tests cover fallback data, navigation, search, and rendering.

## Validation

```bash
cd 02-backends/core.carinaai.uk
pnpm check
pnpm exec vitest run src/tui
```
