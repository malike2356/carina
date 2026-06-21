# Prompt 01: Tauri Scaffold for Carina Desktop


## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`

## Context

The Carina desktop app wraps the `app.carinaai.uk` workspace in a native Tauri 2.x shell.
The web workspace is the source of truth; the desktop app adds native OS capabilities on top.

Note: `/opt/lampp/htdocs/claudia/` is a separate Tauri app (Opcode CLI). Do NOT modify it.
Create the Carina desktop app at `core.carinaai.uk/apps/desktop/`.

## What to Build

### 1. Tauri project scaffold

```bash
cd core.carinaai.uk
pnpm create tauri-app apps/desktop --template react-ts --manager pnpm
```

After scaffold, update `apps/desktop/src-tauri/tauri.conf.json`:
```json
{
  "productName": "Carina",
  "version": "1.0.0",
  "identifier": "uk.carinaai.desktop",
  "build": {
    "frontendDist": "../../apps/cloud/dist",
    "devUrl": "http://localhost:5173"
  },
  "app": {
    "windows": [
      {
        "title": "Carina",
        "width": 1200,
        "height": 800,
        "minWidth": 900,
        "minHeight": 600,
        "resizable": true,
        "decorations": true
      }
    ]
  },
  "plugins": {
    "shell": { "open": true },
    "notification": { "all": true },
    "fs": {
      "scope": ["$HOME/.carina/**", "$APPDATA/Carina/**"]
    }
  }
}
```

The desktop app loads the compiled web workspace from `apps/cloud/dist/` in production
and from the Vite dev server in development.

### 2. Rust backend (minimal)

`apps/desktop/src-tauri/src/main.rs` starts with a minimal Tauri app:
```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
  tauri::Builder::default()
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_notification::init())
    .plugin(tauri_plugin_fs::init())
    .run(tauri::generate_context!())
    .expect("error running Carina desktop");
}
```

### 3. Package.json scripts

In `core.carinaai.uk/package.json`, add:
```json
"desktop:dev": "pnpm -F apps/desktop tauri dev",
"desktop:build": "pnpm -F apps/cloud build && pnpm -F apps/desktop tauri build",
"desktop:build:linux": "pnpm desktop:build -- --target x86_64-unknown-linux-gnu",
"desktop:build:mac": "pnpm desktop:build -- --target aarch64-apple-darwin",
"desktop:build:windows": "pnpm desktop:build -- --target x86_64-pc-windows-msvc"
```

### 4. App icon

Use the existing Carina branding assets from `instructions/design/branding/`. Convert
to the sizes required by Tauri: 32x32, 128x128, 256x256 PNG plus `.ico` (Windows)
and `.icns` (macOS). Place in `apps/desktop/src-tauri/icons/`.

### 5. Auto-updater

Configure Tauri's built-in updater plugin:
```json
"plugins": {
  "updater": {
    "pubkey": "...",
    "endpoints": ["https://releases.carinaai.uk/desktop/{{target}}/{{arch}}/{{current_version}}"]
  }
}
```

The update endpoint serves a JSON manifest from `carinaai.uk/releases/`. Releases are
triggered by a GitHub Actions workflow that builds all three platforms and uploads artifacts.

## Verification Checklist

- [ ] `pnpm desktop:dev` opens the Carina workspace in a native window
- [ ] App title bar shows "Carina" (not the default Tauri title)
- [ ] Window min size is enforced (can't resize smaller than 900x600)
- [ ] App icon appears in taskbar / dock
- [ ] `pnpm desktop:build` produces a native binary in `apps/desktop/src-tauri/target/release/`

## Files to Create or Modify

- CREATE `apps/desktop/` (Tauri project via scaffold)
- MODIFY `apps/desktop/src-tauri/tauri.conf.json` - configure for Carina
- MODIFY `apps/desktop/src-tauri/src/main.rs` - add plugins
- MODIFY `core.carinaai.uk/package.json` - add desktop scripts
