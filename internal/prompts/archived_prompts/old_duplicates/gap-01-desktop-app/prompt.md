# Gap 1: Desktop Application; Full Build Prompt

**Date revised:** 2026-06-18
**Status:** Missing (no Tauri app exists)
**Reference agents:** Hermes (Electron, 430 files), OpenClaw (macOS SwiftUI, 256 files)
**Target:** Cross-platform desktop app (Tauri + React) adopting patterns from all three agents
**Reuse rule:** adopt the behavior, not the source phrasing. Carina copy, labels, prompts, and comments must be rewritten in Carina voice.

> Read `00-PRE-WORK-ALIGNMENT.md` Gap 1 section before starting. Pre-work checklist updated with LSP client and pairing backend which now exist and affect features 19-20 below.

**NEW since original prompt:**
- `src/lsp/client.ts` exists; connect this in the desktop composer for code assistance (see feature 19)
- `src/pairing/pairing.ts` exists; use for the companion pairing settings page (see feature 20)
- `src/surfaces/index.ts` exists; register desktop as a new surface type here before building

---

## SPECIFICATION

### Architecture (Tauri + React)
Adopt Hermes' multi-app architecture pattern. The desktop app is a SEPARATE surface from CLI, TUI, and web dashboard; it has its own composer, transcript, and slash-command pipeline.

```
Desktop App (Tauri + React)
  → talks to Carina Gateway over JSON-RPC (same protocol as TUI)
  → does NOT embed the TUI (separate surface, like Hermes)
  → uses nanostores for shared state (Hermes pattern)
  → uses @assistant-ui/react for chat components (Hermes pattern)
```

### Transport
JSON-RPC over stdio or HTTP to Carina Gateway. Same protocol as the existing TUI in `src/tui/`. Reuse the transport layer.

---

## FEATURES; ADOPT FROM HERMES DESKTOP

### 1. Slash Command Pipeline (from Hermes `apps/desktop/`)
```
Desktop slash palette:
  → isDesktopSlashCommand(name); gates execution
  → isDesktopSlashSuggestion(name); gates discovery/completion
  → isDesktopSlashExtensionCommand(name); allows skill/quick commands
  → Built-ins handled locally or via commands.catalog
  → Everything else → slash.exec → command.dispatch
  → Skills resolved as normal prompts
```
Files to study:
- `hermes-agent/apps/desktop/src/lib/desktop-slash-commands.ts`; load-bearing curation file
- `hermes-agent/apps/desktop/src/app/session/hooks/use-prompt-actions.ts`; dispatch
- `hermes-agent/apps/desktop/src/app/chat/composer/hooks/use-slash-completions.ts`; completions

### 2. Composer Features (from Hermes `apps/desktop/src/app/chat/composer/`)
```
- Rich text editor with markdown support
- Slash command autocomplete (skills, quick commands, built-ins)
- @-mention autocomplete (sessions, agents, contacts)
- Voice recording via mic recorder hook (use-mic-recorder.ts)
- Voice conversation mode (use-voice-conversation.ts)
- File drop zone with drag-and-drop (drop-affordance.ts, use-file-drop-zone.ts)
- Attachment preview (attachments.tsx)
- Queue panel for batched messages (queue-panel.tsx)
- Context menu (context-menu.tsx)
- URL dialog (url-dialog.tsx)
- Inline refs (inline-refs.ts)
- Composer persistence; drafts survive app restart (use from OpenClaw pattern)
```
Files to study:
- `hermes-agent/apps/desktop/src/app/chat/composer/index.tsx`
- `hermes-agent/apps/desktop/src/app/chat/composer/rich-editor.ts`
- `hermes-agent/apps/desktop/src/app/chat/composer/controls.tsx`

### 3. State Management (Hermes nanostore pattern)
```
- Each feature owns its atoms (colocation, not monolith)
- Chat state near chat, shell state near shell
- Components that render from an atom use useStore()
- Non-rendering actions read with $atom.get()
- Persistence beside the atom that owns it
- Route roots thin; compose routes, not controllers
- No monolithic hooks; one narrow job each
```

