# Build Next Checklist

Last updated: 2026-06-10. Living comparison and gap tracker for standalone Carina vs Hermes vs Carina-in-Propreneur.

**Product stance:** Standalone Carina is a **general-purpose** autonomous agent. Domain knowledge (property, healthcare, finance, etc.) is optional via `ACTIVE_SKILL_PACKS`; no vertical pack is active by default.

**Quick status:** Wave 8 (2026-06-10). REM/DREAMS, ops layer, agent workspaces, host/control dashboard, device pairing, inferred commitments. Verified metrics: **71 tools**, **18 channel adapters**, **23 LLM providers**, **16 skill packs**, **96 curated pack skills**, **49 CLI commands**, **5,369 tests** (125 files), build clean.

See also: `prompts/do_this_next.md` for prompt completion matrix.

---

## Standalone Carina vs Hermes vs Carina-in-Propreneur

### Identity

| | Standalone Carina | Hermes | Carina-in-Propreneur |
|---|---|---|---|
| What is it | Open-source agent platform (SaaS-ready) | Open-source agent framework | Embedded Laravel agent |
| Runtime | Node.js/TypeScript, Express | Python, SQLite | PHP 8.3, Laravel 12, pgSQL |
| Version | v0.1.0 (`npm install -g carina`) | Production | Production |
| Code size | Core ~8K + Scout ~15K + Ops ~164K lines TS | ~100K+ lines Python + TS (TUI) | ~80 PHP service files |
| License | MIT | MIT | Proprietary (VERLOX) |
| Install | `npm install -g carina` | `curl ... \| bash` | Laravel composer package |

### Agent architecture

| | Standalone Carina | Hermes | Carina-in-Propreneur |
|---|---|---|---|
| Sub-agents | Yes: `delegate-task` (batch, depth=1, cancel on parent end) | Yes: `delegate_task`, 3 parallel, leaf/orchestrator | No |
| Multi-agent | Orchestrator + delegate-task + kanban | Kanban, delegate_task, tmux spawning | No |
| Tool system | Registry-based, 71 tools (see inventory below) | 99+ tools, auto-discovery | ~80 domain tools |
| Tool dispatch | `tool-runner.ts` | `model_tools.py` | `CarinaModuleToolDispatcher` |
| LLM providers | 23 (cloud + Ollama/LM Studio) + credential pools | 20+ (swap mid-workflow) | 1 (DeepSeek) |

### Security (Carina differentiator)

| | Standalone Carina | Hermes | Carina-in-Propreneur |
|---|---|---|---|
| Prompt injection guard | Yes: Scout 3-layer (regex + LLM judge + tool result scan) | Partial (Tirith) | Yes |
| Kill switch | Yes: Scout emergency stop | No | No built-in |
| Egress filtering | Yes: Scout DLP | No | No |
| Honeypots/deception | Yes: decoy tokens, moving target | No | No |
| Audit logging | Yes: Scout full audit | Basic logging | Yes |
| Rate limiting | Express-rate-limit + Scout policy | API key pools | Per-tenant |
| Real-time dashboard | Carina `/dashboard` + `console.labyrinthscout.com` | No | Filament admin |

### Memory and learning

| | Standalone Carina | Hermes | Carina-in-Propreneur |
|---|---|---|---|
| Persistent memory | Postgres/SQLite/builtin/Mem0 + Redis + pgvector + REM | SQLite FTS5, multiple backends | Session only |
| Session search | Postgres FTS (`session-search`) | FTS5 full-text search | No |
| Skills system | Yes: auto-writer, hub, 16 packs (96 skills), user resources | Yes: 115 skills, curator lifecycle | No |
| Domain packs | Yes: optional packs (property, healthcare, finance, etc.) | No equivalent | 25+ context services (hardcoded) |
| Self-improvement | Skill auto-writer | Creates skills from workflows | No |

### Channels and messaging

| | Standalone Carina | Hermes | Carina-in-Propreneur |
|---|---|---|---|
| Messaging platforms | 18 adapters (Telegram, Discord, Slack, SMS, WhatsApp, Web, CLI, Signal, Matrix, Email, iMessage, WeChat, Feishu, DingTalk, Home Assistant, API, Webhooks; config-dependent) | 15+ (Signal, Matrix, Email, iMessage, etc.) | 6 (Telegram, Slack, Email, WhatsApp, Webhook) |
| Text-to-speech | Yes (`text-to-speech`, Telegram `/speak`, Edge default) | Yes (5 engines) | Yes |
| Speech-to-text | Yes (`transcription` via Whisper) | Yes (faster-whisper, Groq, OpenAI) | Yes |
| Multi-platform delivery | Yes (`send-message` + `discord` tool) | Yes (per-platform config) | Basic |

