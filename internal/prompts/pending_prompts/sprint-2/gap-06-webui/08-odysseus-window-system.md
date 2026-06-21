# Gap 6.8; Odysseus Window System for Carina Web UI

> **REUSE RULE:** See `../REUSE-RULES.md`. File name references the behavioral source only. All implementation must use Carina's own voice, naming, CLI output, and UI copy. No competitor brand names in any shipped file.


**Status:** Missing
**Reference agent:** Odysseus (vanilla JS, 14+ tool windows)
**Existing code:** `app.carinaai.uk/src/`; Next.js App Router, 75+ TSX files, sidebar + page-based layout
**Target:** Carina's web UI becomes a desktop-like window environment. Every tool opens as a draggable, resizable, snappable, dockable window. Carina's dark green palette and feel intact.

---

## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`


## What Odysseus Has That Carina Doesn't

Odysseus's web UI is not a page-based web app. It's a browser-native window manager. Every tool; Calendar, Brain, Library, Notes, Tasks, Gallery, Cookbook, Deep Research, Compare, Email, Theme, Settings; opens as a floating `.modal` element, not as a route change.

### The window system (3 core files, ~60KB)

**`windowDrag.js` (333 lines, 15KB):**
- `makeWindowDraggable(modal, { content, header, ...options })`; universal drag helper
- Drag handle: any `.modal-header` element. Clicks on buttons/inputs inside header are excluded from starting a drag (`skipSelector`).
- Top-edge snap to fullscreen: cursor within 6px of viewport top on mouseup enters fullscreen. Cursor moves down past 24px exits fullscreen. `onEnterFullscreen`/`onExitFullscreen` callbacks let each tool define its own fullscreen CSS.
- Left/right edge dock: cursor within 60px of left/right edge triggers dock. Each docked window gets a class (`modal-left-docked` / `modal-right-docked`) and the workspace body gets a CSS variable (`--left-dock-w` / `--right-dock-w`) so the chat area reserves space. Resize handle between docked window and chat.
- Touch support: `enableTouch` flag. Disabled on mobile viewports below `mobileSkip` width (768px default).
- Native-like: drag, snap, dock all feel like a desktop OS.

**`windowResize.js` (233 lines, 10KB):**
- `makeWindowResizable(content, { modal, minWidth, minHeight, storageKey, ... })`; universal resize helper
- No injected handle elements. Uses edge-proximity detection: pointer within 7px of any of the 4 edges or 4 corners arms a resize grip. Works uniformly regardless of the window's internal overflow model.
- 8-direction resize: N, S, E, W, NE, NW, SE, SW; cursor changes to match.
- Minimum size enforcement (320px wide, 200px tall).
- localStorage persistence per tool via `storageKey`.
- Locked when fullscreen or docked.

**`modalSnap.js` (1079 lines, 47KB):**
- `makeEdgeDockController(content, options)`; full left/right docking with resize handles
- Right-edge dock: modal slides to `right: 0; top: 0; bottom: 0` with configurable width. Workspace reserves space via `--right-dock-w` CSS variable.
- Left-edge dock: mirrors the right dock. Sidebar auto-collapses if remaining chat width drops below 380px (mirrors existing notes-view UX).
- Inter-window awareness: knows if another window is already docked on a side. Prevents stacking.
- Snap zones: 60px from edge triggers dock. 80px pull-away undocks.
- Width persistence per window type in localStorage.

### The modal structure

Every tool window follows the same DOM pattern:
```html
<div class="modal" id="tool-name-modal">
  <div class="modal-content">
    <div class="modal-header">
      <h2>Tool Name</h2>
      <button class="modal-minimize">_</button>
      <button class="modal-close"></button>
    </div>
    <div class="modal-body">
      <!-- tool-specific content -->
    </div>
  </div>
</div>
```

Integration is three lines per tool:
```javascript
const modal = document.getElementById('calendar-modal');
const content = modal.querySelector('.modal-content');
const header = modal.querySelector('.modal-header');
makeWindowDraggable(modal, { content, header, fsClass: 'calendar-fs' });
makeWindowResizable(content, { modal, storageKey: 'odysseus-calendar-size' });
```

### Background effects

Odysseus has a canvas-based background effect system (`theme.js`, 400+ lines). Each theme has a default pattern rendered on a full-viewport canvas behind the workspace:

- `synapse`; neural-network nodes and connections (cyberpunk theme)
- `embers`; floating orange particles (retrowave theme)
- `petals`; falling petals (forest, ume themes)
- `constellations`; starfield with connecting lines (ocean theme)
- `perlin-flow`; flowing Perlin noise (terminal theme)
- `sparkles`; pink sparkles (cute theme)
- `rain`; rainfall (midnight, organs themes)
- `dots`; subtle dot grid (light, paper themes)

Effects have: color (`bgEffectColor`), intensity (`bgEffectIntensity`, 0-1), and size (`bgEffectSize`). All configurable per theme.

### Theme system

