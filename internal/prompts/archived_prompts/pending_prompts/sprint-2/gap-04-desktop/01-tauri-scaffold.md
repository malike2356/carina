# Gap 03 - Prompt 01: Tauri Scaffold

**Status: COMPLETED 2026-06-23**

**What was built:**
- `frontends/client-apps/carina-desktop/` Tauri 2 + React 19 scaffold
- `src-tauri/` (Rust backend, tray, global shortcut, hide-to-tray)
- `src/lib/gateway-client.ts`, nanostore atoms (`chat`, `session`, `connection`, `composer`)
- App shell with `AppSidebar` and gateway health polling
- `desktop` added to `CLIENT_SURFACES` in core surfaces index

> **REUSE RULE:** See `REUSE-RULES.md` in this directory. Implement the behavior described below in Carina's own voice. No competitor product names, labels, CLI output, or UI copy may appear verbatim in shipped code.


**Gap:** 03 Desktop App
**Prompt number:** 01 of 06
**Name:** Tauri Scaffold
**Primary agent:** Cursor
**Fallback agent:** Claude Code
**Estimated hours:** 6-8 h
**Depends on:** nothing (first prompt)

---

## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`


## Read First

Before writing a single line, read these files in order:

1. `/opt/lampp/htdocs/verlox/carina/core.carinaai.uk/src/surfaces/index.ts` - you will modify this
2. `/opt/lampp/htdocs/verlox/carina/core.carinaai.uk/src/tui/app.ts` - study the transport pattern
3. `/opt/lampp/htdocs/verlox/carina/core.carinaai.uk/src/gateway/cli.ts` - study CarinaMessage shape
4. `/opt/lampp/htdocs/verlox/carina/core.carinaai.uk/src/gateway/commands.ts` - study CommandResult type
5. `/opt/lampp/htdocs/verlox/carina/core.carinaai.uk/CLAUDE.md` - stack rules and coding conventions
6. `strategy/agent-study/hermes-agent/apps/desktop/src/store/` - nanostore atom patterns to replicate

Do not proceed until you have read all six items above. The surfaces registration step must happen before anything else.

---

## Context

Carina is a multi-surface AI agent. Its surfaces are declared in `core.carinaai.uk/src/surfaces/index.ts`. The current surface list is:

```typescript
export const CLIENT_SURFACES = ['cli', 'tui', 'web', 'mobile', 'acp'] as const;
```

The desktop app is a new surface. It talks to the Carina gateway over JSON-RPC on `localhost:3333`. The gateway streams responses as async generators (same protocol as the TUI). The desktop app never embeds the gateway - it connects to a running instance.

The Tauri app lives at `carina-desktop/` as a sibling to `core.carinaai.uk/`, not inside it.

---

## What Exists vs What to Build

### What exists

- `core.carinaai.uk/src/surfaces/index.ts` - CLIENT_SURFACES array and session routing helpers
- `core.carinaai.uk/src/tui/app.ts` - existing readline TUI (study transport, do not reuse UI)
- `core.carinaai.uk/src/gateway/cli.ts` - CarinaMessage type and gateway routing
- `core.carinaai.uk/src/lsp/client.ts` - LSP client (needed in prompt 05)
- `core.carinaai.uk/src/pairing/pairing.ts` - companion pairing backend (needed in prompt 06)

### What to build in this prompt

- `carina-desktop/` - the entire Tauri project directory (new, does not exist)
- Registration of "desktop" in CLIENT_SURFACES (one line change in surfaces/index.ts)
- Rust backend: window, tray, single-instance lock, global shortcut
- `src/lib/gateway-client.ts` - JSON-RPC client over HTTP
- `src/store/chat.ts`, `src/store/session.ts`, `src/store/connection.ts` - nanostore atoms
- Basic layout shell: sidebar placeholder + main area placeholder
- `tauri.conf.json` with window config, CSP, and capabilities

---

## Step-by-Step Implementation

### Step 1: Register "desktop" surface in core

Open `/opt/lampp/htdocs/verlox/carina/core.carinaai.uk/src/surfaces/index.ts`.

