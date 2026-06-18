# Cross-Agent UI, GUI & CLI Deep Analysis

**Agents analyzed:** Hermes Agent (NousResearch), OpenClaw (openclaw), Odysseus (pewdiepie-archdaemon, 72k ⭐)
**Scope:** CLI, TUI, Desktop apps, Web dashboards, Mobile apps, Channel communications, API surfaces
**Date:** 2026-06-16

---

## EXECUTIVE SUMMARY

All three agents ship multiple user surfaces. Hermes has the most (4 surfaces + 20+ channels). OpenClaw has the deepest native integration (macOS + Android + iOS). Odysseus is web-only but has the most mature web UI. Karina needs at minimum CLI + web dashboard + channel support to match the baseline.

---

## 1. SURFACE MATRIX

| Surface | Hermes | OpenClaw | Odysseus | Karina |
|---------|--------|----------|----------|--------|
| CLI | Done:  13,984 lines | Done:  265 files | Done:  Basic | ? |
| TUI (terminal UI) | Done:  Ink/React, 202 files | Done:  37 files | Failed:  | ? |
| Web Dashboard | Done:  React, 97 files, 23 pages | Done:  408 files, full SPA | Done:  Vanilla JS, 4,083 lines, 1 SPA | Done:  Yes |
| Desktop App | Done:  Electron + Tauri | Done:  macOS Swift/SwiftUI (256 files) | Failed:  | ? |
| Mobile App | Failed:  | Done:  Android (Kotlin) + iOS | Failed:  (companion pairing) | Specs written |
| Gateway/API | Done:  16,899 lines | Done:  Gateway + RPC | Done:  54 routes (FastAPI) | Done:  Yes |
| Channels | Done:  20+ platforms | Done:  143 extensions | Failed:  Web only | Telegram |

---

## 2. HERMES AGENT; 4 SURFACES

### 2.1 Classic CLI (`cli.py`; 13,984 lines)

**Tech stack:** Python, prompt_toolkit, Rich

**Features:**
- Rich panels/banners with kawaii spinner faces
- prompt_toolkit input with autocomplete (slash commands, file paths)
- Slash command registry: centralized `COMMAND_REGISTRY` → auto-generates CLI help, Telegram menu, Slack subcommands, desktop palette
- Skin engine: data-driven CLI theming (banner colors, spinner faces, tool prefix, branding)
- Activity feed: `┊` prefixed tool results stream
- Session persistence and resume
- Model switching at runtime

**Key design:**
```
COMMAND_REGISTRY (single source of truth)
    → CLI dispatch (process_command)
    → Gateway dispatch (resolve_command)
    → Telegram BotCommand menu
    → Slack subcommand_map
    → Desktop slash palette
    → Autocomplete
    → CLI help
```

### 2.2 TUI (`ui-tui/`; 202 files)

**Tech stack:** Node.js, Ink (React for terminal), JSON-RPC over stdio

**Architecture:**
```
hermes --tui
  └─ Node (Ink) ←──stdio JSON-RPC──→ Python (tui_gateway)
       │                                    └─ AIAgent + tools + sessions
       └─ renders transcript, composer, prompts, activity
```

**Components (26 React components):**
- `app.tsx`; main app shell
- `messageLine.tsx`; chat message rendering
- `streamingAssistant.tsx` / `streamingMarkdown.tsx`; live streaming
- `thinking.tsx`; tool activity display (spinner + progress)
- `prompts.tsx`; approval/clarify/sudo prompts
- `textInput.tsx`; composer with autocomplete
- `modelPicker.tsx`; model selection
- `agentsOverlay.tsx`; subagent management
- `skillsHub.tsx` / `pluginsHub.tsx`; skill/plugin browsing
- `todoPanel.tsx`; task list
- `activeSessionSwitcher.tsx`; session management
- `branding.tsx`; logo/branding
- `maskedPrompt.tsx`; secret input
- `queuedMessages.tsx`; message queue display
- `helpHint.tsx`; contextual help

**Slash commands in TUI:**
- Built-in client commands handled locally: `/help`, `/quit`, `/clear`, `/resume`, `/copy`, `/paste`
- Everything else → `slash.exec` → `_SlashWorker` subprocess → `command.dispatch` fallback
- Skill commands resolved and injected as user messages (not system prompt; preserves caching)

**Dev experience:**
```bash
cd ui-tui
npm run dev       # watch mode
npm start         # production
npm run build     # full build
```

### 2.3 Desktop App (`apps/desktop/`; 430+ files)

**Tech stack:** Electron + React + nanostore + @assistant-ui/react

