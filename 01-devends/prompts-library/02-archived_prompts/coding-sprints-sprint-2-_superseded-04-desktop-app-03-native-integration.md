# Prompt 03: Native Integration (System Tray, Shortcuts, Deep Links)


## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`

## Context

Desktop apps have native OS integration points that web apps cannot access. This prompt
adds system tray, global keyboard shortcuts, deep links, and desktop notifications to
the Carina desktop app built in Prompt 01.

## What to Build

### 1. System tray

In `apps/desktop/src-tauri/src/tray.rs`:
```rust
use tauri::{
  menu::{Menu, MenuItem},
  tray::{MouseButton, TrayIconBuilder, TrayIconEvent},
  Manager,
};

pub fn setup_tray(app: &tauri::App) {
  let show = MenuItem::with_id(app, "show", "Show Carina", true, None::<&str>).unwrap();
  let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>).unwrap();
  let menu = Menu::with_items(app, &[&show, &quit]).unwrap();

  TrayIconBuilder::new()
    .icon(app.default_window_icon().unwrap().clone())
    .menu(&menu)
    .on_menu_event(|app, event| match event.id.as_ref() {
      "show" => { let w = app.get_webview_window("main").unwrap(); w.show().unwrap(); }
      "quit" => app.exit(0),
      _ => {}
    })
    .on_tray_icon_event(|tray, event| {
      if let TrayIconEvent::Click { button: MouseButton::Left, .. } = event {
        let app = tray.app_handle();
        if let Some(window) = app.get_webview_window("main") {
          window.show().unwrap();
          window.set_focus().unwrap();
        }
      }
    })
    .build(app)
    .unwrap();
}
```

Clicking the tray icon shows/hides the main window. Closing the main window minimizes to
tray rather than quitting (configured by intercepting the `close-requested` event).

### 2. Global keyboard shortcuts

In `apps/desktop/src-tauri/src/shortcuts.rs`:
```rust
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

pub fn register_shortcuts(app: &tauri::AppHandle) {
  // Ctrl+Shift+Space (or Cmd+Shift+Space on Mac): show/hide Carina
  let shortcut = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::Space);
  app.global_shortcut().on_shortcut(shortcut, move |app, _, event| {
    if event.state == ShortcutState::Pressed {
      if let Some(window) = app.get_webview_window("main") {
        if window.is_visible().unwrap_or(false) {
          window.hide().unwrap();
        } else {
          window.show().unwrap();
          window.set_focus().unwrap();
        }
      }
    }
  }).unwrap();
}
```

### 3. Deep links

Register `carina://` as a custom URI scheme so other apps can open Carina:
```
carina://session/<id>    - open a specific session
carina://memory/<id>     - open a memory record
carina://ask/<message>   - pre-fill and send a message
```

In `tauri.conf.json`:
```json
"plugins": {
  "deep-link": {
    "mobile": [],
    "desktop": {
      "schemes": ["carina"]
    }
  }
}
```

Handle in `main.rs`:
```rust
.plugin(tauri_plugin_deep_link::init())
.setup(|app| {
  app.listen("deep-link://new-url", |event| {
    // parse the deep link URL and route to the right page
    println!("Deep link: {:?}", event.payload());
  });
  Ok(())
})
```

### 4. Desktop notifications

Use Tauri's notification plugin for native OS notifications:
```typescript
// apps/cloud/src/lib/notify.ts
import { sendNotification, isPermissionGranted, requestPermission } from '@tauri-apps/plugin-notification';
import { isTauri } from '@tauri-apps/api/core';

export async function notifyUser(title: string, body: string): Promise<void> {
  if (!isTauri()) {
    new Notification(title, { body });
    return;
  }
  if (!await isPermissionGranted()) await requestPermission();
  sendNotification({ title, body });
}
```

## Verification Checklist

- [ ] Carina icon appears in system tray after app starts
- [ ] Left-click tray icon shows/hides main window
- [ ] Closing main window minimizes to tray (does not quit)
- [ ] Ctrl+Shift+Space globally shows/hides Carina even when other apps are focused
- [ ] `carina://ask/hello` deep link opens Carina and pre-fills "hello" in chat
- [ ] Scout critical alert shows as native OS notification

## Files to Create or Modify

- CREATE `apps/desktop/src-tauri/src/tray.rs`
- CREATE `apps/desktop/src-tauri/src/shortcuts.rs`
- MODIFY `apps/desktop/src-tauri/src/main.rs` - register tray, shortcuts, deep links
- MODIFY `apps/desktop/src-tauri/tauri.conf.json` - add deep-link scheme
- CREATE `apps/cloud/src/lib/notify.ts`
- MODIFY `apps/cloud/src/lib/scout-alerts.ts` - use notifyUser for critical alerts
