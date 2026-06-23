**Status: COMPLETED 2026-06-21**

**What was built:** Web launcher state machine (primary/sidebar/expanded), Next.js launcher API routes, desktop cold-start launcher, mobile session redirect + live status, TUI real data wiring.

# gap-16: Carina Launcher


## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`

## Purpose

The Carina Launcher is the first screen every user sees. It is not a chat interface.
It is an entry point: a status dashboard + workspace picker that gives the user instant
situational awareness before they commit to a session.

The launcher exists in four forms:
- Web: rendered inside the cloud app (app.carinaai.uk) as the pre-session home screen
- Desktop: Tauri native window (apps/desktop/) - same design, native window chrome
- Mobile: Expo/React Native full-screen splash + quick-launch
- TUI: terminal rendition via Ink (carina CLI, no args) for power users and headless servers

## Design Reference

All four forms are defined by the ChatGPT-generated mockups in this directory:
- `01-launcher_primary.png`    - Web/Desktop: default/splash state
- `02-launcher_siderbar.png`   - Web/Desktop: sidebar-expanded state
- `03-launcher_side_expanded_full.png` - Web/Desktop: full dashboard state
- `04-launcher_TUI.png`        - Terminal: full-screen Ink layout

## Logo

- `carina_logo_1.png`           - Icon only (square, use at 48px and 96px)
- `carina_logo_rectangular.png` - Icon + wordmark + tagline (use in splash state)

Copy both PNG files to `apps/cloud/public/logo/` and `apps/desktop/public/logo/`.

## Design Tokens (extract from mockups)

```
bg-base:       #060c18   (outer window / page background)
bg-surface:    #0d1829   (cards, panels)
bg-sidebar:    #080f1e   (left sidebar)
bg-status:     #060c18   (bottom status bar)
border:        #1a2b45
accent-cyan:   #00d4ff   (CONTINUE WORK button, active nav, progress bars)
accent-green:  #16c97e   (ONLINE dot, Scout Protected, health bars)
accent-purple: #9b59f5   (memory node)
accent-orange: #f59e0b   (skills node)
text-primary:  #e8f0f8
text-muted:    #6b8aaa
text-label:    #4a6a8a   (uppercase section labels)
font-ui:       Inter, system-ui, sans-serif
font-mono:     "JetBrains Mono", "Fira Code", monospace  (TUI only)
radius-card:   10px
radius-btn:    8px
```

## Prompt Index

| File | Scope |
|---|---|
| `01-web-launcher-primary-state.md` | Web: splash/default state - full component |
| `02-web-launcher-sidebar-state.md` | Web: sidebar nav and state transitions |
| `03-web-launcher-expanded-state.md` | Web: full dashboard with system status |
| `04-desktop-launcher.md` | Tauri native window adaptation |
| `05-mobile-launcher.md` | Expo/React Native full-screen launcher |
| `06-tui-launcher.md` | Ink TUI terminal launcher |
| `07-data-wiring.md` | API hooks and real data for all launchers |
