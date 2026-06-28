# SOP 011: Operator TUI
**Classification:** Internal VERLOX only. Do not share externally.
**Source:** Migrated from planning/operations/TUI.md
**Last reviewed:** 2026-06-25

---

# Carina Operator TUI

Launch the full-screen operator TUI:

```bash
carina tui
```

Legacy line-oriented REPL (provider picker, slash commands):

```bash
carina tui --simple
```

The TUI is also accessible from `ops.carinaai.uk` via the Terminal menu item (PTY session over Express/EJS).

## Views

| Key | View | Purpose |
|-----|------|---------|
| 1 | Sessions | Browse recent chat sessions from memory |
| 2 | Tasks | Cron jobs, taskflows, delivery queue, processes summary |
| 3 | Processes | Background shell jobs (`shell-exec background=true`) |
| 4 | Tools | Registered agent tools |
| 5 | Logs | In-session TUI activity log |
| 6 | Chat | Talk to Carina in the active session |

## Keys

- `1`-`6` or `Tab`: switch view
- `j` / `k` or arrow keys: move selection
- `Enter`: run command bar input
- `Ctrl+C`: quit

## Command bar

- `:q` quit
- `:refresh` reload sessions/tasks/processes
- `:open` (Sessions view) open selected session in Chat
- `:kill` (Processes view) stop selected background process
- Type a message in Chat view (or `/slash` commands) and press Enter

## Data sources

The TUI reuses the same modules as CLI and web surfaces:

- `browseRecentSessions` for sessions
- `listJobs`, `listProcesses`, taskflow store for tasks
- `registry.list()` for tools
- `CarinaOrchestrator` for chat turns

No duplicate business logic is embedded in the TUI layer.