**Architecture:**
- Separate chat surface from CLI and dashboard TUI
- Talks to `tui_gateway` backend over JSON-RPC
- Own composer, transcript, slash-command pipeline
- Nano stores for shared state (not component state)

**Composer features:**
- Rich text editor with slash command completions
- @-mention autocomplete
- Voice recording (mic recorder hook)
- Voice conversation mode
- File drop zone with drag-and-drop
- Attachment preview
- Queue panel for batched messages
- Context menu
- URL dialog
- Inline refs

**Slash command pipeline:**
```
Desktop slash palette (curated client-side)
    → isDesktopSlashCommand(name); gates execution
    → isDesktopSlashSuggestion(name); gates discovery/completion
    → Built-ins handled locally or via commands.catalog
    → Everything else → slash.exec → command.dispatch
    → Skills resolved as normal prompts
```

**Desktop-specific pages:**
- Agents management
- Artifacts browser
- Chat with all composer features

### 2.4 Web Dashboard (`web/src/`; 97 files, 23 pages)

**Tech stack:** React, xterm.js (for embedded TUI)

**Pages:**
- `ChatPage.tsx`; embedded `hermes --tui` via PTY bridge (not a React reimplementation)
- `SessionsPage.tsx`; session browser
- `CronPage.tsx`; scheduled jobs management
- `SkillsPage.tsx`; skill browser/editor
- `PluginsPage.tsx`; plugin management
- `ModelsPage.tsx`; model/provider config
- `ConfigPage.tsx`; configuration editor
- `ChannelsPage.tsx`; channel/platform management
- `ProfilesPage.tsx`; profile management
- `LogsPage.tsx`; log viewer
- `AnalyticsPage.tsx`; usage analytics
- `DocsPage.tsx`; documentation browser
- `WebhooksPage.tsx`; webhook management
- `McpPage.tsx`; MCP server management
- `SystemPage.tsx`; system health
- `FilesPage.tsx`; file browser
- `EnvPage.tsx`; environment variables
- `PairingPage.tsx`; device pairing
- `ProfileBuilderPage.tsx`; profile creation wizard

**Key components:**
- `ChatSidebar.tsx`; session list sidebar
- `ModelPickerDialog.tsx`; model selection modal
- `SkillEditorDialog.tsx`; skill editing modal
- `ToolsetConfigDrawer.tsx`; toolset configuration
- `ScheduleBuilder.tsx`; cron schedule builder
- `AuthWidget.tsx`; authentication status
- `OAuthLoginModal.tsx` / `OAuthProvidersCard.tsx`; OAuth management
- `LanguageSwitcher.tsx`; i18n (10 languages)
- `ThemeSwitcher.tsx`; theme switching
- `ProfileSwitcher.tsx`; profile switching

**PTY Bridge (dashboard chat):**
```
Browser loads ChatPage.tsx
  → xterm.js Terminal with WebGL renderer
  → /api/pty WebSocket endpoint
  → Server spawns hermes --tui through ptyprocess
  → Raw PTY bytes each direction
  → Resize via TIOCSWINSZ
```

### 2.5 Gateway & Channels (`gateway/run.py`; 16,899 lines)

**20+ platform adapters:**
```
Telegram, Discord, Slack, WhatsApp (+ Cloud API), Signal, Matrix,
Mattermost, Email, SMS, DingTalk, WeCom, WeChat, Feishu,
QQ Bot, BlueBubbles (iMessage), Home Assistant, Webhook, API Server,
Yuanbao, Microsoft Graph Webhook
```

**Channel architecture:**
- Each platform is a separate adapter file
- Base class provides shared functionality
- Platform-specific: inbound parsing, outbound formatting, media handling
- Session binding per platform
- Operator sessions: single session key across platforms
- Platform-specific formatting hints injected into system prompt

---

## 3. OPENCLAW; 5 SURFACES + 143 EXTENSIONS

### 3.1 CLI (`src/cli/`; 265 files)

**Tech stack:** Node.js, Commander-style CLI with programmatic registration

**Architecture:**
```
program/
  build-program.ts → command-registry-core.ts → command-tree.ts
    → register.configure, register.onboard, register.setup
    → register.agent, register.agent-turn
    → register.message (send, broadcast, reactions, polls, pins, thread)
    → register.backup, register.maintenance, register.migrate
    → register.status-health-sessions, register.transcripts
    → register-lazy-command (lazy loading)
    → subcli-descriptors → register-subclis
```

