# Prompt 13: Sessions, Checkpoints, Memory, and Backup

You are working in the Carina mono-repo at `core.carinaai.uk/`.

## What already exists

**Session search backend:**
- `src/memory/session-search-service.ts` - `searchSessions(query, opts)`, `getRecentSessions(limit)`
- `src/memory/session-index.ts` - index building and maintenance
- `src/memory/session-scroll.ts` - cursor-based pagination

**Checkpoint backend:**
- `src/tools/checkpoint-manager.ts` - `createCheckpoint()`, `listCheckpoints()`, `restoreCheckpoint(id)`, `deleteCheckpoint(id)`
- `src/tools/checkpoint-store.ts` - JSON-file store under CARINA_HOME/checkpoints/

**Memory API (already mounted):**
- `src/api/memory-api.ts` - routes at /api/memory: search, list, get, delete
- `src/api/memory-api.test.ts` - tests exist

**Backup backend:**
- `src/ops/backup-restore.ts` - exports `createBackup(opts)`, `listBackups()`, `restoreBackup(path)`, `planRestore(path)`
- `BackupManifest` type: `{ id, createdAt, sizeBytes, items: string[] }`
- `DEFAULT_BACKUP_ITEMS` constant: list of files/dirs included by default
- `SENSITIVE_BACKUP_ITEMS`: items skipped (`.env`, `credentials.json`)

**Memory workspace page** (already exists):
- `packages/web/assets/web/memory.html` - session list + search UI
- Served at GET `/memory` with `workspacePage: 'memory'`

## What is missing and must be built

### Part A: Enhance the memory page with session detail and checkpoint panel

The current `/memory` page searches sessions but has no checkpoint or backup panel. Add a tabbed layout to the existing page.

**Tab structure to add inside `memory.html` workspace section:**

```html
<div class="mem-tabs" style="display:flex;gap:0;border-bottom:1px solid var(--border);margin-bottom:0;">
  <button class="mem-tab active" data-tab="sessions">Sessions</button>
  <button class="mem-tab" data-tab="checkpoints">Checkpoints</button>
  <button class="mem-tab" data-tab="backup">Backup</button>
</div>
<div id="tab-sessions">
  <!-- existing session search and list goes here -->
</div>
<div id="tab-checkpoints" hidden>
  <!-- checkpoint list and detail goes here -->
</div>
<div id="tab-backup" hidden>
  <!-- backup status and actions here -->
</div>
```

Tab CSS to add in `<style>`:
```css
.mem-tabs { display:flex; }
.mem-tab { padding:0.55rem 1rem; border:none; border-bottom:2px solid transparent; background:transparent; color:var(--muted); cursor:pointer; font-size:0.82rem; }
.mem-tab.active { color:var(--text); border-bottom-color:var(--accent); }
```

### Part B: Checkpoint API routes

Add to `src/api/memory-api.ts` (or create `src/api/checkpoint-api.ts`):

```typescript
import {
  createCheckpoint,
  listCheckpoints,
  restoreCheckpoint,
  deleteCheckpoint,
} from '../tools/checkpoint-manager.js';

// If adding to memory-api.ts, register under memoryApiRouter:
memoryApiRouter.get('/checkpoints', async (_req, res) => {
  try {
    const items = await listCheckpoints();
    res.json({ checkpoints: items });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

memoryApiRouter.post('/checkpoints', async (_req, res) => {
  try {
    const cp = await createCheckpoint();
    res.status(201).json(cp);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

memoryApiRouter.post('/checkpoints/:id/restore', async (req, res) => {
  try {
    await restoreCheckpoint(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

memoryApiRouter.delete('/checkpoints/:id', async (req, res) => {
  try {
    await deleteCheckpoint(req.params.id);
    res.status(204).end();
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
```

**Checkpoint UI in `#tab-checkpoints`:**

```html
<div style="padding:0.75rem;border-bottom:1px solid var(--border);">
  <button id="create-checkpoint" style="background:var(--accent);color:#0d0d0f;border:none;border-radius:8px;padding:0.45rem 0.85rem;font-size:0.82rem;font-weight:700;cursor:pointer;">
    Create checkpoint
  </button>
</div>
<div id="checkpoint-list" style="overflow-y:auto;flex:1;padding:0.5rem;"></div>
```

JS logic for checkpoints tab:
- `loadCheckpoints()`: GET /api/memory/checkpoints, render list
- Each item shows `id`, `createdAt`, size or session count if available
- Buttons per item: "Restore" (POST /api/memory/checkpoints/:id/restore, confirm first), "Delete" (DELETE, confirm first)
- Show skeleton 3 rows while loading
- Empty state: "No checkpoints. Create one before making major changes."

### Part C: Backup API routes

Create `src/api/backup-api.ts`:

```typescript
import { Router, type Request, type Response } from 'express';
import {
  createBackup, listBackups, restoreBackup, planRestore,
  DEFAULT_BACKUP_ITEMS,
} from '../ops/backup-restore.js';
import path from 'node:path';
import { CARINA_HOME } from '../config/env.js';

export const backupApiRouter = Router();

backupApiRouter.get('/list', async (_req, res) => {
  try {
    const files = await listBackups();
    res.json({ backups: files });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

backupApiRouter.post('/create', async (_req, res) => {
  try {
    const result = await createBackup({ homeDir: CARINA_HOME });
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

backupApiRouter.get('/plan/:filename', async (req, res) => {
  try {
    const file = path.join(CARINA_HOME, 'backups', req.params.filename);
    const plan = await planRestore(file);
    res.json(plan);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

backupApiRouter.post('/restore/:filename', async (req, res) => {
  try {
    const file = path.join(CARINA_HOME, 'backups', req.params.filename);
    await restoreBackup(file);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

backupApiRouter.get('/defaults', (_req, res) => {
  res.json({ items: DEFAULT_BACKUP_ITEMS });
});
```

Mount in `createWebServer()`:
```typescript
import { backupApiRouter } from '#core/api/backup-api.js';
app.use('/api/backup', express.json(), requireAuth, backupApiRouter);
```

**Backup UI in `#tab-backup`:**

```html
<div style="padding:0.75rem;border-bottom:1px solid var(--border);display:flex;gap:0.5rem;align-items:center;">
  <button id="create-backup" style="background:var(--accent);color:#0d0d0f;border:none;border-radius:8px;padding:0.45rem 0.85rem;font-size:0.82rem;font-weight:700;cursor:pointer;">
    Create backup
  </button>
  <span id="backup-status" style="font-size:0.78rem;color:var(--muted);"></span>
</div>
<div style="font-size:0.75rem;color:var(--muted);padding:0.5rem 0.75rem;">
  Backs up: skills, memory, notes, documents, config. Never backs up .env or credentials.
</div>
<div id="backup-list" style="overflow-y:auto;flex:1;padding:0.5rem;"></div>
```

JS for backup tab:
- `loadBackups()`: GET /api/backup/list, render list with filename and size
- `#create-backup` click: POST /api/backup/create, refresh list
- Each backup row: "Restore" button (POST /api/backup/restore/:filename, confirm + show plan first)
- Before restore: GET /api/backup/plan/:filename, show modal with what will be overwritten
- Skeleton: 3 rows while loading
- Empty state: "No backups yet. Create one to protect your skills and memory."

### Part D: Session detail view

The existing `/memory` page lists sessions but has no detail panel. Add session message preview.

When a session is clicked, fetch `GET /api/memory/:id` (already exists in memory-api.ts) and show:
- Session title or first message excerpt
- Message count and token estimate
- Timestamp
- "Open in chat" link: `/?session=<id>`
- "Delete session" button: DELETE /api/memory/:id

Add a detail panel div to `memory.html` alongside the session list:

```html
<div id="session-detail" style="border-left:1px solid var(--border);padding:1rem;overflow-y:auto;display:none;flex-direction:column;gap:0.5rem;min-width:280px;max-width:340px;">
  <div id="session-detail-title" style="font-weight:600;font-size:0.9rem;"></div>
  <div id="session-detail-meta" style="font-size:0.72rem;color:var(--muted);"></div>
  <div id="session-detail-preview" style="font-size:0.8rem;line-height:1.5;color:var(--text);background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:0.65rem;max-height:200px;overflow-y:auto;"></div>
  <div style="display:flex;gap:0.5rem;">
    <a id="session-open-link" href="#" style="background:var(--accent);color:#0d0d0f;border-radius:8px;padding:0.4rem 0.75rem;font-size:0.78rem;font-weight:700;text-decoration:none;">Open</a>
    <button id="session-delete" style="background:var(--surface-2);border:1px solid var(--border);color:var(--danger);border-radius:8px;padding:0.4rem 0.75rem;font-size:0.78rem;cursor:pointer;">Delete</button>
  </div>
</div>
```

## JS file updates

The existing `/memory` page likely has a `memory.js` or inline scripts. Add the tab-switching logic and the checkpoint/backup/session-detail logic to a dedicated `packages/web/assets/web/memory-ext.js` that is loaded after the existing memory script:

```html
<!-- at bottom of memory.html, after existing script -->
<script src="/memory-ext.js"></script>
```

Or, if `memory.html` uses an inline script block, extend it directly.

Serve `memory-ext.js` from web-server.ts:
```typescript
app.get('/memory-ext.js', (_req, res) => {
  res.set('Cache-Control', 'no-cache');
  res.type('application/javascript').sendFile(path.join(WEB_STATIC, 'memory-ext.js'));
});
```

## Tests

Add to `src/api/memory-api.test.ts`:
- GET /api/memory/checkpoints returns `{ checkpoints: [] }` when none exist
- POST /api/memory/checkpoints returns 201 with checkpoint object
- DELETE /api/memory/checkpoints/:id returns 204

Create `src/api/backup-api.test.ts`:
- GET /api/backup/list returns `{ backups: [] }` when no backup dir
- POST /api/backup/create returns result with `path` and `manifest`
- GET /api/backup/plan/:filename returns 400 for non-existent file
- GET /api/backup/defaults returns `{ items: string[] }` with known entries

## Acceptance criteria

- `/memory` has three tabs: Sessions, Checkpoints, Backup
- Sessions tab shows paginated list with search and detail panel on click
- Checkpoints tab shows create, restore, and delete with confirmation
- Backup tab shows create and restore with pre-restore plan modal
- All actions show status feedback and re-render lists after success
- Sensitive files (.env, credentials.json) are never listed in backup plan