Change line 5 from:
```typescript
export const CLIENT_SURFACES = ['cli', 'tui', 'web', 'mobile', 'acp'] as const;
```

To:
```typescript
export const CLIENT_SURFACES = ['cli', 'tui', 'web', 'mobile', 'acp', 'desktop'] as const;
```

Also add a case for 'desktop' in `resolveSurfaceExternalUserId`:
```typescript
if (surface === 'desktop') {
  return input.profile?.trim() || 'desktop-operator';
}
```

This must be done before building anything else. The gateway will reject sessions from unrecognised surfaces.

### Step 2: Initialise the Tauri project

Run from the repo root (`/opt/lampp/htdocs/verlox/carina/`):

```bash
npm create tauri-app@latest carina-desktop -- \
  --template react-ts \
  --manager npm \
  --no-open
cd carina-desktop
```

Then replace the generated `package.json` with the exact dependencies listed in Step 3 below. Do not use the defaults.

### Step 3: Install dependencies

`carina-desktop/package.json` devDependencies and dependencies must include:

```json
{
  "name": "carina-desktop",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "tauri dev",
    "build": "tauri build",
    "preview": "vite preview",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "@tauri-apps/api": "^2.0.0",
    "@tauri-apps/plugin-autostart": "^2.0.0",
    "@tauri-apps/plugin-dialog": "^2.0.0",
    "@tauri-apps/plugin-notification": "^2.0.0",
    "@tauri-apps/plugin-shell": "^2.0.0",
    "@tauri-apps/plugin-updater": "^2.0.0",
    "nanostores": "^0.10.0",
    "@nanostores/react": "^0.7.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-virtuoso": "^4.7.0",
    "react-markdown": "^9.0.0",
    "remark-gfm": "^4.0.0",
    "rehype-highlight": "^7.0.0",
    "highlight.js": "^11.10.0",
    "qrcode": "^1.5.4"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^2.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@types/qrcode": "^1.5.5",
    "typescript": "^5.5.0",
    "vite": "^5.4.0",
    "@vitejs/plugin-react": "^4.3.0",
    "tailwindcss": "^4.0.0",
    "@tailwindcss/vite": "^4.0.0",
    "vitest": "^2.0.0"
  }
}
```

### Step 4: Write the Rust backend

File: `carina-desktop/src-tauri/src/main.rs`

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{
    AppHandle, Manager, SystemTray, SystemTrayEvent, SystemTrayMenu, SystemTrayMenuItem,
    CustomMenuItem, GlobalShortcutManager, RunEvent, WindowBuilder, WindowUrl,
};
use tauri::utils::platform::current_exe;

fn build_tray_menu() -> SystemTrayMenu {
    SystemTrayMenu::new()
        .add_item(CustomMenuItem::new("show", "Open Carina"))
        .add_native_item(SystemTrayMenuItem::Separator)
        .add_item(CustomMenuItem::new("settings", "Settings"))
        .add_native_item(SystemTrayMenuItem::Separator)
        .add_item(CustomMenuItem::new("quit", "Quit"))
}