### 4. Desktop-Specific Pages
```
- Chat page (primary surface)
- Agents management page
- Artifacts browser page
- Sessions browser
- Skills browser
- Settings page (model, provider, channels, appearance)
```

---

## FEATURES; ADOPT FROM OPENCLAW MACOS APP

### 5. Native System Integration (via Tauri)
```
- System tray with status indicator
- Native notifications (Tauri notification API)
- Launch at login (Tauri autostart)
- Global shortcut to activate (Tauri globalShortcut)
- Menu bar app mode (optional; Tauri system tray with menu)
- File system access dialogs (Tauri dialog API)
```
Files to study:
- `openclaw/apps/macos/Sources/OpenClaw/AppState.swift`; centralized app state
- `openclaw/apps/macos/Sources/OpenClaw/AppNavigationActions.swift`; navigation

### 6. Canvas/Artifact System (from OpenClaw `CanvasWindowController`)
```
- Agent-generated artifacts open in dedicated canvas windows
- Canvas supports: HTML, SVG, Markdown, code, images
- Canvas Chrome container with toolbar
- Canvas file watcher for live updates
- Canvas scheme handler for local file:// protocol
- Canvas URL support for web artifacts
- Canvas testing harness
```
Files to study:
- `openclaw/apps/macos/Sources/OpenClaw/CanvasWindowController.swift`
- `openclaw/apps/macos/Sources/OpenClaw/CanvasManager.swift`
- `openclaw/apps/macos/Sources/OpenClaw/CanvasFileWatcher.swift`
- `openclaw/apps/macos/Sources/OpenClaw/CanvasSchemeHandler.swift`

### 7. Agent Event Monitoring (from OpenClaw `AgentEventStore`)
```
- AgentEventsWindow for real-time event monitoring
- Event store with filtering (errors, tool calls, completions)
- Timeline view of agent activity
- Event export for debugging
```
Files to study:
- `openclaw/apps/macos/Sources/OpenClaw/AgentEventStore.swift`
- `openclaw/apps/macos/Sources/OpenClaw/AgentEventsWindow.swift`

---

## FEATURES; ADOPT FROM HERMES TUI/DESKTOP SHARED

### 8. Chat Experience
```
Message rendering:
  → messageLine.tsx; chat message with role styling
  → streamingAssistant.tsx; live streaming responses
  → streamingMarkdown.tsx; streaming markdown rendering
  → thinking.tsx; tool activity display (spinner + progress)
  → Markdown.tsx; rendered markdown with code highlighting

Tool call display:
  → ToolCall component showing tool name, args, result
  → Expandable tool output
  → Duration and status indicators
  → Error styling for failed tool calls

Prompts:
  → Approval prompts for dangerous operations
  → Clarify prompts for ambiguous requests
  → Sudo prompts for elevated access
  → Secret input prompts (masked)
```
Files to study:
- `hermes-agent/ui-tui/src/components/messageLine.tsx`
- `hermes-agent/ui-tui/src/components/streamingAssistant.tsx`
- `hermes-agent/ui-tui/src/components/thinking.tsx`
- `hermes-agent/ui-tui/src/components/prompts.tsx`

### 9. Model Picker (from Hermes `modelPicker.tsx`)
```
- Model list grouped by provider
- Current model highlighted
- Model metadata display (context length, pricing, capabilities)
- Cost guard warnings for expensive models
- Search/filter
- Keyboard navigation
```

### 10. Session Management
```
- Session list with search (from sessionSearch)
- Active session indicator
- Session switching (from activeSessionSwitcher.tsx)
- Session creation (/new)
- Session resume (/resume)
- Session export
```
Files to study:
- `hermes-agent/ui-tui/src/components/activeSessionSwitcher.tsx`
- `hermes-agent/apps/desktop/src/app/session/`

