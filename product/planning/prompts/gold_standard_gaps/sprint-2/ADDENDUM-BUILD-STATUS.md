## ADDENDUM — 2026-06-20: BUILD STATUS

**STATUS: ALL 12 SPRINT-2 SECTIONS AUDITED**

### 01-Deployment (4/4 FULLY BUILT)
- Dockerfile with supervisord CMD, HEALTHCHECK, logrotate, and container supervisor configs
- VPS supervisor templates in `docker/supervisor/vps/`; container configs in `docker/supervisor/container/`
- Graceful shutdown in `src/index.ts` (SIGTERM/SIGINT, 25s force exit, DB pool drain)
- One-command deploy: `docker/scripts/deploy-prod.sh`; TLS via certbot + `init-certs.sh` + nginx bootstrap

### 02-Web-UI (4/9 FULLY BUILT)
- **BUILT:** PTY bridge (`api/terminal-ws.ts`, 111 lines), MCP management (`api/mcp-api.ts`, `mcp/server/`), file browser (`tools/file.ts`), locale API (`api/locale-api.ts`, 62 lines)
- **PARTIAL:** i18n 20 languages — API exists but translation coverage uncertain
- **NOT BUILT:** Env vars editor, window docking, capability badges (delegated to gap-13 P06), writing style consistency (gap-13 P07), CI guard (gap-13 P08)

### 03-CLI-TUI (5/6 FULLY BUILT)
- **BUILT:** Ink chat TUI (`tui/ink/start.ts`, 19 components: AssistantMessage, StreamingMessage, ToolCallBlock, ThinkingBlock, InputBar, FuzzySlashMenu, ModelPicker, SessionSwitcher, StatusBar, HistorySearch, Banner, etc.), TUI approval flow (`tui/ink/types/approval.ts`, `tui/ink/components/approval/`), operator enhancements (`tui/operator/` with fuzzy filter, hyperlinks, external editor), CLI commands (`gateway/commands.ts`, `cli/commands/` directory), interactive mode (`gateway/cli.ts`)
- **NOT BUILT:** Shell completions

### 04-Desktop (4/5 FULLY BUILT)
- **BUILT:** Tauri scaffold (`src-tauri/` with capabilities, icons, Rust backend), composer pages (React with Monaco editor, hooks, store), native integration (Tauri + store), Carina features (desktop-specific poller, store, lib)
- **NOT BUILT:** Offline sync

### 05-Mobile (2/5 FULLY BUILT)
- **BUILT:** Background WebSocket (`src/hooks/`, WebSocket client), push notifications (iOS NotificationService extension, Expo push)
- **PARTIAL:** Microphone/audio pipeline (plugins exist but voice streaming not confirmed), SMS/call relay (not built)
- **NOT BUILT:** Camera/activity recognition

### 09-Skills-Hub (5/5 FULLY BUILT)
- **BUILT:** Security scanner (`hub-security-scanner.ts`), peer review (`hub-reviews.test.ts`), marketplace website (`marketplace-*` 10 files: catalog, install, validate, store, types, registry, builtin), CLI publish (`publish-pack.ts`), hub deployment (`hub/server.ts`, registry, migrations)

### 11-Workspace (4/9 FULLY BUILT)
- **BUILT:** Memory continuity (`memory/` with SQLite/Postgres/Redis/Mem0/Honcho backends, REM cycles), distro runtime (`workspaces/` with agent registry, routing, bootstrap), Abbis distro proof (`carina-agent-public` npm package with 200+ source files), developer release (scripts: `publish-carina-agent.sh`, `deploy-carina.sh`, `bootstrap-carina-community.sh`)
- **PARTIAL:** Launcher redesign (exists in `apps/cloud/src/components/launcher/` and `(launcher)` route but may not match spec), distro CLI commands (CLI exists with 40+ commands but distro-specific commands uncertain)
- **NOT BUILT:** Distro module scaffolder, shared UI package, Propreneur distro

### 12-Voice (1/7 FULLY BUILT)
- **BUILT:** TTS tool (`tools/text-to-speech.ts`, `utils/tts.ts` with OpenAI TTS)
- **PARTIAL:** Mobile foundation audio (Expo audio hooks exist but voice pipeline not wired)
- **NOT BUILT:** Wake word/VAD, streaming voice pipeline, personality tone module, PSTN telephony, voice gateway protocol, Scout voice monitoring
- **Note:** This section is genuinely in planning stage. The 67KB roadmap document (`CARINA_VOICE_AGENT_ROADMAP.md`) is ambitious and mostly unbuilt.

### Additional Built (not in sprint-2 prompts)
- **IDE extensions:** VS Code (`carina-ide/`), JetBrains (`carina-jetbrains/`) — both exist
- **Public SDK:** `carina-agent-public` npm package with full agent, billing, memory, skills, gateway, security, tools, workspaces — 200+ source files
- **ACP protocol:** `src/acp/acp-server.ts`, `src/gateway/acp.ts`, `src/gateway/acp-ide.ts`
- **Multi-platform gateways:** Telegram, Discord, Slack, WhatsApp, SMS, IRC, Web, CLI, ACP, Signal, Matrix, Mattermost, DingTalk, WeChat, Feishu, HomeAssistant — 16+ channels