**Key CLI commands:**
- `openclaw onboard`; first-run setup wizard
- `openclaw configure`; configuration management
- `openclaw doctor --fix`; self-repair
- `openclaw gateway`; gateway lifecycle (start, stop, restart, status)
- `openclaw message send`; send messages to channels
- `openclaw agent`; agent management
- `openclaw cron`; scheduled jobs
- `openclaw plugins`; plugin install/search/update/uninstall
- `openclaw skills`; skill management
- `openclaw security`; security tools
- `openclaw nodes`; device node management (pairing, camera, location, notify, push, screen)
- `openclaw update`; self-update with restart
- `openclaw tui`; launch TUI
- `openclaw sandbox`; sandbox management
- `openclaw webhooks`; webhook management
- `openclaw completion`; shell completions (fish, zsh, bash)
- `openclaw devices`; device management
- `openclaw mcp`; MCP server management

**Daemon lifecycle:**
```
daemon-cli/
  lifecycle.ts → install, start, stop, restart
  probe.ts → health checking
  status.ts → status gathering and printing
  start-repair.ts → auto-repair on startup
  launchd-recovery.ts → macOS launchd integration
  gateway-token-drift.ts → token synchronization
```

### 3.2 TUI (`src/tui/`; 37 files)

**Tech stack:** Node.js terminal UI

**Components:**
- `chat-log.ts`; message log display
- `assistant-message.ts` / `user-message.ts`; message rendering
- `markdown-message.ts` / `hyperlink-markdown.ts`; markdown with OSC8 hyperlinks
- `tool-execution.ts`; tool call display
- `custom-editor.ts`; external editor integration
- `searchable-select-list.ts` / `filterable-select-list.ts` / `fuzzy-filter.ts`; selection UIs
- `selectors.ts`; prompt-based selection
- `btw-inline-message.ts`; inline status messages

**Features:**
- Gateway-connected or local-run modes
- PTY-backed terminal
- Session list with fuzzy search
- Stream assembly for live responses
- OSC8 hyperlinks (clickable links in terminal)
- Last session resume
- Embedded backend for local runs

### 3.3 Web UI (`ui/src/`; 408 files)

**Tech stack:** Lit (Web Components), TypeScript

**i18n:** 20 languages
```
ar, de, en, es, fa, fr, id, it, ja-JP, ko, nl, pl,
pt-BR, th, tr, uk, vi, zh-CN, zh-TW
```

**Architecture:**
```
ui/src/ui/
  app.ts; main app shell
  app-chat.ts; chat interface
  app-settings.ts; settings panel
  app-channels.ts; channel management
  app-render.ts; render loop
  app-view-state.ts; view state management
  app-lifecycle.ts; app lifecycle
  app-gateway.ts; gateway connection
  app-events.ts; event handling
  app-polling.ts; polling for updates
  app-scroll.ts; scroll management
  app-tool-stream.ts; tool output streaming
  app-native-bridge.ts; native app bridge
  app-render-usage-tab.ts; usage metrics tab
  activity-model.ts; activity tracking
  assistant-identity.ts; assistant identity display
  browser-redact.ts; browser content redaction
  canvas-url.ts; canvas URL handling

chat/
  build-chat-items.ts; message list building
  chat-avatar.ts; avatar display
  chat-queue.ts; message queue
  chat-sidebar-raw.ts; raw sidebar
  chat-welcome.ts; welcome screen
  composer-persistence.ts; draft persistence
  context-notice.ts; context warnings
  copy-as-markdown.ts; export
  deleted-messages.ts; deleted message handling
  export.ts; chat export
  grouped-render.ts; grouped message rendering
  heartbeat-display.ts; heartbeat indicators
  input-history.ts; input history
  message-extract.ts; message extraction
```

### 3.4 macOS App (`apps/macos/`; 256 Swift files)

**Tech stack:** Swift, SwiftUI, AppKit

**Components:**
- `AppState.swift`; centralized app state
- `AgentWorkspace.swift` / `AgentWorkspaceConfig.swift`; agent management
- `AgentEventStore.swift` / `AgentEventsWindow.swift`; event monitoring
- `CanvasManager.swift` / `CanvasWindowController.swift`; canvas/artifact system
- `CameraCaptureService.swift`; camera integration
- `AudioInputDeviceObserver.swift`; audio device monitoring
- `ChannelConfigForm.swift` / `ChannelsSettings+ChannelSections.swift`; channel config
- `AboutSettings.swift`; about/settings
- `AppNavigationActions.swift`; navigation
- `AgeFormatting.swift`; formatting utilities

**Native capabilities:**
- System tray integration
- Native notifications
- TCC permissions (camera, mic, files)
- Launch at login
- Full accessibility tree support

