---
id: 2026-07-13_carina_tui_command_center_02_command_registry
title: Carina TUI Command Center 02, command registry and slash fallthrough
product: carina
capability: tui-command-center
status: completed
source: operator-request
source_chat:
created: 2026-07-13
completed: 2026-07-13
canonical_path: 01-devends/prompts-library/archived/carina-tui-command-center--02-command-registry-and-slash-fallthrough.md
repo_paths:
  - 02-backends/core.carinaai.uk/src/tui
depends_on:
  - carina-tui-command-center--01-contract-audit-and-test-harness.md
tags:
  - carina-tui
  - slash-commands
validation:
  - cd 02-backends/core.carinaai.uk && pnpm check && pnpm exec vitest run src/tui/commands/registry.test.ts src/tui/slash-commands.test.ts src/tui/ink/slash-catalog.test.ts
---

# Prompt 02: Command Registry and Slash Fallthrough

**Status: COMPLETED 2026-07-13**

**What was built:**

- Added `src/tui/commands/registry.ts` with typed command metadata, aliases, examples, handler kinds, source, danger level, and argument hints.
- Rebuilt the Ink slash catalog from the shared registry and improved the popup with argument hints, examples, wrapping navigation, Tab, Enter, Esc, and a show more toggle.
- Routed TUI slash handling through the registry, preserved existing commands, added aliases, and sanitized backend failures.
- Marked the Command Center command registry contract as present and added registry, slash, and catalog tests.

## Objective

Replace the current shallow slash handling with a Carina-native command registry that supports aliases, descriptions, argument metadata, examples, source, danger level, handler kind, backend fallthrough, and sanitized errors.

## Current Gap

Carina currently has a useful fuzzy slash menu, but the explicit TUI command catalog is small and fallback behavior often tells the user to run `carina ...` in the shell. Keprix has a richer local-first registry with command metadata and backend fallthrough.

## Target Files

- `02-backends/core.carinaai.uk/src/tui/ink/slash-catalog.ts`
- `02-backends/core.carinaai.uk/src/tui/slash-commands.ts`
- `02-backends/core.carinaai.uk/src/tui/commands.ts`
- `02-backends/core.carinaai.uk/src/tui/ink/components/FuzzySlashMenu.tsx`
- `02-backends/core.carinaai.uk/src/tui/ink/components/InputBar.tsx`
- New files under `02-backends/core.carinaai.uk/src/tui/commands/`
- Relevant tests under `02-backends/core.carinaai.uk/src/tui`

## Implementation Prompt

Build a typed command registry:

```ts
type CommandSource = 'local' | 'backend' | 'skill' | 'plugin' | 'system';
type HandlerKind = 'local' | 'backend' | 'panel' | 'turn' | 'external';
type DangerLevel = 'safe' | 'confirm' | 'danger';
```

Each command must include:

- `name`
- `aliases`
- `description`
- `args`
- `examples`
- `source`
- `requiresSession`
- `dangerLevel`
- `handlerKind`

Minimum local commands:

- `/help`, `/?`
- `/quit`, `/exit`, `/q`
- `/new`, `/reset`
- `/session`, `/sessions`
- `/model`, `/provider`
- `/skin`, `/theme`
- `/clear`
- `/retry`
- `/stop`, `/interrupt`
- `/tasks`, `/cron`
- `/tools`
- `/memory`
- `/scout`
- `/agent`
- `/debug`
- `/search`
- `/review`
- `/copy`
- `/export`
- `/open`
- `/status`
- `/doctor`
- `/usage`
- `/config`

Preserve all existing commands. Improve unknown slash handling:

1. Try exact local command.
2. Try alias.
3. Try backend or gateway command.
4. Try CLI command metadata where safe.
5. Return a short, sanitized unavailable message.

Update the slash popup to:

- Show description and argument hint.
- Support Up, Down, Tab, Enter, Esc.
- Keep list navigation working when command names include spaces.
- Provide a way to show more than the default visible suggestions.

Add error sanitization so TUI output never prints raw stack traces, internal tokens, session secrets, workspace IDs, channel user IDs, or uncaught implementation errors.

## Acceptance Criteria

- Slash command metadata is centralized and typed.
- Existing slash commands still work.
- New registry commands appear in the fuzzy menu with descriptions.
- Unknown commands do not crash the TUI.
- Backend or gateway command failures are user-safe.
- Tests cover command matching, aliases, examples, menu navigation, fallthrough, and sanitization.

## Validation

```bash
cd 02-backends/core.carinaai.uk
pnpm check
pnpm exec vitest run src/tui/commands/registry.test.ts src/tui/slash-commands.test.ts src/tui/ink/slash-catalog.test.ts
```
