# Prompt 04: Desktop Launcher (Tauri Native Window)


## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`

## Context

The Carina desktop app lives in `apps/desktop/` and is built with Tauri 2.x + React.
The launcher in the desktop app must look identical to the web launcher but must:
- Use native window chrome instead of the CSS dots + titlebar
- Register a system tray icon so Carina is reachable without a Dock/taskbar click
- Support auto-start on login (optional, user-configurable)
- Open the launcher when the app starts cold (no active session)

The web launcher components (`LauncherPrimary`, `LauncherWithSidebar`, `LauncherExpanded`,
`OrbitalDiagram`, `SystemStatusPanel`) should be extracted to a shared package so both
`apps/cloud/` and `apps/desktop/` can consume them without duplication.

## What to Build

### 1. Extract launcher to shared package

Move launcher components to `packages/ui/src/launcher/`:
```
packages/ui/src/launcher/
├── LauncherPrimary.tsx
├── LauncherSidebar.tsx
├── LauncherExpanded.tsx
├── OrbitalDiagram.tsx
├── SystemStatusPanel.tsx
├── ProjectResumeCard.tsx
├── LauncherStatusBar.tsx
└── index.ts
```

`index.ts` exports:
```ts
export { LauncherPrimary } from './LauncherPrimary';
export { LauncherWithSidebar } from './LauncherSidebar';
export { LauncherExpanded } from './LauncherExpanded';
```

Update `packages/ui/package.json` to include these exports so both apps can import
`@verlox/carina-ui/launcher`.

Update `apps/cloud/src/App.tsx` to import from `@verlox/carina-ui/launcher`.

### 2. Native window configuration

In `src-tauri/tauri.conf.json` (desktop app config), set:
```json
{
  "app": {
    "windows": [{
      "title": "Carina",
      "width": 960,
      "height": 640,
      "minWidth": 800,
      "minHeight": 520,
      "resizable": true,
      "decorations": true,
      "transparent": false,
      "center": true,
      "visible": false
    }]
  }
}
```

Note: `decorations: true` means the OS draws the window chrome (native title bar with
close/minimise/maximise). The web CSS `.launcher-titlebar` with dots must be hidden when
running inside Tauri. The web CSS `.launcher-shell` already accounts for this - add:

```css
/* Hide web-style title bar when running inside Tauri native window */
.tauri-app .launcher-titlebar { display: none; }
```

Detect Tauri at runtime:
```tsx
const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
// Add class to root div:
<div className={isTauri ? 'launcher-shell tauri-app' : 'launcher-shell'}>
```

### 3. System tray

File: `src-tauri/src/tray.rs`

```rust
use tauri::{
    AppHandle, Manager,
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
};

pub fn setup_tray(app: &AppHandle) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "show", "Show Carina", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit Carina", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &quit])?;

    TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => {
                if let Some(w) = app.get_webview_window("main") {
                    let _ = w.show();
                    let _ = w.set_focus();
                }
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(w) = app.get_webview_window("main") {
                    let _ = w.show();
                    let _ = w.set_focus();
                }
            }
        })
        .build(app)?;

    Ok(())
}
```

Register in `src-tauri/src/main.rs`:
```rust
mod tray;

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            tray::setup_tray(app.handle())?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### 4. Window show/hide on startup

The window starts as `visible: false` to avoid a flash. Show it once the React app has
mounted and the launcher is ready:

In `apps/desktop/src/App.tsx`:
```tsx
import { invoke } from '@tauri-apps/api/core';

useEffect(() => {
  invoke('show_main_window').catch(() => {});
}, []);
```

Tauri command in `src-tauri/src/main.rs`:
```rust
#[tauri::command]
fn show_main_window(window: tauri::WebviewWindow) {
    window.show().unwrap();
    window.set_focus().unwrap();
}
```

Register with `.invoke_handler(tauri::generate_handler![show_main_window])`.

### 5. Auto-start on login (optional feature)

Use the `tauri-plugin-autostart` plugin:
```toml
# src-tauri/Cargo.toml
[dependencies]
tauri-plugin-autostart = "2"
```

```rust
// In setup:
app.handle().plugin(tauri_plugin_autostart::init(
    tauri_plugin_autostart::MacosLauncher::LaunchAgent,
    Some(vec!["--launched-by-autostart"]),
))?;
```

Expose toggle to UI:
```tsx
import { enable, disable, isEnabled } from '@tauri-apps/plugin-autostart';

function AutoStartToggle() {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => { isEnabled().then(setEnabled); }, []);
  const toggle = async () => {
    if (enabled) { await disable(); setEnabled(false); }
    else { await enable(); setEnabled(true); }
  };
  return <Toggle checked={enabled} onChange={toggle} label="Launch at login" />;
}
```

Add `AutoStartToggle` to the Settings section of `LauncherWithSidebar` when
`activePath === '/settings'`.

### 6. Window close behavior: minimize to tray

Override the close event so clicking the window X hides the window rather than quitting:
```rust
// In setup:
let main_window = app.get_webview_window("main").unwrap();
main_window.on_window_event(move |event| {
    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
        api.prevent_close();
        main_window.hide().unwrap();
    }
});
```

## Verification Checklist

- [ ] Desktop app starts and shows launcher (primary state) on cold start
- [ ] Native OS title bar visible; CSS dots title bar hidden
- [ ] System tray icon visible in menu bar / taskbar
- [ ] Left-clicking tray icon shows/focuses the window
- [ ] Tray menu "Show Carina" and "Quit Carina" both work
- [ ] Clicking window X hides window to tray (does not quit)
- [ ] Logo loads from public/logo/ path in both web and desktop
- [ ] Launcher shared components (LauncherPrimary etc.) imported from @verlox/carina-ui/launcher
- [ ] Auto-start toggle in Settings saves preference and persists across reboots

## Files to Create or Modify

- MOVE `apps/cloud/src/components/launcher/*` -> `packages/ui/src/launcher/`
- MODIFY `packages/ui/package.json` - add launcher exports
- MODIFY `apps/cloud/src/App.tsx` - update imports to @verlox/carina-ui/launcher
- MODIFY `apps/desktop/src/App.tsx` - add launcher + show_main_window invoke
- CREATE `src-tauri/src/tray.rs`
- MODIFY `src-tauri/src/main.rs` - register tray, show command, close handler
- MODIFY `src-tauri/tauri.conf.json` - set visible false, window dimensions
- MODIFY `src-tauri/Cargo.toml` - add tauri-plugin-autostart
- COPY `carina_logo_1.png` -> `apps/desktop/public/logo/carina_logo_1.png`
- COPY `carina_logo_rectangular.png` -> `apps/desktop/public/logo/carina_logo_rectangular.png`