11 themes. Each defines: base colors (CSS custom properties), default pattern, default effect color, default intensity. Theme JSON stored in localStorage. Login page pre-reads theme to set initial background effect before the app loads.

### Keyboard shortcuts
- `Ctrl+K`; search across sessions, tools, commands
- Window management: not observed in snapshot but likely from the Command Palette

---

## What Carina Already Has (build on, don't replace)

Carina's `app.carinaai.uk` is a Next.js App Router app with:

| Existing | Notes |
|----------|-------|
| Chat workspace | `ChatView`, `ChatPanel`, `ChatInputBar`, streaming, tool calls |
| Sidebar | `AppSidebar` with all tool links |
| Side panels | `MemoryPanel`, `NotesPanel`, `SkillsPanel` as slideovers |
| Full-page tools | Calendar (`/calendar`), Documents (`/documents`), Email (`/email`), Research (`/research`), Tasks (`/tasks`), Library (`/library`), Dashboard (`/dashboard`), Billing (`/billing`), Security (`/security`), Settings (`/settings`) |
| Theme system | `ThemeProvider`, `ThemeSelector`, `AppearanceSettings`; 4 themes (dark, light, midnight, forest) |
| CSS custom properties | Full token system via `ThemeProvider` |
| Command palette | `CommandPalette.tsx`, `GlobalShortcuts.tsx` |
| Core surface banner | `CoreSurfaceBanner`; shows host status |

Carina's architecture is already well-structured. The gap is not missing tools; it's that every tool is a separate page route. Opening Calendar navigates away from Chat. The user can't see Chat and Calendar simultaneously.

---

## What To Build

### Phase 1; Window Manager Core (1 week)

Port the three Odysseus helpers into Carina as React hooks + CSS:

1. **`useWindowDrag(ref, options)`**; React hook wrapping `makeWindowDraggable`. Attached via `useEffect` + `useRef` on the modal element. Options: `onEnterFullscreen`, `onExitFullscreen`, `enableDock`, `enableFullscreen`, `skipSelector`, `mobileSkip`.

2. **`useWindowResize(ref, options)`**; React hook wrapping `makeWindowResizable`. Options: `minWidth`, `minHeight`, `storageKey`, `isLocked`.

3. **`useEdgeDock(ref, options)`**; React hook for left/right docking. Manages CSS classes on `document.body` and CSS variables for workspace reservation.

4. **`<WindowShell>` component**; renders the modal wrapper: `<div class="carina-window">` with `<WindowHeader>` (title, minimize, close, drag handle), `<div class="carina-window-body">` (content slot). Handles z-index stacking (bring to front on mousedown).