### Tools and capabilities

| | Standalone Carina | Hermes | Carina-in-Propreneur |
|---|---|---|---|
| Terminal/shell | Yes (fg sandbox + bg + PTY + `process` tool) | Full (fg, bg, PTY, process mgmt) | No |
| Browser automation | Yes (9 Playwright tools + `computer-use`) | Yes (Chrome CDP, Browserbase) | No |
| Vision | Yes (`vision-analyze`) | Yes | Yes (floor plans) |
| Image generation | Yes (`image-generation` DALL-E 3) | Yes | Yes |
| File operations | Yes (read, write, patch, search-files) | Yes (+ patch, ripgrep search) | No shell access |
| Code execution | Yes (Docker sandbox) | Yes (`execute_code` Python) | No |
| Web search | Yes (Brave/Tavily) | Yes (multiple engines) | Yes (Tavily) |
| Cron/scheduling | Yes (`cronjob` tool) | Full cron (chaining, scripts, multi-delivery) | 3 fixed cron entries |
| Webhooks | Yes (inbound + `webhook` subscribe/manage) | Yes (subscribe, manage) | Yes (LabyrinthScout) |
| MCP client | Yes (`mcp` stdio + HTTP) | Yes | No |

### Deployment and ecosystem

| | Standalone Carina | Hermes | Carina-in-Propreneur |
|---|---|---|---|
| CLI | `carina` binary | `hermes` (50+ subcommands) | `php artisan carina:*` |
| IDE integration | Yes (ACP preview at `/acp/prompt`) | VS Code, Zed, JetBrains (ACP) | No |
| Profiles | Yes (`carina profile create/use`) | Yes (isolated instances) | Tenant isolation |
| Credential pools | Yes (`*_API_KEYS` comma pools) | Yes | No |
| Billing | Stripe built-in | No | No |
| Tests | Vitest (5,369 tests) | ~3000 pytest tests | ~60 PHPUnit classes |
| npm package | Yes (`carina`) | No (bash install) | No |

### The real verdict

Standalone Carina is building toward Hermes parity. Phase 2 target was "full Hermes-level tool capability." Foundations are solid: orchestrator, optional skill packs, Scout security, SaaS billing.

**Where Carina is ahead of Hermes**
- Scout security suite (kill switch, egress filtering, honeypots, deception)
- Optional domain pack system (horizontal core + vertical opt-in)
- SaaS-ready: npm package, Stripe billing, hosted API
- Ops panel + Scout SOC dashboard