### 11. Subagent Management (from Hermes `agentsOverlay.tsx`)
```
- Active subagent list with status
- Subagent output viewer
- Subagent spawn history
- Subagent cancellation
```

### 12. Skills & Plugins Hub (from Hermes `skillsHub.tsx`, `pluginsHub.tsx`)
```
- Skill browser with search and categories
- Skill detail view (description, version, triggers)
- Skill enable/disable
- Plugin browser
- Plugin install/uninstall
```

---

## FEATURES; ADOPT FROM ODYSSEUS UI

### 13. Entity Anchors (from Odysseus `_LINK_RULES`)
```
- Session links: [Name](#session-<id>)
- Document links: [Title](#document-<id>)
- Note links: [Title](#note-<id>)
- Email links: [Subject](#email-<uid>)
- Task links: [Task name](#task-<id>)
- Skill links: [skill-name](#skill-<name>)
- Research links: [Topic](#research-<session_id>)
```
These should be clickable in the desktop chat transcript and navigate to the relevant panel.

### 14. PWA / Offline Support (from Odysseus static/)
```
- Service worker for offline caching
- PWA manifest for install prompt
- App icons at multiple sizes
- Offline message queue (send when reconnected)
```

---

## FEATURES; CARINA-SPECIFIC ADDITIONS

### 15. Multi-Workspace Support
```
- Workspace switcher in sidebar
- Per-workspace sessions, skills, memory
- Workspace config editor
- Workspace import/export
```

### 16. Scout Dashboard Integration
```
- Scout trust score widget
- Security events feed
- Kill switch status indicator
- Shield report viewer
- Trust compliance report
```

### 17. Billing & Usage (from Carina's billing system)
```
- Usage metrics dashboard
- Credit balance display
- Plan management
- Invoice history
- Cost per session breakdown
```

### 18. Operator Features
```
- Multi-agent orchestration view
- Cross-agent sync status
- Commitment tracking dashboard
- Benchmark results viewer
- Learning metrics dashboard
```

### 19. Code Mode with LSP (from `src/lsp/client.ts`)
```
The LSP client already exists in Carina core. The desktop composer should offer
a "code mode" activated by typing ``` or a keyboard shortcut:

  → Switch composer to Monaco editor (lightweight via tauri webview)
  → Connect to src/lsp/client.ts for language intelligence
  → Provide: syntax highlighting, autocomplete, error squiggles, hover docs
  → Submit code block to Carina with file type context

Files to integrate with:
  src/lsp/client.ts; existing LSP client - call this, don't rebuild
```

### 20. Companion Pairing (from `src/pairing/pairing.ts`)
```
The companion pairing backend already exists. Add to desktop settings:

  → Settings > Devices tab
  → "Link Mobile Device" button → calls POST /pairing/tokens → show QR code
  → QR code displayed in a modal (use a QR library like 'qrcode')
  → Device list showing paired devices with revoke buttons
  → Mobile app scans QR → both sides confirm → paired

The backend is done. This is frontend-only work (QR display + device list).

Files to integrate with:
  src/pairing/pairing.ts; generatePairingToken(), listPairedDevices(), revokePairedDevice()
