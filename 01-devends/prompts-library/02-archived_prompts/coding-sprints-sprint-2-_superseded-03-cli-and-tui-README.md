# Sprint 2 - Category 03: CLI and TUI


## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`

## What Exists

- `bin/carina.ts` - Global CLI entry with `pnpm cli`
- 49 documented CLI commands as of 2026-06-10
- Basic TUI with session list (Ink-based scaffold)
- `src/gateway/` - WebSocket gateway for session routing

## What Is Missing

- Full Ink TUI with navigation panels (sessions, memory, tools, Scout)
- TUI approval flow for tool execution requiring human sign-off
- TUI operator enhancements (multi-agent view, live log streaming)
- CLI expansion to 150+ commands covering all platform capabilities
- Shell completions (bash, zsh, fish)
- CLI interactive mode (`carina` with no args = TUI)

## Prompts in This Category

- `01-ink-chat-tui.md` - Ink-based chat TUI as default `carina` experience
- `02-tui-approval-flow.md` - In-TUI approval prompts for risky tool calls
- `03-tui-operator-enhancements.md` - Multi-agent view and live log streaming
- `04-cli-expand-150-commands.md` - Expand CLI to 150+ commands
- `05-shell-completions.md` - Bash, zsh, and fish tab completion
- `06-cli-interactive-mode.md` - `carina` with no args enters TUI

## Original Reference

`sprint-2/gap-07-tui-cli/`
