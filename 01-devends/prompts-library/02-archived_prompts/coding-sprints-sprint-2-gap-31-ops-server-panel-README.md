# Gap 31 - Ops Server Panel

**Status: COMPLETED 2026-06-21**

**Gap:** 31
**Sprint:** 2
**Type:** Feature - Backend + Frontend
**Target app:** `backends/admin/ops.carinaai.uk/`
**Primary agent:** Cursor (TypeScript + EJS)
**Estimated hours:** 6-8 h total

---

## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`


## Goal

Add a "Server" section to ops.carinaai.uk that lets an operator:

1. Browse the VPS filesystem and view/edit config files without SSHing in
2. See which services are running and restart them from the browser
3. Tail log files live in the browser

This is a GUI layer on top of what already exists on the VPS. The PTY terminal
at `/tui` handles arbitrary shell commands. The server panel is NOT a terminal;
it is a structured GUI for the three specific operations above.

---

## What already exists in ops.carinaai.uk

All paths below are relative to `backends/admin/ops.carinaai.uk/`.

- Express + EJS with TypeScript (ESM modules)
- `server.ts` - app entry point, registers all routers
- `routes/` - one file per feature area
- `views/` - EJS templates; `views/layout.ejs` wraps all views automatically
- `middleware/auth.ts` - `requireAdmin` (any logged-in user) and `requireSuperAdmin` (role === 'superadmin')
- `routes/scout-dashboard.ts` - shows how to stream SSE data and proxy external APIs
- `routes/tui.ts` - PTY bridge (terminal already works; do not rebuild it)
- `lib/` - shared helpers

The layout.ejs sidebar nav has an "Admin" group at the bottom (line ~143) that
currently contains Operator Chat, Settings, Users. Add "Server" to this group.

---

## Files to create

```
backends/admin/ops.carinaai.uk/lib/server-fs.ts
backends/admin/ops.carinaai.uk/lib/server-services.ts
backends/admin/ops.carinaai.uk/routes/server-panel.ts
backends/admin/ops.carinaai.uk/views/server/index.ejs
backends/admin/ops.carinaai.uk/views/server/files.ejs
backends/admin/ops.carinaai.uk/views/server/services.ejs
backends/admin/ops.carinaai.uk/views/server/logs.ejs
```

## Files to modify

```
backends/admin/ops.carinaai.uk/server.ts            - add serverPanelRouter import + mount
backends/admin/ops.carinaai.uk/views/layout.ejs     - add Server nav link in Admin group
core.carinaai.uk/docker/docker-compose.prod.yml     - add pid: "host" to ops service (for service restarts)
```

---

## Build Order

```
01-file-browser.md       server-fs.ts + routes/server-panel.ts (files section) + views/server/files.ejs
02-service-control.md    server-services.ts + routes/server-panel.ts (services section) + views/server/services.ejs
03-log-streamer.md       routes/server-panel.ts (logs SSE section) + views/server/logs.ejs
```

After each prompt: wire the new route into server.ts and add the nav link.

---

## Done When

- [ ] GET /server shows landing with links to Files, Services, Logs
- [ ] GET /server/files renders file tree for allowlisted roots; clicking a file shows content in Monaco editor
- [ ] POST /server/files/write saves a file (superadmin only); returns flash on success/failure
- [ ] GET /server/services shows status badges for nginx container, php8.3-fpm, and all running Docker containers
- [ ] POST /api/server/services/:name/restart restarts a service (superadmin only)
- [ ] GET /server/logs shows a log file picker grouped by source
- [ ] GET /api/server/logs/stream?file=... streams live log lines via SSE
- [ ] All routes behind requireAdmin; writes and restarts behind requireSuperAdmin
- [ ] No path traversal: file browser and log streamer validate paths against allowlists
- [ ] TypeScript compiles with no errors