fn handle_tray_event(app: &AppHandle, event: SystemTrayEvent) {
    match event {
        SystemTrayEvent::MenuItemClick { id, .. } => match id.as_str() {
            "show" => {
                if let Some(window) = app.get_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "settings" => {
                if let Some(window) = app.get_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                    let _ = window.emit("navigate", "/settings");
                }
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        },
        SystemTrayEvent::DoubleClick { .. } => {
            if let Some(window) = app.get_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }
        _ => {}
    }
}

fn main() {
    let tray = SystemTray::new().with_menu(build_tray_menu());

    tauri::Builder::default()
        .system_tray(tray)
        .on_system_tray_event(handle_tray_event)
        .setup(|app| {
            // Single-instance lock: if another instance exists, focus it and quit.
            #[cfg(not(debug_assertions))]
            {
                use tauri::plugin::TauriPlugin;
                // Tauri 2.x single-instance via plugin-single-instance is preferred.
                // For scaffold, raise existing window on second launch.
            }

            // Global shortcut: Cmd+Shift+C (macOS) / Ctrl+Shift+C (Windows/Linux)
            let app_handle = app.handle();
            app.global_shortcut_manager()
                .register("CmdOrCtrl+Shift+C", move || {
                    if let Some(window) = app_handle.get_window("main") {
                        if window.is_visible().unwrap_or(false) {
                            let _ = window.hide();
                        } else {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .expect("global shortcut registration failed");

            Ok(())
        })
        .on_window_event(|event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event.event() {
                // Hide to tray instead of quitting.
                event.window().hide().unwrap();
                api.prevent_close();
            }
        })
        .run(tauri::generate_context!())
        .expect("error running carina desktop");
}
```

Important notes on the Rust code:
- Tauri 2.x changed some APIs from Tauri 1.x. If the tauri-apps/cli version generates different boilerplate, adapt accordingly but preserve all three menu items (Open, Settings, Quit), the single-instance behaviour, and the global shortcut.
- The `on_window_event` close handler hides to tray rather than quitting. This is intentional.

### Step 5: Write tauri.conf.json

File: `carina-desktop/src-tauri/tauri.conf.json`

```json
{
  "build": {
    "beforeDevCommand": "vite",
    "beforeBuildCommand": "vite build",
    "devPath": "http://localhost:5173",
    "distDir": "../dist"
  },
  "package": {
    "productName": "Carina",
    "version": "0.1.0"
  },
  "tauri": {
    "allowlist": {
      "all": false,
      "shell": { "open": true },
      "notification": { "all": true },
      "dialog": {
        "open": true,
        "save": true
      },
      "globalShortcut": { "all": true },
      "systemTray": {},
      "window": {
        "all": true
      },
      "http": {
        "all": true,
        "scope": ["http://localhost:3333/**", "https://api.carinaai.uk/**"]
      }
    },
    "bundle": {
      "active": true,
      "targets": "all",
      "identifier": "uk.carinaai.desktop",
      "icon": [
        "icons/32x32.png",
        "icons/128x128.png",
        "icons/128x128@2x.png",
        "icons/icon.icns",
        "icons/icon.ico"
      ]
    },
    "security": {
      "csp": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src http://localhost:3333 https://api.carinaai.uk; img-src 'self' data: blob:"
    },
    "windows": [
      {
        "label": "main",
        "title": "Carina",
        "width": 1200,
        "height": 800,
        "minWidth": 800,
        "minHeight": 600,
        "resizable": true,
        "fullscreen": false,
        "decorations": true,
        "center": true
      }
    ]
  }
}
```

### Step 6: Write the gateway client

File: `carina-desktop/src/lib/gateway-client.ts`

```typescript
const GATEWAY_BASE = 'http://localhost:3333';

export interface SessionInfo {
  sessionId: string;
  agentId: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  title?: string;
}

export interface HealthStatus {
  status: 'ok' | 'degraded' | 'down';
  version?: string;
  uptime?: number;
}

export interface SubmitResult {
  sessionId: string;
  runId: string;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${GATEWAY_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Carina-Surface': 'desktop' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Gateway error ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${GATEWAY_BASE}${path}`, {
    headers: { 'X-Carina-Surface': 'desktop' },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Gateway error ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export async function getHealth(): Promise<HealthStatus> {
  try {
    return await get<HealthStatus>('/health');
  } catch {
    return { status: 'down' };
  }
}

export async function listSessions(): Promise<SessionInfo[]> {
  return get<SessionInfo[]>('/api/sessions');
}

export async function getSession(sessionId: string): Promise<SessionInfo> {
  return get<SessionInfo>(`/api/sessions/${sessionId}`);
}

export async function submitPrompt(
  sessionId: string,
  content: string,
  options?: { agentId?: string },
): Promise<SubmitResult> {
  return post<SubmitResult>('/api/chat', {
    sessionId,
    content,
    source: 'desktop',
    agentId: options?.agentId,
  });
}

export async function cancelRun(sessionId: string): Promise<void> {
  await post('/api/chat/cancel', { sessionId });
}

/**
 * Open an SSE stream for a running session.
 * The caller is responsible for closing the EventSource when done.
 */
export function openStream(sessionId: string): EventSource {
  return new EventSource(`${GATEWAY_BASE}/api/stream/${sessionId}`);
}
```

Key decisions:
- Every request sends `X-Carina-Surface: desktop` so the gateway can route sessions to the desktop surface correctly.
- `openStream` returns a native EventSource. The chat engine (prompt 02) will consume this.
- `getHealth` never throws; it returns `{ status: 'down' }` on any error. This lets the connection store poll safely.

### Step 7: Write the nanostore atoms

File: `carina-desktop/src/store/connection.ts`

```typescript
import { atom, task } from 'nanostores';
import { getHealth, type HealthStatus } from '../lib/gateway-client.js';

export const $gatewayStatus = atom<HealthStatus['status']>('down');
export const $gatewayVersion = atom<string | undefined>(undefined);

let pollInterval: ReturnType<typeof setInterval> | null = null;

export function startHealthPolling(intervalMs = 5000): void {
  if (pollInterval) return;
  void checkHealth();
  pollInterval = setInterval(() => void checkHealth(), intervalMs);
}

export function stopHealthPolling(): void {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

async function checkHealth(): Promise<void> {
  const result = await getHealth();
  $gatewayStatus.set(result.status);
  if (result.version) $gatewayVersion.set(result.version);
}
```

File: `carina-desktop/src/store/session.ts`

```typescript
import { atom, map } from 'nanostores';
import type { SessionInfo } from '../lib/gateway-client.js';

export const $currentSessionId = atom<string | null>(null);
export const $sessions = atom<SessionInfo[]>([]);
export const $sessionLoading = atom(false);
```

File: `carina-desktop/src/store/chat.ts`

```typescript
import { atom } from 'nanostores';

export type MessageRole = 'user' | 'assistant' | 'tool';

export interface ToolCall {
  id: string;
  name: string;
  args: unknown;
  result?: unknown;
  durationMs?: number;
  status: 'running' | 'done' | 'error';
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  toolCalls?: ToolCall[];
  thinkingContent?: string;
  timestamp: number;
  isStreaming?: boolean;
}

export const $messages = atom<ChatMessage[]>([]);
export const $streamingMessageId = atom<string | null>(null);
export const $isStreaming = atom(false);
export const $pendingApproval = atom<{
  toolName: string;
  params: unknown;
  reason: string;
  runId: string;
} | null>(null);
```

File: `carina-desktop/src/store/composer.ts`

```typescript
import { atom } from 'nanostores';

export const $composerDraft = atom('');
export const $composerAttachments = atom<Array<{ name: string; path: string; type: string }>>([]);
export const $composerMode = atom<'text' | 'code'>('text');
export const $composerCodeLang = atom('');
```

### Step 8: Write the app shell layout

File: `carina-desktop/src/App.tsx`

```typescript
import React, { useEffect } from 'react';
import { useStore } from '@nanostores/react';
import { $gatewayStatus, startHealthPolling } from './store/connection.js';
import Sidebar from './components/Sidebar.js';

export default function App() {
  const gatewayStatus = useStore($gatewayStatus);

  useEffect(() => {
    startHealthPolling();
  }, []);

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100 font-sans">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 flex items-center justify-center text-zinc-500">
          {gatewayStatus === 'down'
            ? 'Gateway offline - start Carina with: pnpm cli'
            : 'Select a session or start a new one'}
        </div>
      </main>
    </div>
  );
}
```

File: `carina-desktop/src/components/Sidebar.tsx`

```typescript
import React from 'react';
import { useStore } from '@nanostores/react';
import { $sessions, $currentSessionId } from '../store/session.js';
import { $gatewayStatus } from '../store/connection.js';

export default function Sidebar() {
  const sessions = useStore($sessions);
  const currentId = useStore($currentSessionId);
  const status = useStore($gatewayStatus);

  return (
    <aside className="w-64 flex flex-col border-r border-zinc-800 bg-zinc-900">
      <div className="p-4 border-b border-zinc-800">
        <span className="text-sm font-semibold text-zinc-100">Carina</span>
        <span
          className={`ml-2 text-xs ${status === 'ok' ? 'text-green-400' : 'text-red-400'}`}
        >
          {status}
        </span>
      </div>
      <nav className="flex-1 overflow-y-auto p-2 space-y-1">
        {sessions.length === 0 && (
          <p className="text-xs text-zinc-500 px-2 py-1">No sessions yet</p>
        )}
        {sessions.map((s) => (
          <button
            key={s.sessionId}
            onClick={() => $currentSessionId.set(s.sessionId)}
            className={`w-full text-left px-3 py-2 rounded text-sm truncate ${
              s.sessionId === currentId
                ? 'bg-zinc-700 text-zinc-100'
                : 'text-zinc-400 hover:bg-zinc-800'
            }`}
          >
            {s.title ?? s.sessionId.slice(0, 12)}
          </button>
        ))}
      </nav>
      <div className="p-3 border-t border-zinc-800 text-xs text-zinc-500">
        Session list placeholder - prompt 02 wires this up
      </div>
    </aside>
  );
}
```

### Step 9: Write vite.config.ts and tsconfig.json

File: `carina-desktop/vite.config.ts`

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
  },
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    target: ['es2021', 'chrome105', 'safari15'],
    minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_DEBUG,
  },
});
```

File: `carina-desktop/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2021",
    "lib": ["ES2021", "DOM"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "skipLibCheck": true,
    "esModuleInterop": true
  },
  "include": ["src"]
}
```

### Step 10: Verify the scaffold

Run from `carina-desktop/`:

```bash
npm install
npm run type-check   # must pass with 0 errors
```

Then start the Carina gateway in a separate terminal:
```bash
cd /opt/lampp/htdocs/verlox/carina/core.carinaai.uk
pnpm cli
```

Then start the desktop app:
```bash
cd /opt/lampp/htdocs/verlox/carina/carina-desktop
npm run dev
```

The Tauri window must open showing the sidebar and the "Gateway offline" or "Select a session" message. Fix any build errors before moving to prompt 02.

---

## Files to Create

```
carina-desktop/
  package.json
  tsconfig.json
  vite.config.ts
  src/
    main.tsx              (React entry point, mount App)
    App.tsx               (app shell layout)
    index.css             (Tailwind base import)
    lib/
      gateway-client.ts   (HTTP gateway client)
    store/
      chat.ts             (message atoms)
      session.ts          (session atoms)
      connection.ts       (health polling atoms)
      composer.ts         (composer atoms)
    components/
      Sidebar.tsx         (sidebar shell, session list placeholder)
  src-tauri/
    src/
      main.rs             (Rust backend)
    tauri.conf.json
    icons/                (copy from tauri init - default icons are fine for now)
    Cargo.toml            (generated by tauri init, add required crates)
```

## Files to Modify

```
core.carinaai.uk/src/surfaces/index.ts
  - Add 'desktop' to CLIENT_SURFACES array
  - Add 'desktop' case to resolveSurfaceExternalUserId
```

---

## Done When

- [x] `frontends/client-apps/carina-desktop/` exists
- [x] `npx tsc --noEmit` passes with 0 errors in `carina-desktop/`
- [x] `pnpm dev` opens a Tauri window without errors
- [x] Window shows sidebar with status indicator and main area message
- [x] System tray appears with Open, Settings, Quit items
- [x] Closing the window hides to tray (does not quit the process)
- [x] `Cmd/Ctrl+Shift+C` toggles window visibility
- [x] `backends/servers/core.carinaai.uk/src/surfaces/index.ts` includes `desktop` in CLIENT_SURFACES
- [x] `getHealth()` in gateway-client.ts returns `{ status: 'down' }` when gateway is not running
- [x] No TypeScript errors after the surfaces change