```

---

## TECHNICAL SPECIFICATION

### Stack
```
Framework: Tauri 2.x (Rust backend, React frontend)
UI: React 19 + TypeScript
State: nanostores (Hermes pattern)
Chat: @assistant-ui/react (Hermes pattern)
Styling: Tailwind CSS or CSS modules
Icons: Lucide or custom
Build: Vite
Testing: Vitest + Playwright (E2E)
```

### Project Structure (adopt Hermes `apps/desktop/` layout)
```
carina-desktop/
├── src/
│   ├── app/
│   │   ├── chat/
│   │   │   ├── composer/
│   │   │   │   ├── index.tsx; main composer
│   │   │   │   ├── rich-editor.ts; rich text editing
│   │   │   │   ├── controls.tsx; send, attach, voice buttons
│   │   │   │   ├── attachments.tsx; attachment preview
│   │   │   │   ├── drop-affordance.ts; drag-and-drop zone
│   │   │   │   ├── queue-panel.tsx; batched messages
│   │   │   │   ├── context-menu.tsx; right-click menu
│   │   │   │   ├── url-dialog.tsx; URL input dialog
│   │   │   │   ├── inline-refs.ts; inline references
│   │   │   │   ├── trigger-popover.tsx; slash/@ popover
│   │   │   │   └── hooks/
│   │   │   │       ├── use-slash-completions.ts
│   │   │   │       ├── use-at-completions.ts
│   │   │   │       ├── use-mic-recorder.ts
│   │   │   │       ├── use-voice-conversation.ts
│   │   │   │       ├── use-file-drop-zone.ts
│   │   │   │       └── use-composer-actions.ts
│   │   │   ├── chat-drop-overlay.tsx
│   │   │   └── chat-swap-overlay.tsx
│   │   ├── agents/
│   │   │   └── index.tsx; agents management
│   │   ├── artifacts/
│   │   │   └── index.tsx; canvas/artifacts browser
│   │   ├── sessions/
│   │   │   └── index.tsx; session management
│   │   └── settings/
│   │       ├── index.tsx; settings shell
│   │       ├── models.tsx; model/provider config
│   │       ├── channels.tsx; channel management
│   │       ├── appearance.tsx; theme/font/size
│   │       └── about.tsx; version/info
│   ├── components/
│   │   ├── chat/
│   │   │   ├── message-line.tsx; message rendering
│   │   │   ├── streaming-assistant.tsx; streaming display
│   │   │   ├── streaming-markdown.tsx; streaming markdown
│   │   │   ├── thinking.tsx; tool activity
│   │   │   ├── tool-call.tsx; tool call display
│   │   │   ├── markdown.tsx; rendered markdown
│   │   │   └── prompts.tsx; approval/clarify/sudo
│   │   ├── model-picker.tsx; model selection
│   │   ├── skills-hub.tsx; skills browser
│   │   ├── plugins-hub.tsx; plugins browser
│   │   ├── agents-overlay.tsx; subagent management
│   │   ├── todo-panel.tsx; task list
│   │   ├── scout-widget.tsx; Scout integration
│   │   ├── usage-widget.tsx; billing/usage
│   │   └── branding.tsx; logo/branding
│   ├── store/
│   │   ├── chat.ts; chat atoms
│   │   ├── session.ts; session atoms
│   │   ├── composer.ts; composer atoms
│   │   ├── agents.ts; agent atoms
│   │   ├── settings.ts; settings atoms
│   │   └── gateway.ts; gateway connection
│   ├── lib/
│   │   ├── desktop-slash-commands.ts; slash command curation
│   │   ├── gateway-client.ts; JSON-RPC client
│   │   ├── gateway-types.ts; protocol types
│   │   ├── streaming.ts; stream handling
│   │   ├── clipboard.ts; clipboard operations
│   │   ├── platform.ts; OS detection
│   │   ├── notifications.ts; native notifications
│   │   ├── autostart.ts; launch at login
│   │   └── tray.ts; system tray
│   ├── hooks/
│   │   ├── use-submission.ts; message submission
│   │   ├── use-session-lifecycle.ts; session management
│   │   ├── use-config-sync.ts; config synchronization
│   │   └── use-gateway-health.ts; connection monitoring
│   └── i18n/
│       ├── index.ts
│       └── locales/
│           ├── en.ts
│           └── ... (additional languages)
├── src-tauri/
│   ├── src/
│   │   └── main.rs; Tauri backend
│   ├── tauri.conf.json
│   └── icons/
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

### Tauri Backend (Rust)
```
- Window management (main, canvas, settings)
- System tray with context menu
- Global shortcuts
- File system access
- Notification bridge
- Auto-updater
- Deep link handling
- Single instance lock
```

