# Gap 04 - Prompt 05: Native Integration

**Agent:** Cursor (fallback: Codex for Rust parts)
**Estimated hours:** 4-5 hrs
**Depends on:** 01-04 done

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

```
carina-desktop/src-tauri/src/main.rs          (Tauri backend from 01)
carina-desktop/src-tauri/tauri.conf.json
core.carinaai.uk/src/lsp/client.ts            (LSP client to integrate)
core.carinaai.uk/src/security/exec-approval-levels.ts
https://tauri.app/v2/reference/javascript/api/ (Tauri 2 APIs)
```

---

## What to Build

All Tauri-specific OS integrations: tray, notifications, global shortcut, autostart, updater, deep links, file dialogs, LSP code mode.

---

## 1. System Tray (Dynamic)

In `src-tauri/src/main.rs`, extend the tray from prompt 01:

```rust
// Dynamic tray menu based on Carina state:

fn build_tray_menu(state: &AppState) -> Menu {
    let session_name = state.current_session_name.lock().unwrap();
    let is_busy = state.is_busy.load(Ordering::Relaxed);

    MenuBuilder::new()
        .item(&MenuItem::new("Open Carina", true, None))
        .separator()
        .item(&MenuItem::new(
            format!("Session: {}", session_name.as_deref().unwrap_or("None")),
            false, None
        ))
        .item(&MenuItem::new(
            if is_busy { "Status: Working..." } else { "Status: Ready" },
            false, None
        ))
        .separator()
        .item(&MenuItem::new("New Session", true, Some("n")))
        .item(&MenuItem::new("Settings", true, Some(",")))
        .separator()
        .item(&MenuItem::new("Quit", true, Some("q")))
        .build()
}

// Tray icon:
//   idle:  standard logo icon
//   busy:  animated spinner overlay (swap icon every 500ms)
//   error: red badge overlay

// Update tray from frontend:
//   emit event "tray-state-change" with { sessionName, busy, error }
//   Rust listener rebuilds menu and swaps icon
```

## 2. Native Notifications

```typescript
// src/lib/notifications.ts
import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification';

export async function notify(title: string, body: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') {
  let granted = await isPermissionGranted();
  if (!granted) {
    const permission = await requestPermission();
    granted = permission === 'granted';
  }
  if (granted) {
    sendNotification({ title, body });
  }
}

// Fire notifications on:
//   Task complete: "Task complete: <task name>"
//   Approval needed: "Carina needs approval" + command preview
//   Error: "Carina encountered an error" + short message
//   Mention received (from channels): sender + first 100 chars
```

## 3. Launch at Login

```typescript
// src/lib/autostart.ts
import { enable, disable, isEnabled } from '@tauri-apps/plugin-autostart';

export async function getAutostartEnabled(): Promise<boolean> {
  return isEnabled();
}

export async function setAutostartEnabled(enabled: boolean) {
  if (enabled) {
    await enable();
  } else {
    await disable();
  }
}

// Wire to settings/appearance/page.tsx:
//   "Launch at login" toggle, reads/writes via autostart.ts
```

## 4. Auto-Updater

```rust
// src-tauri/src/main.rs - add update check on launch

use tauri_plugin_updater::UpdaterExt;

async fn check_for_updates(app: &AppHandle) {
    if let Ok(Some(update)) = app.updater().check().await {
        // Emit to frontend: update available
        app.emit("update-available", UpdateInfo {
            version: update.version,
            body: update.body,
        }).ok();
    }
}
```

```typescript
// src/hooks/use-updater.ts
import { listen } from '@tauri-apps/api/event';
import { relaunch } from '@tauri-apps/plugin-process';

export function useUpdater() {
  // Listen for "update-available" event
  // Show banner in app: "Carina X.Y.Z is available. Update and restart?"
  // On confirm: download and install, then relaunch()
}
```

## 5. Deep Links

```
// tauri.conf.json - add deep link protocol:
{
  "plugins": {
    "deep-link": {
      "mobile": [],
      "desktop": [{ "schemes": ["carina"] }]
    }
  }
}
```

```typescript
// src/lib/deep-links.ts
import { onOpenUrl } from '@tauri-apps/plugin-deep-link';

export function setupDeepLinks() {
  onOpenUrl((urls) => {
    for (const url of urls) {
      handleDeepLink(new URL(url));
    }
  });
}

function handleDeepLink(url: URL) {
  // carina://session/<id>        → navigate to session
  // carina://install/<skill>     → trigger skill install
  // carina://pair/<token>        → complete pairing flow
  // carina://new                 → create new session
  switch (url.pathname.split('/')[1]) {
    case 'session':   navigate(`/chat/${url.pathname.split('/')[2]}`); break;
    case 'install':   installSkill(url.pathname.split('/')[2]); break;
    case 'pair':      completePairing(url.pathname.split('/')[2]); break;
    case 'new':       navigate('/chat/new'); break;
  }
}
```

## 6. Global Shortcut

