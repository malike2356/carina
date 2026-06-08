# TOOLS.md — Complete Tool List to Implement

Every tool Hermes has that Carina must replicate. Ordered by implementation priority.

---

## PHASE 2 TOOLS

### Terminal (Week 6-7)

```
terminal
  Description: Execute shell commands
  Modes: foreground, background, PTY (interactive)
  Features:
    - Timeout configurable per command
    - Working directory override
    - Background mode with notification on completion
    - Watch patterns for mid-process triggers
    - PTY mode for interactive CLIs (REPL, Claude Code, Cursor)

process
  Description: Manage background processes
  Actions: list, poll, wait, kill, write, submit, close
  Features:
    - Poll for status and new output
    - Wait with timeout
    - Send raw stdin without newline (write)
    - Send data + Enter for answering prompts (submit)
    - Close stdin / send EOF
    - Log viewing with pagination (offset + limit)

read_file
  Description: Read text files with line numbers
  Features:
    - Line-numbered output (LINE_NUM|CONTENT)
    - Pagination (offset + limit)
    - 100K char read cap
    - Suggests similar filenames if not found

write_file
  Description: Write content to file (overwrite)
  Features:
    - Creates parent directories automatically
    - Auto-runs syntax checks on .py, .json, .yaml, .toml
    - Only reports NEW errors introduced by the write

patch
  Description: Targeted find-replace edits
  Features:
    - 9 fuzzy matching strategies
    - Replace or replace_all modes
    - Returns unified diff
    - Auto-runs syntax checks after editing

search_files
  Description: Search file contents or find files by name
  Backend: ripgrep
  Modes:
    - content: regex search inside files
    - files: find files by glob pattern
  Features:
    - File glob filtering
    - Context lines before/after matches
    - Output modes: content, files_only, count
    - Pagination (offset + limit)

execute_code
  Description: Run Python scripts that call tools programmatically
  Features:
    - Import tools: read_file, write_file, search_files, patch, terminal
    - 5-minute timeout, 50KB stdout cap, 50 tool calls per script
    - Runs in session working directory with active venv
    - Use for: loops, conditionals, batching, retry logic
```

### Browser (Week 8-9)

```
browser_navigate
  Description: Navigate to URL
  Features:
    - Initializes browser session
    - Returns compact page snapshot with interactive elements and ref IDs
    - Plain-text endpoints prefer curl (faster)

browser_click
  Description: Click element by ref ID from snapshot

browser_type
  Description: Type text into input field by ref ID
  Features: Clears field first, then types

browser_press
  Description: Press keyboard key (Enter, Tab, Escape, ArrowDown)

browser_scroll
  Description: Scroll page up or down

browser_snapshot
  Description: Get text-based accessibility tree snapshot
  Modes: compact (interactive elements) or full (complete page)

browser_console
  Description: Get browser console output + JavaScript errors
  Features:
    - Reads console.log/warn/error/info
    - Executes JavaScript expressions in page context (DOM inspection)
    - Clear buffer option

browser_back
  Description: Navigate back in browser history

browser_get_images
  Description: List all images on page with URLs and alt text
```

### Subagents + Cron (Week 10)

```
delegate_task
  Description: Spawn subagents for parallel work
  Features:
    - Up to 3 concurrent subagents
    - Each gets isolated context + terminal session + toolset
    - Single task mode (goal + context)
    - Batch/parallel mode (tasks array)
    - Configurable per-task toolsets
    - Results returned as array
    - Leaf subagents can't delegate further (configurable depth)

cronjob
  Description: Schedule recurring tasks
  Actions: create, list, update, pause, resume, remove, run
  Features:
    - Cron syntax scheduling (30m, every 2h, 0 9 * * *, ISO timestamp)
    - Self-contained prompts (runs in fresh session)
    - Optional skills attached to job
    - Multi-channel delivery (auto-detect, origin, all, or specific)
    - Background scripts (bash/Python watchdogs)
    - no_agent mode (script-only, LLM skipped)
    - Job chaining via context_from
    - Per-job model override
    - Per-job toolset restriction
    - Working directory override
    - Profile-based execution
```

### Memory (Week 11)

```
session_search
  Description: Search past sessions stored in local DB
  Backend: FTS5 SQLite
  Shapes:
    - DISCOVERY: query + limit (returns top N sessions)
    - SCROLL: session_id + around_message_id + window
    - BROWSE: no args (recent sessions chronologically)
  Features:
    - FTS5 with AND/OR/NOT/quoting/wildcards
    - Dedup by session lineage
    - Snippets with highlighted match excerpts
    - Bookends (first/last messages of session)
    - Role filtering (user, assistant, tool)
    - Sort: newest, oldest, or relevance

memory
  Description: Save durable information across sessions
  Actions: add, replace, remove
  Targets: user (profile), memory (agent notes)
  Features:
    - Compact entries (2,200 char limit total)
    - Injected into every future turn
    - Priority: preferences > environment > procedural
```

---

## PHASE 1 TOOLS (Already built or close)

### Tool Handlers (Propreneur-v2 Carina service)

```
EmailToolHandler
  Tools: parse_inbound_email, get_recent_email_activity

PortfolioToolHandler (modified)
  Tools: get_portfolio_summary (added)

CrmToolHandler (modified)
  Tools: log_voice_instruction (added)

FloorPlanToolHandler
  Tools: analyze_floor_plan, generate_boq, compare_refurb_scenarios

TelegramBotService
  Methods: sendMessage, sendAudio, sendDocument, getFile

TextToSpeechService
  Method: generate (text → MP3 via edge-tts)

CarinaScheduledAgentDelivery
  Method: deliver (text + audio via Telegram)
```

### API Endpoints

```
POST /api/telegram/webhook
POST /api/mobile/v1/auth/login
POST /api/mobile/v1/auth/logout
GET  /api/mobile/v1/user/profile
PUT  /api/mobile/v1/preferences
POST /api/mobile/v1/chat/send
POST /api/mobile/v1/chat/voice
POST /api/mobile/v1/chat/image
GET  /api/mobile/v1/portfolio/summary
GET  /api/mobile/v1/portfolio/properties
GET  /api/mobile/v1/portfolio/properties/{id}
GET  /api/mobile/v1/compliance/status
GET  /api/mobile/v1/compliance/items
GET  /api/mobile/v1/briefing/latest
GET  /api/mobile/v1/briefing/audio
POST /api/mobile/v1/notifications/register
POST /api/floor-plans/upload
GET  /api/floor-plans/{id}
POST /api/floor-plans/{id}/generate-boq
POST /api/floor-plans/compare
```

### Jobs

```
HandleRentStatement
HandleMaintenanceReport
HandleAccountantReport
HandleTenantUpdate
ProcessTelegramMessage
AnalyseFloorPlan
```

### Commands

```
emails:process
telegram:register-webhook
carina:scheduled-agent (daily-portfolio-summary task)
```

---

## TOOL COUNT SUMMARY

| Phase | Tool Category | Count |
|---|---|---|
| 1 | Existing tools | 20+ |
| 2 | Terminal + File | 7 |
| 2 | Browser | 9 |
| 2 | Subagents + Cron | 2 |
| 2 | Memory | 2 |
| **Total** | | **40+** |
