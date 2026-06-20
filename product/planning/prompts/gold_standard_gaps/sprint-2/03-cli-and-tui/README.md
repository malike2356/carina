# Sprint 2 - Category 03: CLI and TUI

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