### Data Flow
```
User types in composer
  → on submit → gateway-client.call('prompt.submit', {message})
  → gateway streams response
  → streaming-assistant renders token by token
  → tool.start → thinking component shows spinner
  → tool.progress → update progress
  → tool.complete → tool-call component shows result
  → message.complete → final message rendered
  → approval.request → prompts component shows approval dialog
  → user approves/denies → gateway-client.call('approval.respond')
```

### Security
```
- Exec approvals with tiered levels (from Carina security/exec-approval-levels.ts)
- Native approval dialogs for dangerous operations
- Credential storage in OS keychain (Tauri stronghold)
- Content security policy via Tauri
- No secrets in renderer process
```

### Testing
```
- Unit: Vitest for stores, hooks, utilities
- Component: React Testing Library for UI components
- E2E: Playwright for full workflows
- Tauri-specific: Tauri mock for backend calls
```

---

## IMPLEMENTATION PHASES

### Phase 1; Shell (Week 1)
```
- Tauri project setup with React + Vite
- Window management (main window, settings window)
- System tray with basic menu
- JSON-RPC gateway client
- Basic chat composer (text input + send)
- Message rendering (static, no streaming yet)
- Dark/light theme
```

### Phase 2; Chat (Week 2)
```
- Streaming responses (token by token)
- Markdown rendering with code highlighting
- Tool call display (expandable)
- Slash command autocomplete
- @-mention autocomplete
- Session list and switching
- Session create/resume
```

### Phase 3; Tools & Agents (Week 3)
```
- Approval prompts (from Carina approval system)
- Clarify prompts
- Tool activity display (spinner + progress)
- Subagent management overlay
- Model picker
- Skills browser
```

### Phase 4; Advanced (Week 4)
```
- Voice recording and playback
- File drag-and-drop
- Attachment preview
- Canvas/artifact windows
- Native notifications
- Launch at login
- Auto-updater
```

### Phase 5; Polish (Week 5)
```
- i18n (3+ languages)
- Keyboard shortcuts
- Accessibility
- Performance optimization
- Error states and recovery
- Offline support
- PWA manifest
```

---

## REFERENCE FILES TO STUDY (from cloned repos)

### Hermes Desktop (`hermes-agent/apps/desktop/`)
```
src/lib/desktop-slash-commands.ts
src/app/chat/composer/index.tsx
src/app/chat/composer/rich-editor.ts
src/app/chat/composer/hooks/use-slash-completions.ts
src/app/chat/composer/hooks/use-mic-recorder.ts
src/app/chat/composer/hooks/use-voice-conversation.ts
src/app/chat/composer/hooks/use-file-drop-zone.ts
src/app/session/hooks/use-prompt-actions.ts
src/app/agents/index.tsx
src/app/artifacts/index.tsx
```

### Hermes TUI (chat components)
```
ui-tui/src/components/messageLine.tsx
ui-tui/src/components/streamingAssistant.tsx
ui-tui/src/components/streamingMarkdown.tsx
ui-tui/src/components/thinking.tsx
ui-tui/src/components/prompts.tsx
ui-tui/src/components/modelPicker.tsx
ui-tui/src/components/skillsHub.tsx
ui-tui/src/components/agentsOverlay.tsx
ui-tui/src/components/textInput.tsx
```

### OpenClaw macOS App
```
apps/macos/Sources/OpenClaw/AppState.swift
apps/macos/Sources/OpenClaw/AppNavigationActions.swift
apps/macos/Sources/OpenClaw/CanvasWindowController.swift
apps/macos/Sources/OpenClaw/CanvasManager.swift
apps/macos/Sources/OpenClaw/AgentEventStore.swift
apps/macos/Sources/OpenClaw/AgentEventsWindow.swift
apps/macos/Sources/OpenClaw/CameraCaptureService.swift
apps/macos/Sources/OpenClaw/AudioInputDeviceObserver.swift
```

### Carina Existing Code (to integrate with)
```
src/tui/; existing TUI (reuse transport, types, gateway client)
src/gateway/; gateway protocol
src/tools/; tool definitions (same tools desktop will use)
src/agents/; agent logic
src/security/; approval system
```