**Where Hermes may still be ahead** (Hermes figures not audited here)
- Curated skill count in default install (115+ vs Carina's 96 pack skills + hub)
- Longer production history in the wild
- Some channel integrations may be more battle-tested per platform

**Where Carina-in-Propreneur is ahead of both**
- Domain depth: 80 property tools, 25 context services, accountability coach
- Business integration: tenant DBs, Filament admin, mobile API

**Unique bet:** Hermes-level capability + Scout security + optional domain packs + SaaS billing.

---

## Standalone Carina vs Hermes (head to head)

### Foundation

| | Carina | Hermes |
|---|---|---|
| Language | TypeScript (Node.js) | Python |
| Install | `npm install -g carina` | `curl ... \| bash` |
| CLI binary | `carina` | `hermes` (50+ subcommands) |
| Config | `config.yaml` + `.env` | `config.yaml` + `.env` |
| License | MIT | MIT |
| Maturity | v0.1.0 (pre-release) | Production |

### Bottom line

| | Carina | Hermes |
|---|---|---|
| Wins on | Security (Scout), optional domain packs, SaaS readiness, billing, tool depth parity | Channel breadth, skill count, provider count, test scale |
| Best for | Secure, billable agent SaaS with optional vertical packs | Maximum capability today across any domain |

---

## Carina standalone tool inventory (current)

**Always registered (core, 40+):**
`web-search`, `file-read`, `file-write`, `patch`, `search-files`, `shell-exec`, `process`, `http-request`, `email-send`, `email-list`, `code-exec`, `memory`, `session-search`, `text-to-speech`, `transcription`, `vision-analyze`, `image-generation`, `video-generation`, `todo`, `clarify`, `delegate-task`, `cronjob`, `kanban`, `send-message`, `webhook`, `skills-list`, `skill-view`, `skill-manage`, `mcp`, `mixture-of-agents`, `checkpoint-manager`, `debug-helpers`, `homeassistant`, `x-search`, `discord`, `feishu-doc`, `feishu-drive`, `yuanbao`, `computer-use`

**When Playwright available (+9):**
`browser-navigate`, `browser-click`, `browser-type`, `browser-press`, `browser-scroll`, `browser-snapshot`, `browser-console`, `browser-back`, `browser-get-images`

**When `property-uk` pack active (+1):**
`domain_lookup`

**Total:** 71 tools in `TOOLSET_MAP` (includes browser, kanban, integrations, MCP, etc.).

---

## Hermes tools missing from standalone Carina (non-gaming)

Status key: **DONE** | **PARTIAL** | **OPEN** | **SKIP** (policy)

### Subagent and orchestration (4)

| # | Hermes tool | Status | Notes |
|---|---|---|---|
| 1 | `delegate_task` | **DONE** | `delegate-task`; batch, depth=1, parent cancel |
| 2 | `cronjob` | **DONE** | `cronjob` tool + scheduler |
| 3 | `kanban` | **DONE** | Postgres-backed board + assign spawns subagent |
| 4 | `todo` | **DONE** | `todo` tool |

### Browser automation (9)

| # | Hermes tool | Status | Notes |
|---|---|---|---|
| 5-13 | browser_* (9 tools) | **DONE** | Playwright implementation |

### Advanced file operations (2)

| # | Hermes tool | Status | Notes |
|---|---|---|---|
| 14 | `search_files` | **DONE** | `search-files` ripgrep-backed |
| 15 | `patch` | **DONE** | fuzzy find-and-replace with diff |

### Advanced terminal (4)

| # | Hermes tool | Status | Notes |
|---|---|---|---|
| 16 | terminal background mode | **DONE** | `shell-exec background=true` |
| 17 | terminal PTY mode | **DONE** | `pty=true` gated by `CARINA_PTY_ENABLED` + Scout allow |
| 18 | process management | **DONE** | `process` tool (list/poll/log/wait/kill/stdin) |
| 19 | `notify_on_complete` | **DONE** | `notify_on_complete` on shell-exec background |

### Memory and learning (5)

| # | Hermes tool | Status | Notes |
|---|---|---|---|
| 20 | `memory` | **DONE** | persistent facts in Postgres |
| 21 | `session_search` | **DONE** | Postgres FTS |
| 22 | `skill_view` | **DONE** | `skill-view` tool |
| 23 | `skill_manage` | **DONE** | `skill-manage` create/update/delete |
| 24 | `skills_list` | **DONE** | `skills-list` tool |

### Media and audio (5)

| # | Hermes tool | Status | Notes |
|---|---|---|---|
| 25 | `text_to_speech` | **DONE** | Edge default; Telegram `/speak` |
| 26 | `vision_analyze` | **DONE** | `vision-analyze` OpenAI/Anthropic |
| 27 | `image_generation` | **DONE** | `image-generation` DALL-E 3 |
| 28 | `video_generation` | **DONE** | `video-generation` storyboard + optional VIDEO_API_URL |
| 29 | `transcription` | **DONE** | `transcription` Whisper |

### Messaging (1)

| # | Hermes tool | Status | Notes |
|---|---|---|---|
| 30 | `send_message` | **DONE** | `send-message` + `discord` tool |

### MCP and extensibility (1)

| # | Hermes tool | Status | Notes |
|---|---|---|---|
| 31 | native MCP client | **DONE** | `mcp` stdio + HTTP |

### Computer use (1)

| # | Hermes tool | Status | Notes |
|---|---|---|---|
| 32 | `computer_use` | **DONE** | `computer-use` Playwright; Scout gated |

### Platform integrations (6)

| # | Hermes tool | Status | Notes |
|---|---|---|---|
| 33 | `discord` | **DONE** | `discord` agent tool |
| 34 | `feishu_doc` | **DONE** | `feishu-doc` |
| 35 | `feishu_drive` | **DONE** | `feishu-drive` |
| 36 | `homeassistant` | **DONE** | `homeassistant` REST |
| 37 | `x_search` | **DONE** | `x-search` API + web fallback |
| 38 | `yuanbao` | **DONE** | `yuanbao` Hunyuan API + fallback |

### Clarification and interaction (1)

| # | Hermes tool | Status | Notes |
|---|---|---|---|
| 39 | `clarify` | **DONE** | `clarify` tool |

### Security (1)

| # | Hermes tool | Status | Notes |
|---|---|---|---|
| 40 | `checkpoint_manager` | **DONE** | `checkpoint-manager` |

### Misc (2)

| # | Hermes tool | Status | Notes |
|---|---|---|---|
| 41 | `debug_helpers` | **DONE** | `debug-helpers` |
| 42 | `mixture_of_agents` | **DONE** | `mixture-of-agents` |

### Gaming (excluded by policy)

minecraft-bot, pokemon-tcg-pocket, and all gaming-category skills: **SKIP**.

### Cross-agent handoff (excluded by policy)

Hermes/OpenClaw cross-agent collaboration: **SKIP**. Use internal `delegate-task`, cron, skill packs.

---

## Build next priority queue

Ordered by impact for general-purpose parity (non-gaming).

### P1: High impact, reasonable scope

1. **PTY terminal mode** (`phase2-tools/01-terminal`) - security review first
2. **`search_files` + `patch`** - file tool depth
3. **`send_message`** - unified outbound to enabled gateways
4. **Skill tools** (`skill_view`, `skill_manage`, `skills_list`) - expose existing skill system to the agent
5. **`notify_on_complete`** - background process exit alerts

### P2: Medium impact

6. **Vision analyze** - image input in gateways already partially wired
7. **Transcription (STT)** - complement TTS
8. **MCP client** - extensibility
9. **Webhook subscribe/manage** - outbound event subscriptions
10. **Kanban** - multi-agent queue (or document delegate-task as sufficient)

### P3: Platform integrations (pick by demand)

11. Feishu doc/drive, Home Assistant, X search, Yuanbao
12. **Computer use** - desktop automation (high risk; Scout controls required)
13. **Checkpoint manager** - rollback snapshots
14. **Image/video generation**
15. **Mixture of agents**, **debug_helpers**

### P4: Ecosystem maturity

16. **Profiles** - isolated instances
17. **Credential pools**
18. **IDE integration** (ACP)
19. **Provider expansion** beyond 3
20. **Test coverage** toward Hermes scale

---

## Validation commands

```bash
cd core.carinaai.uk
pnpm test          # 5,369 tests
pnpm build
ACTIVE_SKILL_PACKS=core-engineering pnpm cli
```

---

## Local integration test (run when ready)

Prerequisites: Node 22+, Docker (for sandbox), Postgres + Redis (`docker compose up -d` in `core.carinaai.uk`).

```bash
cd core.carinaai.uk

# 1. Install and validate
pnpm install
pnpm test
pnpm build

# 2. Configure (~/.carina/.env)
#    DEEPSEEK_API_KEY=...  (minimum required)
#    DATABASE_URL=postgresql://carina:carina@localhost:5432/carina
#    REDIS_URL=redis://localhost:6379

# 3. First-run setup
pnpm carina setup

# 4. Start CLI agent
pnpm cli
# Try: /model list, ask a question, use tools

# 5. Start web UI + ACP
pnpm carina web
# Open http://localhost:3000
# ACP: curl -X POST http://localhost:3000/acp/prompt -H 'Content-Type: application/json' -d '{"prompt":"hello"}'

# 6. Optional profiles
pnpm carina profile create work
pnpm carina profile use work

# 7. Optional skill packs
ACTIVE_SKILL_PACKS=property-uk,core-engineering pnpm cli

# 8. Optional high-risk features (off by default)
# CARINA_PTY_ENABLED=true CARINA_PTY_SCOUT_ALLOW=true pnpm cli
# CARINA_COMPUTER_USE_ENABLED=true pnpm cli
```

Smoke-test checklist:
- [ ] Agent responds in CLI
- [ ] `file-read` / `search-files` / `patch` work on a test directory
- [ ] `memory` persists across `/clear` vs new session
- [ ] `delegate-task` or `kanban assign` spawns subagent
- [ ] `send-message` reaches Telegram/Discord if configured
- [ ] `webhook` subscribe + test ping fires
- [ ] `mcp connect` to a local MCP server (if available)
- [ ] Scout kill switch blocks session when enabled