```typescript
// src/lib/shortcuts.ts
import { register, unregister } from '@tauri-apps/plugin-global-shortcut';
import { getCurrentWindow } from '@tauri-apps/api/window';

export async function registerGlobalShortcuts() {
  // Ctrl+Shift+C (or Cmd+Shift+C on mac): toggle main window
  await register('CommandOrControl+Shift+C', async () => {
    const win = getCurrentWindow();
    const visible = await win.isVisible();
    if (visible) {
      await win.hide();
    } else {
      await win.show();
      await win.setFocus();
    }
  });
}

// Call setupGlobalShortcuts() in app startup
// Unregister on app close
```

## 7. File System Dialogs

```typescript
// src/lib/fs-dialogs.ts
import { open, save } from '@tauri-apps/plugin-dialog';
import { readFile, writeFile } from '@tauri-apps/plugin-fs';

export async function pickFile(options?: { multiple?: boolean; filters?: FileFilter[] }) {
  return open({
    multiple: options?.multiple ?? false,
    filters: options?.filters,
  });
}

export async function pickSaveLocation(defaultName: string) {
  return save({ defaultPath: defaultName });
}

// Use in:
//   Composer attach button → pickFile({ multiple: true })
//   Session export → pickSaveLocation(`carina-session-${id}.md`)
//   Canvas download → pickSaveLocation(artifact.title)
```

## 8. LSP Code Mode

When the user types triple backtick (```) in the composer, activate Monaco editor:

```typescript
// src/components/composer/CodeModeComposer.tsx

// Triggered by: detecting ``` in ComposerInput text
// OR: keyboard shortcut Ctrl+` to toggle code mode

// Stack:
//   npm install @monaco-editor/react
//   Use <Editor> component from @monaco-editor/react

// On code mode activate:
//   1. Extract code from composer text (if any)
//   2. Replace ComposerInput with Monaco editor
//   3. Connect to LSP via gateway:
//      gateway-client.lspRequest('initialize', { capabilities: {...} })
//      gateway-client.lspRequest('textDocument/didOpen', { uri, text })
//   4. Wire Monaco's onDidChangeModelContent:
//      → send textDocument/didChange to gateway LSP client
//   5. Wire Monaco's completionItemProvider:
//      → call textDocument/completion via gateway
//      → return items to Monaco
//   6. Wire Monaco's hoverProvider:
//      → call textDocument/hover via gateway
//      → show hover card in Monaco

// On submit from code mode:
//   Wrap content in ```language\ncontent\n```
//   Submit via normal composer flow
//   Close LSP session: textDocument/didClose

// Language detection:
//   User can select from dropdown (TypeScript, Python, Rust, Go, etc.)
//   Auto-detect: simple heuristic from first line
```

Gateway gateway-client.ts additions:

```typescript
// LSP methods (proxy to core.carinaai.uk/src/lsp/client.ts via gateway)
async lspRequest(method: string, params: unknown): Promise<unknown> {
  return this.call('lsp.request', { method, params });
}
```

---

## Files to Create

```
carina-desktop/src/
├── lib/
│   ├── notifications.ts
│   ├── autostart.ts
│   ├── deep-links.ts
│   ├── shortcuts.ts
│   ├── fs-dialogs.ts
│   └── updater.ts
├── components/composer/
│   └── CodeModeComposer.tsx
└── hooks/
    └── use-updater.ts

carina-desktop/src-tauri/
└── src/
    └── tray.rs              (dynamic tray logic extracted from main.rs)
```

## Files to Modify

```
src-tauri/src/main.rs       → add deep link handler, update check on launch, dynamic tray state
src-tauri/Cargo.toml        → add tauri plugins: notification, autostart, updater, deep-link, global-shortcut, dialog, fs
src-tauri/tauri.conf.json   → add deep link scheme, plugin configs, updater endpoint
src/components/composer/Composer.tsx → detect ``` → switch to CodeModeComposer
src/lib/gateway-client.ts   → add lspRequest() method
```

## Tauri Plugins to Add

```toml
# Cargo.toml
tauri-plugin-notification = "2"
tauri-plugin-autostart = "2"
tauri-plugin-updater = "2"
tauri-plugin-deep-link = "2"
tauri-plugin-global-shortcut = "2"
tauri-plugin-dialog = "2"
tauri-plugin-fs = "2"
tauri-plugin-process = "2"
```

---

## Done When

- [ ] Tray icon changes to spinner animation when Carina is processing
- [ ] Native OS notification fires when a task completes (test: run any task)
- [ ] "Launch at login" toggle in appearance settings works and persists
- [ ] `carina://new` deep link opens the app and starts a new session
- [ ] `carina://session/<id>` deep link navigates to that session
- [ ] Ctrl+Shift+C toggles window show/hide globally (even when app is background)
- [ ] Paperclip button opens native file picker dialog
- [ ] Typing ``` in composer switches to Monaco editor with syntax highlighting
- [ ] LSP completions appear in Monaco editor (TypeScript: type a dot on an object)
- [ ] Update banner appears when a new version is available
