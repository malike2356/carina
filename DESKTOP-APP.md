# Self-Hosted Web UI; Gaps & Desktop App

**Date:** 15 June 2026
**Status:** Web UI exists. Docs + desktop packaging are the gaps.

---

## Gap 1; Docs don't surface the web UI clearly

**Current state:** `carina gateway start` works and serves the full web UI at `localhost:3000`; same interface as carinaai.uk. But the getting-started docs lead with CLI/TUI and bury the web gateway.

**Fix in `docs/getting-started.md`:**

Add after the "First run" section:

```markdown
## Web UI

Carina includes a browser interface; the same one that powers carinaai.uk:

```bash
carina gateway start
```

Open `http://localhost:3000` in your browser. You get:

- Streaming chat with session management
- Provider switching, slash commands, tool activity
- Memory browser, skill pack marketplace
- Settings, billing, security dashboard
- Dark theme matching carinaai.uk

Set `WEB_PASSWORD` in `~/.carina/.env` to enable login auth. Without it the UI is open (single-user).

On Chrome/Edge, click "Install Carina" in the address bar to add it as a standalone desktop app (PWA).
```

**Also update** `<meta description>` on carinaai.uk to include "web UI"; currently says "Self-host from npm" but doesn't mention the browser interface.

---

## Gap 2; Desktop app (Electron/Tauri wrapper)

**Current state:** The web UI is a PWA (service worker + manifest already served). Users can install it from Chrome. This gets them 80% of a desktop app.

**To make it a proper distributable desktop app:**

### Option A: Tauri (recommended; lighter, Rust backend)
- Wrap the existing Express server as a Tauri sidecar
- Load `http://localhost:PORT` in a Tauri webview
- Ship as `.deb` (Linux), `.dmg` (macOS), `.exe` (Windows)
- ~5 MB binary vs ~150 MB Electron
- Auto-start server on app launch, kill on close

### Option B: Electron
- Wrap the same Express server
- Larger bundle but more mature ecosystem
- Easier auto-update support

### What needs to happen:
1. Create `desktop/` directory in the repo
2. Add `tauri.conf.json` or Electron `main.js`
3. Bundle the Express server as a child process
4. Add EAS-like build pipeline for cross-platform distribution
5. Auto-update support (Tauri updater or electron-updater)
6. System tray icon with quick actions
7. Native notifications (already partially covered by PWA)

### Priority: Low
The PWA covers most use cases. A proper desktop app matters when:
- Users expect a downloadable installer (less friction than `npm install -g`)
- You want to ship to people who don't use the terminal
- System tray persistence (Carina running in background, accessible from menu bar)
