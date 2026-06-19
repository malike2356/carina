# Carina Desktop (Electron scaffold)

Status: scaffold only (DGR-D05, UCG-08). The supported desktop path today is the web UI plus CLI/TUI.

## Quick start (future)

```bash
cd native/desktop
npm install
npm run dev
```

The scaffold wraps `http://localhost:3000` in Electron with secure defaults (no nodeIntegration in renderer).

## When to adopt

- You need OS notifications, global shortcuts, or offline file drag-drop beyond the PWA.
- You do not need a separate codebase; prefer `/` web UI until Electron adds clear value.
