# Sprint 2 - Category 04: Desktop App


## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`

## What Exists

- `carinaMobile/` - 121-file React Native app (mobile, not desktop)
- `/opt/lampp/htdocs/claudia/` - Separate Tauri 2.x + TypeScript + React desktop app (Opcode CLI)
- No Carina-specific Tauri desktop app exists yet

## What Is Missing

- Tauri scaffold for Carina desktop (wraps web workspace, adds native features)
- Chat composer with page-based layout (documents, tasks in native windows)
- Native integration (system tray, global shortcuts, deep links, file access)
- Carina-specific desktop features (local terminal bridge, offline mode)
- Offline sync for memory and sessions

## Prompts in This Category

- `01-tauri-scaffold.md` - Tauri project scaffold wrapping app.carinaai.uk workspace
- `02-composer-pages.md` - Native window composer and page-based layout
- `03-native-integration.md` - System tray, shortcuts, deep links, notifications
- `04-carina-features.md` - Local terminal bridge, file access, offline mode
- `05-offline-sync.md` - Memory and session sync when offline

## Original Reference

`sprint-2/gap-04-desktop/`