### 3.5 Android App (`apps/android/`)

**Tech stack:** Kotlin, Android SDK

**Components:**
- `NodeApp.kt`; main application
- `ConnectionManager.kt`; gateway connection
- `GatewayEventHandler.kt`; event handling
- `CanvasController.kt` / `A2UIHandler.kt`; canvas UI
- `CameraHandler.kt` / `CameraCaptureManager.kt`; camera
- `LocationHandler.kt` / `LocationCaptureManager.kt`; location
- `PhotosHandler.kt` / `JpegSizeLimiter.kt`; photos
- `ContactsHandler.kt`; contacts
- `CalendarHandler.kt`; calendar
- `SystemHandler.kt`; system info
- `MotionHandler.kt`; motion sensors
- `NotificationsHandler`; notification relay
- `SmsHandler.kt` / `CallLogHandler.kt`; SMS/call integration
- `InvokeDispatcher.kt`; remote command execution
- `ToolDisplay.kt`; tool output display

**Features:**
- Background service for persistent connection
- Sensor access (camera, location, motion)
- System integration (SMS, calls, calendar, contacts, notifications)
- Canvas UI for agent-generated content
- Secure preferences for credential storage

### 3.6 Channels & Extensions (143 total)

**Messaging channels** (subset of 143):
```
telegram, discord, slack, whatsapp, signal, matrix, imessage,
irc, nextcloud-talk, feishu, nostr, sms
```

**Provider extensions:**
```
openai, anthropic, google, deepseek, alibaba, amazon-bedrock,
cerebras, chutes, cloudflare-ai-gateway, codex, copilot,
deepinfra, groq, mistral, ollama, perplexity, together,
xai, byteplus, arcee, venice
```

**Tool extensions:**
```
browser, canvas, comfy (image gen), brave (search), deepgram (STT),
azure-speech (TTS), active-memory, clickclack (keyboard)
```

**Infrastructure:**
```
admin-http-rpc, bonjour (discovery), codex-supervisor,
device-pair, copilot-proxy
```

---

## 4. ODYSSEUS; 1 SURFACE (Web) + Companion Pairing

### 4.1 Web UI (`static/`)

**Tech stack:** Vanilla JavaScript (4,083 lines), FastAPI backend, Jinja2 templates

**Architecture:** Single-page application
- `static/index.html`; main app shell
- `static/app.js`; 4,083 lines of vanilla JS (no framework)
- `static/style.css`; all styles
- `static/login.html`; login page

**Dependencies (loaded from CDN/lib):**
- `highlight.min.js`; code highlighting
- `html2pdf.bundle.min.js`; PDF generation
- `mammoth.browser.min.js`; DOCX rendering
- `docx.umd.min.js`; DOCX creation
- `xlsx.full.min.js`; Excel handling
- `qrcode.min.js`; QR code generation

**PWA support:**
- `manifest.json`; PWA manifest
- `sw.js`; service worker
- Icons: 192px, 512px, maskable 512px

### 4.2 API Routes (54 routes; FastAPI)

```
auth_routes, assistant_routes, chat_routes, session routes,
document routes, calendar_routes, contacts_routes, email routes,
notes routes, tasks routes, backup_routes, cleanup_routes,
cookbook_routes (model serving), research routes, compare routes,
codex_routes, copilot_routes, device_flow, diagnostics_routes,
mcp routes, webhook routes, api_token_routes, admin_wipe_routes,
chatgpt_subscription_routes
```

### 4.3 Companion Pairing (`companion/`)

**Purpose:** Let a phone client discover and pair with the Odysseus server over LAN.

**Flow:**
1. Phone discovers server via LAN
2. Admin approves pairing in web UI
3. Phone gets a `ody_` Bearer token
4. Token is scoped to the admin's identity
5. Phone uses the API directly; no separate mobile app needed

### 4.4 CLI (Basic)

Odysseus has a basic CLI via `scripts/odysseus-personal` for personal document management. Not a full agent CLI.

---

## 5. COMPARATIVE ANALYSIS

### 5.1 Surface Coverage

| Feature | Hermes | OpenClaw | Odysseus |
|---------|--------|----------|----------|
| CLI depth | Deep (14K lines) | Deep (265 files) | Minimal |
| TUI quality | High (Ink/React, 202 files) | Moderate (37 files) | None |
| Web dashboard | Full (23 pages) | Full (408 files, SPA) | Full (vanilla JS) |
| Desktop native | Electron (430 files) + Tauri | macOS SwiftUI (256 files) | None |
| Mobile native | None | Android (Kotlin) + iOS | None (companion only) |
| Gateway/API | 16,899 lines | Gateway + RPC | 54 FastAPI routes |
| Channels | 20+ platforms | 143 extensions (15+ channels) | Web only |

