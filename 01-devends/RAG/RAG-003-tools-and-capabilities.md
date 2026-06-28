# Carina Tools and Capabilities

## Tool System Overview

Carina's tool runtime lives in `src/tools/`. There are 233 tools across 21 capability layers. The active tool surface
exposed to agents is controlled by the toolset configuration (`TOOLSET_MAP` in `toolset.ts`) and
per-session tool resolution.

Four tools are always on for the main agent regardless of configuration:
- `memory` - persistent memory read/write
- `todo` - task list management
- `clarify` - ask the user a clarifying question
- `session-search` - full-text search across past sessions

Leaf agents (subagents spawned by `delegate-task`) exclude: `delegate-task`, `kanban`, `clarify`,
`memory`, `session-search`, `todo`, `email-send`, `code-exec`, `cronjob`, `webhook`,
`checkpoint-manager`, `debug-helpers`, `mixture-of-agents`, `computer-use`.

## Tool Categories

### Terminal and System

| Tool | File | What It Does |
|---|---|---|
| `shell-exec` | `shell.ts` | Full shell execution: foreground, background, PTY modes |
| `process` | `process.ts` | Background process management: start, stop, list, signal |
| `pty-runner` | `pty-runner.ts` | Pseudo-TTY for interactive programs |
| `execute-code` | `execute-code.ts` | Python script execution; scripts can call other tools |
| `sandbox` | `sandbox.ts` | Isolated execution environment |

### File System

| Tool | File | What It Does |
|---|---|---|
| `file` | `file.ts` | Read files with line-numbering and pagination |
| `patch` | `patch.ts` | Targeted find-and-replace with fuzzy matching |
| `search-files` | `search-files.ts` | Ripgrep-backed content and filename search |
| `documents-manage` | `documents-manage.ts` | Document create, update, list operations |
| `notes-manage` | `notes-manage.ts` | Notes management |
| `pdf` | `pdf.ts` | PDF reading and extraction |
| `file-syntax` | `file-syntax.ts` | Syntax validation for code files |

### Browser and Web

| Tool | File | What It Does |
|---|---|---|
| `browser` (session) | `browser/session.ts` | Playwright browser session management |
| `browser` (snapshot) | `browser/snapshot.ts` | Accessibility tree snapshot of page |
| `browser` (nav) | `browser/tools.ts` | Navigate, click, type, scroll, press, get images |
| `computer-use` | `computer-use.ts` | Desktop computer use (screenshot + action) |
| `web-search` | `web-search.ts` | Web search with multiple backend providers |
| `domain-lookup` | `domain-lookup.ts` | DNS and domain information lookup |
| `http` | `http.ts` | Raw HTTP requests |

### Memory and Knowledge

| Tool | File | What It Does |
|---|---|---|
| `memory` | `memory.ts` | Save, search, and retrieve persistent memories |
| `session-search` | `session-search.ts` | Full-text search across all past sessions |
| `todo` | `todo.ts` | Session task list: add, complete, list |
| `checkpoint-manager` | `checkpoint-manager.ts` | Save and restore agent state checkpoints |
| `cache` | `cache.ts` | Tool result caching with TTL |

### Communication and Messaging

| Tool | File | What It Does |
|---|---|---|
| `send-message` | `send-message.ts` | Send messages to any configured channel |
| `email` | `email.ts` | Email read, compose, send |
| `webhook` | `webhook.ts` | HTTP webhook delivery |
| `discord-admin` | `discord-admin.ts` | Discord server management operations |
| `contacts-tool` | `contacts-tool.ts` | Contact management |

### Agent and Orchestration

| Tool | File | What It Does |
|---|---|---|
| `delegate-task` | `delegate-task.ts` | Spawn parallel subagents with isolated contexts |
| `mixture-of-agents` | `mixture-of-agents.ts` | Route queries to multiple models and synthesize |
| `cronjob` | `cronjob.ts` | Schedule recurring tasks with cron syntax |
| `agent-sync-tool` | `agent-sync-tool.ts` | Cross-agent state synchronization |
| `clarify` | `clarify.ts` | Request clarification from the user |

### Media and Creative

| Tool | File | What It Does |
|---|---|---|
| `text-to-speech` | `text-to-speech.ts` | Convert text to audio (MP3) |
| `transcription` | `transcription.ts` | Audio to text transcription |
| `image-generation` | `image-generation.ts` | AI image generation |
| `vision-analyze` | `vision-analyze.ts` | Analyze images with vision models |
| `video-analyze` | `video-analyze.ts` | Analyze video content |
| `video-generation` | `video-generation.ts` | AI video generation |
| `images-gallery` | `images-gallery.ts` | Browse and manage image galleries |
| `spotify` | `spotify.ts` | Spotify playback and search |

