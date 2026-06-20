# Prompt 02: Native Window Composer and Page Layout

## Context

The desktop app can open documents, sessions, and tools in separate native windows via
Tauri's multi-window API. The "composer" pattern lets operators open a task (e.g., a security
report) as a side-by-side native window alongside the main workspace window.

## What to Build

### 1. Multi-window manager (Rust side)

In `apps/desktop/src-tauri/src/windows.rs`:
```rust
use tauri::{Manager, WebviewWindowBuilder};

#[tauri::command]
pub fn open_composer_window(app: tauri::AppHandle, url: String, title: String) {
  let label = format!("composer-{}", uuid::Uuid::new_v4());
  WebviewWindowBuilder::new(&app, label, tauri::WebviewUrl::App(url.into()))
    .title(title)
    .width(800)
    .height(700)
    .min_width(600)
    .min_height(400)
    .build()
    .expect("failed to open composer window");
}
```

Register in `main.rs`:
```rust
.invoke_handler(tauri::generate_handler![windows::open_composer_window])
```

### 2. Composer trigger from web UI

In `apps/cloud/src/lib/desktop.ts`:
```typescript
import { invoke, isTauri } from '@tauri-apps/api/core';

export async function openInComposer(path: string, title: string): Promise<void> {
  if (!isTauri()) {
    // Fallback: open in new browser tab
    window.open(path, '_blank');
    return;
  }
  await invoke('open_composer_window', { url: path, title });
}
```

### 3. Page types that open in composer

| Page | Path | Title pattern |
|------|------|--------------|
| Document view | `/documents/<id>` | Document: <name> |
| Scout report | `/scout/reports/<id>` | Scout Report: <date> |
| Session transcript | `/sessions/<id>/export` | Session: <id> |
| Skill runner | `/skills/<name>/run` | Skill: <name> |
| Terminal (PTY) | `/terminal` | Terminal |

Add "Open in window" button to each page type. In desktop mode, clicking it calls
`openInComposer()`. In browser mode, clicking it opens a new tab.

### 4. Page layout for composer windows

When a page is opened in a composer window, it should render in a simplified "focus mode"
layout without the sidebar navigation. Detect this via a `?mode=composer` URL parameter:
```tsx
const isComposer = new URLSearchParams(location.search).get('mode') === 'composer';
if (isComposer) return <ComposerLayout>{children}</ComposerLayout>;
return <WorkspaceLayout>{children}</WorkspaceLayout>;
```

`ComposerLayout` is full-width, no sidebar, no top navigation, just a narrow title bar.

## Verification Checklist

- [ ] "Open in window" button appears on Document view page in desktop app
- [ ] Clicking it opens a new native window with the document
- [ ] New window has title "Document: <name>"
- [ ] New window uses ComposerLayout (no sidebar)
- [ ] In browser mode, "Open in window" opens a new browser tab instead

## Files to Create or Modify

- CREATE `apps/desktop/src-tauri/src/windows.rs`
- MODIFY `apps/desktop/src-tauri/src/main.rs` - register windows commands
- CREATE `apps/cloud/src/lib/desktop.ts`
- MODIFY `apps/cloud/src/pages/DocumentPage.tsx` - add "Open in window" button
- MODIFY `apps/cloud/src/pages/ScoutReportPage.tsx` - add "Open in window" button
- CREATE `apps/cloud/src/components/ComposerLayout.tsx`