### 5.2 Architectural Patterns

| Pattern | Hermes | OpenClaw | Odysseus |
|---------|--------|----------|----------|
| UI framework | React (web + desktop), Ink (TUI) | Lit (web), SwiftUI (macOS), Kotlin (Android) | Vanilla JS |
| State management | nanostore (desktop), hooks (TUI) | Custom app-state | DOM-based |
| i18n | 10 languages (YAML on server, TS on desktop) | 20 languages (Lit i18n) | None |
| Streaming UI | Done:  x3 surfaces | Done:  all surfaces | Done:  web SSE |
| Dark mode | Done:  theming engine | Done:  | Done:  CSS |
| Responsive | Desktop + web | Desktop + web + mobile | Web (PWA) |
| Accessibility | PTY bridge preserves terminal | Full a11y tree (macOS) | Basic |

### 5.3 Channel Communication Depth

| Feature | Hermes | OpenClaw | Odysseus |
|---------|--------|----------|----------|
| Channels | 20+ adapters | 15+ channels via extensions | 0 (web only) |
| Channel format | Platform-specific adapters | Portable presentation actions | N/A |
| Cross-platform sessions | Done:  Operator sessions | Done:  Session keys | N/A |
| Native approval | N/A | Done:  Approval cards per channel | N/A |
| Media handling | Per-platform attachment formatting | Universal media payload | N/A |
| Channel health | Gateway-level | Done:  channel-health-monitor | N/A |

---

## 6. WHAT KARINA SHOULD ADOPT

### Immediate (Phase 1)

1. **CLI**; Copy Hermes' slash command registry pattern. Single source of truth for all commands, auto-generated for every surface.
2. **Web Dashboard**; Karina has one. Add Hermes-style pages: sessions, skills, models, config, logs, analytics.
3. **Channel support**; At minimum: Telegram (has), Discord, Slack. Hermes has platform adapter files ready to study.

### Near-term (Phase 2)

4. **TUI**; Hermes' Ink/React pattern is proven. 202 files, JSON-RPC transport, full streaming.
5. **Desktop app**; Hermes' Electron or OpenClaw's SwiftUI. Electron is faster to ship, SwiftUI is better UX.
6. **i18n**; Hermes has 10 languages, OpenClaw has 20. Karina should start with 3-5.

### Long-term (Phase 3+)

7. **Mobile app**; OpenClaw's Android Kotlin app with sensor integration. Or Odysseus' companion pairing (simpler, works for any phone).
8. **Plugin marketplace**; OpenClaw's ClawHub pattern. Public registry for Karina skills and tools.
9. **Native desktop**; OpenClaw's SwiftUI macOS app for best UX.

### Adoption Strategy: Progressive Enhancement

```
Month 1: CLI (Hermes pattern) + existing web dashboard + existing Telegram
Month 2: Add Discord + Slack channels (Hermes adapter pattern)
Month 3: TUI (Hermes Ink pattern)
Month 4: i18n for web dashboard
Month 5: Desktop app (Electron or Tauri)
Month 6+: Mobile app or companion pairing
```

---

## 7. UI FILE COUNT SUMMARY

| Agent | CLI files | TUI files | Web files | Desktop files | Mobile files | Total UI |
|-------|-----------|-----------|-----------|---------------|--------------|----------|
| Hermes | 1 (14K lines) | 202 | 97 | 430+ | 0 | **730+** |
| OpenClaw | 265 | 37 | 408 | 256 (Swift) | Android app | **966+** |
| Odysseus | 0 | 0 | 3 (vanilla JS) | 0 | 0 | **3** |

**Hermes total UI investment:** ~730 files across 4 surfaces
**OpenClaw total UI investment:** ~966 files across 5 surfaces + native apps
**Odysseus total UI investment:** 3 files (SPA), but most polished web UX per line of code

---

## NOTES

- Hermes' slash command registry is the single best pattern to adopt; define once, auto-generate for CLI, Telegram, Slack, desktop, web
- OpenClaw's 20-language i18n is impressive but overkill for Karina; start with 3
- Odysseus proves you can ship a polished web UI in 4,083 lines of vanilla JS; no framework needed
- Hermes' PTY bridge (embedding TUI in web dashboard) is clever; write the chat experience once in Ink, use it everywhere
- OpenClaw's Android app with full sensor integration is the gold standard for mobile agent apps
- All three agents agree: the chat transcript is the primary UI primitive; everything else is supporting panels