### Research and Data Science

| Tool | File | What It Does |
|---|---|---|
| `web-search` | `web-search.ts` | Web search (Brave, Tavily, DuckDuckGo, Serper) |
| `blog` | `blog.ts` | Blog and article retrieval |
| `research` (PSPP) | `research/pspp-tool.ts` | PSPP statistical analysis |
| `research` (R) | `research/r-tool.ts` | R language statistical execution |
| `research` (Jamovi) | `research/jamovi-tool.ts` | Jamovi GUI statistical analysis |
| `research` (SPSS) | `research/spss-syntax-tool.ts` | SPSS syntax generation and parsing |
| `research` (stats) | `research/stats-tools.ts` | General statistical computation |
| `research` (SAV) | `research/sav-tools.ts` | SPSS .sav file read/write |
| `lsp` | `lsp.ts` | Language Server Protocol for code intelligence |

### Security (Cyber Tools)

The security toolset (`security` key in `TOOLSET_MAP`) exposes 80+ cybersecurity tools organized
into categories:

| Category | Tools |
|---|---|
| Reconnaissance | nmap, amass, theHarvester, recon-ng, spiderfoot, sherlock, maltego, dmitry, metagoofil, cewl, shodan, censys, masscan |
| Web Application | nikto, sqlmap, wpscan, whatweb, burpsuite, ffuf, dirsearch, feroxbuster, gobuster, arjun, sstimap |
| Network | curl, netcat, yersinia, tshark, tcpdump, dsniff, responder, scapy |
| Exploitation | metasploit, impacket, hydra, evil-winrm, crackmapexec, mimikatz |
| Password | john, hashcat |
| Wireless | aircrack-ng, bettercap, kismet, wifite, ettercap |
| Forensics | autopsy, volatility3, dc3dd, sleuthkit, binwalk, bulk-extractor, yara, guymager, rekall, foremost, xplico, regripper, hashdeep |
| Reverse Engineering | ghidra, radare2, cutter, ollydbg |
| Vulnerability | nuclei |
| Privacy | anonsurf, tor, mat2, bleachbit |
| SIEM | snort, bloodhound, log2timeline |

Cyber tools are gated by `requireCyberAuth` middleware; the operator must explicitly enable the
security toolset for a session.

### Productivity and Integrations

| Tool | File | What It Does |
|---|---|---|
| `kanban` | `kanban.ts` | Kanban board management |
| `trello` | `trello.ts` | Trello board and card operations |
| `n8n` | `n8n.ts` | n8n workflow automation |
| `mcp` | `mcp.ts` | Model Context Protocol tool execution |
| `phone-control` | `phone-control.ts` | Phone/SMS control |
| `homeassistant-granular` | `homeassistant-granular.ts` | Home Assistant device control |
| `feishu-granular` | `feishu-granular.ts` | Feishu/Lark workspace operations |
| `yuanbao-granular` | `yuanbao-granular.ts` | Yuanbao platform operations |
| `integrations` | `integrations.ts` | Generic third-party integrations |
| `secrets-audit-tool` | `secrets-audit-tool.ts` | Scan for exposed secrets in files |
| `skill-curator-tool` | `skill-curator-tool.ts` | View, create, and manage skill packs |

### Carina-Specific

| Tool | File | What It Does |
|---|---|---|
| `platform` | `platform.ts` | Query Carina platform state and configuration |
| `skills-tools` | `skills-tools.ts` | Invoke and manage skill packs |
| `code` | `code.ts` | Code generation and analysis |
| `theme` | `theme.ts` | UI theme management |
| `propreneur-portfolio` | `propreneur-portfolio.ts` | Propreneur portfolio data access |

## Tool Risk Classification

Tools are assigned risk classes in `tool-risk-registry.ts`:
- `low`: read-only, no side effects (web-search, file-read, memory-read)
- `medium`: writes within the system (memory-write, file-write, email-draft)
- `high`: external side effects (email-send, webhook, shell-exec)
- `critical`: irreversible or destructive (delete operations, cyber exploitation tools)

Scout monitors tool executions and can quarantine individual tools or block entire categories
based on the risk class and the current policy configuration.

## Tool Embedding Selection

The `tool-embedding-select.ts` module selects the most relevant tools for a given query using
vector similarity against tool descriptions. This prevents overwhelming the model's context window
with the full tool manifest when only a subset is relevant to the current task.