5. **CSS**: Port Odysseus's window CSS into Carina's token system. Window shadows, border radius (Carina's `--r-lg = 16px`), backdrop blur, resize cursors. Use Carina's palette.

### Phase 2; Convert Page Routes to Windows (1 week)

Convert each full-page tool into a window that opens over the chat workspace:

| Tool | Current | Target |
|------|---------|--------|
| Calendar | `/calendar` page | `<CalendarWindow>`; month/week/year/agenda views, DB sync, new event |
| Documents | `/documents` page | `<DocumentsWindow>`; file list, upload, preview |
| Email | `/email` page | `<EmailWindow>`; inbox, compose, send |
| Research | `/research` page | `<ResearchWindow>`; research sessions, results |
| Tasks | `/tasks` page | `<TasksWindow>`; task list, create, manage |
| Library | `/library` page | `<LibraryWindow>`; knowledge base browser |
| Settings | `/settings` page | `<SettingsWindow>`; keys, calendar connection, appearance |
| Dashboard | `/dashboard` page | `<DashboardWindow>`; host status, Scout metrics |
| Security | `/security` page | `<SecurityWindow>`; Scout console embedded |
| Billing | `/billing` page | `<BillingWindow>`; plans, usage, invoices |

Implementation: create `<FooWindow>` components that wrap the existing page content in `<WindowShell>`. The window component imports the existing page logic. The sidebar link switches from `router.push('/calendar')` to `openWindow('calendar')`; a simple state change, not a route change. Tools stay open across "navigation."

### Phase 3; Convert Slideover Panels to Windows (3 days)

MemoryPanel, NotesPanel, SkillsPanel are currently slideovers. Convert to proper windows:

- `<MemoryWindow>`; full memory browser with search, sort, edit, delete, import/export
- `<NotesWindow>`; notes editor with pinning
- `<SkillsWindow>`; skill browser with install/uninstall

### Phase 4; Sidebar-Tools Conversion (3 days)

Convert sidebar links from route changes to window toggles. Add window-open indicators (dot/badge on sidebar icon when tool window is open). Add "Close all windows" action. Window state persistence in localStorage.

### Phase 5; Chat Enhancements (3 days)

- **PTY Bridge**: Embedded terminal chat as a window. Port Hermes's PTY bridge concept. WebSocket connection to core agent. Full terminal emulation in a draggable window.
- **Agent/Chat toggle**: Odysseus has this in the composer. Add to Carina's `ChatInputBar`. "Agent" mode = autonomous tool use. "Chat" mode = conversation only.
- **Trajectory compaction**: Button in composer like Odysseus's "trajectory-compaction" button. Compacts chat context to save tokens.

### Phase 6; Background Effects (2 days)

Port Odysseus's canvas background effect system into Carina's ThemeProvider:

1. **`<BackgroundEffect>` component**; full-viewport canvas behind workspace. Renders active theme's default pattern.
2. **Pattern renderers**: Port `synapse`, `constellations`, `petals`, `perlin-flow`, `sparkles`, `embers`, `rain`, `dots` from Odysseus. Adapt colors to Carina's green palette.
3. **Carina-specific patterns**: Add a new pattern; `circuit` (green circuit traces on dark background) or `pulse` (expanding green rings) as Carina's default. Carina's identity is green + autonomous agents. The background should feel like an AI system, not just decorative.
4. **Theme settings**: Add background effect picker to AppearanceSettings. Intensity slider. Pattern preview.

### Phase 7; Scout & Host Integration (2 days)

**Host Status Panel** (from OpenClaw):
- Live gateway uptime, agent count, paired devices, cron jobs, channels
- Connection status pills (green/red)
- Pinned to sidebar or as a collapsible bar; always visible unless dismissed
- Polls `core.carinaai.uk/api/control/status` every 30s

**Scout Integration** (native, not redirect):
- Scout dashboard embedded as a window, not a redirect to `console.labyrinthscout.com`
- Scout API key injected into window context (already done for hosted mode)
- Kill switch accessible from host status panel
- Live threat feed as a minimizable widget

### Phase 8; Polish (3 days)

- Window open/close animations (scale + fade, 200ms)
- Minimize to sidebar (window collapses to a tab at the bottom of the sidebar)
- Window cascade (new windows offset by 20px from previous)
- Window z-stack management (click to bring to front)
- Keyboard shortcuts: `Ctrl+1-9` to focus tool windows, `Ctrl+W` to close focused window, `Ctrl+Shift+W` to close all
- Touch support on tablets
- Responsive: on mobile (< 768px), windows become fullscreen sheets (existing modal pattern)

---

## Total Effort

| Phase | Scope | Effort |
|-------|-------|--------|
| 1; Window Manager Core | 3 hooks + `<WindowShell>` + CSS | 1 week |
| 2; Convert Page Routes | 10 windows from existing pages | 1 week |
| 3; Convert Panels | Memory, Notes, Skills windows | 3 days |
| 4; Sidebar Integration | Window state, indicators, persistence | 3 days |
| 5; Chat Enhancements | PTY bridge, Agent/Chat toggle, compaction | 3 days |
| 6; Background Effects | Canvas system, patterns, Carina-specific pattern | 2 days |
| 7; Scout & Host | Host panel, Scout window, kill switch | 2 days |
| 8; Polish | Animations, shortcuts, responsive | 3 days |

**Total: ~5 weeks**

---

## Carina Identity Rules (non-negotiable)

- **Palette**: `--bg: #06090f`, `--bg-lift: #0c1118`, `--bg-card: #111722`, `--border: rgba(255,255,255,0.07)`, `--green: #16c97e`, `--green-dim: rgba(22,201,126,0.12)`, `--green-glow: rgba(22,201,126,0.20)`, `--text-primary: #f0f4f8`, `--text-mid: #8a9bb0`, `--text-dim: #4d6070`. All new components use these tokens.
- **Corner radius**: `--r: 6px`, `--r-md: 10px`, `--r-lg: 16px`
- **Font**: Inter, system-ui, sans-serif
- **No red**; that's Scout's colour. Carina windows use green accents.
- **Scout windows** (Dashboard, Security) use red/amber accents to distinguish them as security tools.
- **MIT license footer** remains on all surfaces (already done via `license-footer.ts`).

---

## Reference Code

```
Odysseus window system:
  /opt/lampp/htdocs/odysseus/static/js/windowDrag.js; drag + snap
  /opt/lampp/htdocs/odysseus/static/js/windowResize.js; resize
  /opt/lampp/htdocs/odysseus/static/js/modalSnap.js; edge docking
  /opt/lampp/htdocs/odysseus/static/js/theme.js; background effects

Carina frontend:
  /opt/lampp/htdocs/verlox/carina/app.carinaai.uk/src/
  ├── components/shell/AppSidebar.tsx
  ├── components/chat/ChatView.tsx
  ├── components/panels/MemoryPanel.tsx
  └── app/(workspace)/layout.tsx
```

---

## Build Order

```
Week 1: Phase 1; Window Manager Core
Week 2: Phase 2; Convert Page Routes to Windows
Week 3: Phase 3 + 4; Convert Panels + Sidebar Integration
Week 4: Phase 5 + 6; Chat Enhancements + Background Effects
Week 5: Phase 7 + 8; Scout/Host Integration + Polish
```

All existing page routes continue working. Windows are additive. Route-based access still works for deep links. The window system is the primary interaction model in the workspace.