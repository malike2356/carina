# Prompt 03: TUI Operator Enhancements


## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`

## Context

Building on top of the base TUI (Prompt 01), the operator-focused enhancements add:
multi-agent session monitoring, live log streaming, Scout status indicator, and quick
action shortcuts. These features are used by security operators running multiple concurrent
Carina sessions.

## What to Build

### 1. Multi-agent view

Add an "Agents" tab to the TUI tab bar. The agents view shows all active agent sessions
with their current status:

```
+------------------------------------------+
| [S] Sessions [A] Agents [M] Memory       |
+------------------------------------------+
| Active Agents                            |
|                                          |
| ID           Status        Duration      |
| abc-123      RUNNING       00:02:14      |
|   Tool: nmap (running)                   |
| def-456      WAITING       00:00:03      |
|   Waiting for approval: delete-file      |
| ghi-789      DONE          00:01:47      |
|   Completed: scan report saved           |
|                                          |
| [Enter] Focus agent  [K] Kill agent      |
+------------------------------------------+
```

Pull agent status from `GET /api/ops/agents` (add this endpoint to the ops API).

### 2. Live log streaming

Press L in any session to open a live log panel below the chat:
```
+------------------------------------------+
| Chat                                     |
| ...                                      |
+------------------------------------------+
| Logs (live)                Ctrl+L close  |
| [12:34:01] nmap: starting scan           |
| [12:34:02] nmap: scanning 192.168.1.0/24 |
| [12:34:15] nmap: 3 hosts up              |
| [12:34:15] nmap: done                    |
```

The log panel tails `data/logs/shell.log` via the `/api/logs/tail` SSE endpoint (Server-Sent
Events for streaming). The TUI connects to SSE using `EventSource` polyfill for Node.js.

### 3. Scout status chip

Top-right corner of TUI shows Scout connection status:
```
Scout: [CONNECTED 87/100]
```
- Green text when connected: shows current Scout Score
- Amber when score < 60
- Red when disconnected or score < 30

Refresh every 30 seconds via `GET /api/scout/score` (proxy from Scout at `SCOUT_URL`).

### 4. Quick action shortcuts

| Shortcut | Action |
|----------|--------|
| Ctrl+R | Run a quick shell command (PTY single-command mode, output in chat) |
| Ctrl+S | Search sessions and memory (opens a fuzzy search overlay) |
| Ctrl+A | Show agents view |
| Ctrl+L | Toggle live log panel |
| Ctrl+K | Kill current agent / cancel streaming |
| F1 | Open Scout dashboard URL in default browser |
| F2 | Open ops admin panel URL in default browser |

### 5. Config file for TUI preferences

Create `~/.carina/tui.json`:
```json
{
  "defaultView": "chat",
  "logPanel": false,
  "scoutRefreshInterval": 30,
  "compactMode": false
}
```

`compactMode: true` hides the left session panel and uses the full width for chat.

## Verification Checklist

- [ ] Ctrl+A opens agents tab showing all running sessions with status
- [ ] Ctrl+L opens live log panel below chat, new log lines appear in real time
- [ ] Scout chip shows score or "DISCONNECTED" if Scout is down
- [ ] F1 opens `http://localhost:4444` in default browser
- [ ] Config file at `~/.carina/tui.json` is respected on startup

## Files to Create or Modify

- MODIFY `src/tui/TuiApp.tsx` - add Agents tab, Scout chip, keyboard shortcuts
- CREATE `src/tui/AgentsView.tsx`
- CREATE `src/tui/LogPanel.tsx`
- CREATE `src/tui/ScoutChip.tsx`
- CREATE `src/api/agents.ts` - ops-gated agent status API
- MODIFY `src/server.ts` - add log tail SSE endpoint
