# Prompt 12: Learning Loop, Benchmark Dashboard, and Skill Workshop

You are working in the Carina mono-repo at `core.carinaai.uk/`.

## What already exists

**Benchmark backend (complete):**
- `src/benchmark/runner.ts` - exports `runPlatformBenchmark(): Promise<BenchmarkRunReport>`, `assertBenchmarkRegression()`
- `src/benchmark/types.ts` - `BenchmarkRunReport`, `BenchmarkTaskResult`, `BenchmarkCategorySummary`, `BenchmarkTaskDefinition`
- `src/benchmark/definitions.ts` - task definitions per category
- `src/benchmark/scorer.ts` - scoring logic
- `src/benchmark/report.ts` - report formatting
- `src/benchmark/competitor-baselines.ts` - `CompetitorReference` baselines

**Learning loop backend (complete):**
- `src/skills/learning-loop.ts` - learning loop runner
- `src/skills/learning-events.ts` - event emitters
- `src/skills/learning-ops.ts` - promote/demote operations
- `src/skills/curator-scheduler.ts` - `CARINA_CURATOR_INTERVAL_DAYS` env, runs curator
- `src/skills/skill-audit-log.ts` - audit trail
- `src/skills/skill-versions.ts` - version history
- `src/skills/eval/` - eval pipeline

**Workshop backend (complete):**
- `src/skills/workshop-store.ts` - exports:
  - `listWorkshopDrafts(status?)` - pending/approved/rejected
  - `getWorkshopDraft(id)` - single draft
  - `approveWorkshopDraft(id)` - promotes draft to skill
  - `rejectWorkshopDraft(id)` - rejects draft
  - `enqueueWorkshopDraft(input)` - adds new draft
  - `WorkshopDraft` type: `{ id, skillName, body, source, status, createdAt }`

**Curator API (partial):**
- `src/api/curator-api.ts` - exists; check what workshop routes are present

**No GUI pages exist yet for benchmark or workshop.**

## Part A: Benchmark dashboard page

### Step 1: Add `'benchmark'` to `WorkspacePageId` in `packages/web/src/workspace-chrome.ts`

```typescript
export type WorkspacePageId =
  | 'hub' | 'chat' | 'notes' | 'documents' | 'images' | 'email'
  | 'calendar' | 'memory' | 'packs' | 'playbook' | 'capabilities'
  | 'research' | 'compare' | 'kanban' | 'webhooks'
  | 'benchmark'; // ADD
```

### Step 2: Add nav item in `WORKSPACE_NAV_ITEMS`

```typescript
{
  id: 'benchmark',
  href: '/benchmark',
  label: 'Benchmark',
  description: 'Quality scores and regression tracking',
},
```

### Step 3: Create `src/api/benchmark-api.ts`

```typescript
import { Router, type Request, type Response } from 'express';
import { runPlatformBenchmark } from '../benchmark/runner.js';
import type { BenchmarkRunReport } from '../benchmark/types.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { CARINA_HOME } from '../config/env.js';

export const benchmarkApiRouter = Router();

const historyFile = () => path.join(CARINA_HOME, 'benchmark-history.json');

async function loadHistory(): Promise<BenchmarkRunReport[]> {
  try {
    return JSON.parse(await fs.readFile(historyFile(), 'utf-8'));
  } catch {
    return [];
  }
}

benchmarkApiRouter.get('/history', async (_req, res) => {
  res.json({ runs: await loadHistory() });
});

benchmarkApiRouter.get('/latest', async (_req, res) => {
  const hist = await loadHistory();
  res.json(hist[0] ?? null);
});

benchmarkApiRouter.post('/run', async (_req, res) => {
  try {
    const report = await runPlatformBenchmark();
    const hist = await loadHistory();
    hist.unshift(report);
    await fs.writeFile(historyFile(), JSON.stringify(hist.slice(0, 20), null, 2));
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
```

### Step 4: Mount in `packages/web/src/web-server.ts`

```typescript
import { benchmarkApiRouter } from '#core/api/benchmark-api.js';
// inside createWebServer():
app.use('/api/benchmark', express.json(), requireAuth, benchmarkApiRouter);
```

### Step 5: Load benchmark HTML in `createWebServer()`

```typescript
const benchmarkHtml = decoratePageHtml(
  await fs.readFile(path.join(WEB_STATIC, 'benchmark.html'), 'utf-8').catch(() => null),
  carinaVersion,
  { workspacePage: 'benchmark' },
);
// ...
if (benchmarkHtml) {
  app.get('/benchmark', (_req, res) => { res.type('html').send(benchmarkHtml); });
}
app.get('/benchmark.js', (_req, res) => {
  res.set('Cache-Control', 'no-cache');
  res.type('application/javascript').sendFile(path.join(WEB_STATIC, 'benchmark.js'));
});
```

### Step 6: Create `packages/web/assets/web/benchmark.html`

Key structure:
```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<meta name="theme-color" content="#0d0d0f">
<title>Benchmark; Carina</title>
<style>
  .bm-wrap { flex:1; overflow-y:auto; padding:1rem 1.25rem 2rem; max-width:900px; }
  .bm-toolbar { display:flex; align-items:center; gap:0.75rem; margin-bottom:1rem; flex-wrap:wrap; }
  .bm-toolbar button {
    background:var(--accent); color:#0d0d0f; border:none; border-radius:8px;
    padding:0.55rem 1rem; font-size:0.82rem; font-weight:700; cursor:pointer;
  }
  .bm-toolbar button:disabled { opacity:0.5; cursor:not-allowed; }
  .bm-summary { display:grid; grid-template-columns:repeat(auto-fit, minmax(160px, 1fr)); gap:0.6rem; margin-bottom:1.25rem; }
  .bm-score-card { background:var(--surface-2); border:1px solid var(--border); border-radius:10px; padding:0.75rem 1rem; text-align:center; }
  .bm-score-card .score { font-size:1.6rem; font-weight:800; color:var(--accent); }
  .bm-score-card .label { font-size:0.72rem; color:var(--muted); margin-top:0.2rem; }
  .bm-table { width:100%; border-collapse:collapse; font-size:0.82rem; }
  .bm-table th, .bm-table td { padding:0.5rem 0.6rem; border-bottom:1px solid var(--border); text-align:left; }
  .bm-table th { color:var(--muted); font-weight:500; }
  .pass { color:#4ade80; } .fail { color:var(--danger); }
  .bm-history { margin-top:1.5rem; }
  .bm-history-label { font-size:0.72rem; color:var(--muted); text-transform:uppercase; letter-spacing:0.04em; margin-bottom:0.4rem; }
  .bm-run-chip { display:inline-block; margin:0 0.3rem 0.3rem 0; background:var(--surface-2); border:1px solid var(--border); border-radius:6px; padding:0.25rem 0.6rem; font-size:0.72rem; cursor:pointer; color:var(--text); }
  .bm-run-chip.active { border-color:var(--accent); }
</style>
</head>
<body>
<!--CARINA_WORKSPACE_BEGIN-->
<header class="ws-page-header">
  <h1>Benchmark</h1>
  <span class="status" id="status"></span>
</header>
<div class="bm-wrap">
  <div class="bm-toolbar">
    <button id="run-btn">Run benchmark</button>
    <span style="font-size:0.78rem;color:var(--muted);">Runs all platform benchmark tasks and scores the results against competitor baselines.</span>
  </div>
  <div id="bm-summary" class="bm-summary"></div>
  <table class="bm-table">
    <thead><tr><th>Task</th><th>Category</th><th>Score</th><th>Pass</th><th>Latency</th></tr></thead>
    <tbody id="bm-rows"></tbody>
  </table>
  <div class="bm-history">
    <div class="bm-history-label">Run history</div>
    <div id="bm-history-chips"></div>
  </div>
</div>
<!--CARINA_WORKSPACE_END-->
<script src="/benchmark.js"></script>
</body>
</html>
```

### Step 7: Create `packages/web/assets/web/benchmark.js`

IIFE with:
- `loadHistory()` fetches GET /api/benchmark/history on page load
- `renderReport(report)` populates `.bm-summary` score cards and `#bm-rows` table
- `renderChips()` renders history run buttons, click to load older report
- `#run-btn` click POSTs to /api/benchmark/run, shows loading state, renders on return
- Skeleton: 4 score-card skeletons in `.bm-summary` while loading

Score card per `BenchmarkCategorySummary`: `{ category, score, passRate, taskCount }`.
Table row per `BenchmarkTaskResult`: `{ taskId, category, score, passed, latencyMs }`.

## Part B: Skill Workshop page

### Step 1: Add `'workshop'` to `WorkspacePageId`

```typescript
| 'workshop'
```

### Step 2: Add nav item

```typescript
{
  id: 'workshop',
  href: '/workshop',
  label: 'Workshop',
  description: 'Review and approve AI-generated skill drafts',
},
```

### Step 3: Add workshop routes to `src/api/curator-api.ts`

Check what already exists. If the following routes are absent, add them:

```typescript
import {
  listWorkshopDrafts, getWorkshopDraft,
  approveWorkshopDraft, rejectWorkshopDraft,
} from '../skills/workshop-store.js';

curatorApiRouter.get('/workshop/drafts', (req, res) => {
  const s = String(req.query.status || '');
  const valid = ['pending', 'approved', 'rejected'] as const;
  type S = typeof valid[number];
  res.json({ drafts: listWorkshopDrafts(valid.includes(s as S) ? (s as S) : undefined) });
});

curatorApiRouter.get('/workshop/drafts/:id', (req, res) => {
  const d = getWorkshopDraft(req.params.id);
  if (!d) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(d);
});

curatorApiRouter.post('/workshop/drafts/:id/approve', async (req, res) => {
  try { res.json(await approveWorkshopDraft(req.params.id)); }
  catch (err) { res.status(400).json({ error: err instanceof Error ? err.message : String(err) }); }
});

curatorApiRouter.post('/workshop/drafts/:id/reject', async (req, res) => {
  try { res.json(await rejectWorkshopDraft(req.params.id)); }
  catch (err) { res.status(400).json({ error: err instanceof Error ? err.message : String(err) }); }
});
```

### Step 4: Create `packages/web/assets/web/workshop.html`

Three-column layout: filter sidebar / draft list / draft detail with approve/reject:

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<meta name="theme-color" content="#0d0d0f">
<title>Skill Workshop; Carina</title>
<style>
  body { display:flex; flex-direction:column; height:100vh; }
  .layout { flex:1; display:grid; grid-template-columns:120px 260px 1fr; min-height:0; overflow:hidden; }
  .filter-col { border-right:1px solid var(--border); padding:0.75rem; background:var(--surface-2); display:flex; flex-direction:column; gap:0.25rem; }
  .filter-btn { width:100%; text-align:left; padding:0.45rem 0.65rem; border-radius:8px; border:1px solid transparent; background:transparent; color:var(--text); cursor:pointer; font-size:0.82rem; }
  .filter-btn.active { background:var(--surface); border-color:var(--border); }
  .draft-list { border-right:1px solid var(--border); overflow-y:auto; background:var(--surface-2); }
  .draft-item { padding:0.6rem 0.75rem; border-bottom:1px solid var(--border); cursor:pointer; }
  .draft-item:hover { background:var(--surface); }
  .draft-item.active { background:var(--surface); }
  .draft-title { font-size:0.84rem; font-weight:600; }
  .draft-meta { font-size:0.7rem; color:var(--muted); margin-top:0.15rem; }
  .draft-status { display:inline-block; font-size:0.6rem; text-transform:uppercase; padding:0.08rem 0.3rem; border-radius:4px; }
  .status-pending { background:rgba(251,191,36,0.12); color:#fbbf24; }
  .status-approved { background:rgba(74,222,128,0.12); color:#4ade80; }
  .status-rejected { background:rgba(255,77,106,0.12); color:var(--danger); }
  .detail-pane { display:flex; flex-direction:column; overflow:hidden; padding:1rem; }
  #detail-body { background:var(--surface-2); border:1px solid var(--border); border-radius:8px; padding:0.75rem; font-size:0.8rem; white-space:pre-wrap; overflow-y:auto; flex:1; }
  .detail-actions { display:flex; gap:0.5rem; margin-top:0.75rem; }
  .btn-approve { background:#4ade80; color:#000; border:none; border-radius:8px; padding:0.5rem 1rem; font-weight:700; cursor:pointer; }
  .btn-reject { background:var(--danger); color:#fff; border:none; border-radius:8px; padding:0.5rem 1rem; font-weight:700; cursor:pointer; }
</style>
</head>
<body>
<!--CARINA_WORKSPACE_BEGIN-->
<header class="ws-page-header">
  <h1>Skill Workshop</h1>
  <span class="status" id="status"></span>
</header>
<div class="layout">
  <div class="filter-col">
    <button class="filter-btn active" data-status="">All</button>
    <button class="filter-btn" data-status="pending">Pending</button>
    <button class="filter-btn" data-status="approved">Approved</button>
    <button class="filter-btn" data-status="rejected">Rejected</button>
  </div>
  <div class="draft-list" id="draft-list"></div>
  <div class="detail-pane">
    <div id="detail-empty" style="flex:1;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:0.85rem;">Select a draft to review</div>
    <div id="detail-content" hidden style="display:flex;flex-direction:column;flex:1;overflow:hidden;">
      <h2 id="detail-name" style="font-size:1rem;margin-bottom:0.25rem;"></h2>
      <div id="detail-meta" style="font-size:0.72rem;color:var(--muted);margin-bottom:0.75rem;"></div>
      <pre id="detail-body"></pre>
      <div class="detail-actions">
        <button class="btn-approve" id="approve-btn">Approve</button>
        <button class="btn-reject" id="reject-btn">Reject</button>
      </div>
    </div>
  </div>
</div>
<!--CARINA_WORKSPACE_END-->
<script src="/workshop.js"></script>
</body>
</html>
```

### Step 5: Create `packages/web/assets/web/workshop.js`

IIFE that:
- `loadDrafts(status)` fetches `/api/curator/workshop/drafts?status=<status>` and renders list
- Click draft: fetch `/api/curator/workshop/drafts/:id`, render in detail pane
- `#approve-btn`: POST `/api/curator/workshop/drafts/:id/approve`, refresh list and clear detail
- `#reject-btn`: POST `/api/curator/workshop/drafts/:id/reject`, same
- Filter buttons switch status, reload drafts
- Skeleton: 4 rows (56px) in `#draft-list` while loading
- Empty state: "No drafts. Carina will queue skill candidates as it learns from your conversations."

### Step 6: Register in `packages/web/src/web-server.ts`

```typescript
const workshopHtml = decoratePageHtml(
  await fs.readFile(path.join(WEB_STATIC, 'workshop.html'), 'utf-8').catch(() => null),
  carinaVersion,
  { workspacePage: 'workshop' },
);
if (workshopHtml) {
  app.get('/workshop', (_req, res) => { res.type('html').send(workshopHtml); });
}
app.get('/workshop.js', (_req, res) => {
  res.set('Cache-Control', 'no-cache');
  res.type('application/javascript').sendFile(path.join(WEB_STATIC, 'workshop.js'));
});
```

## Tests

Create `src/api/benchmark-api.test.ts`:
- GET /api/benchmark/history returns `{ runs: [] }` when no history file exists
- GET /api/benchmark/latest returns null when empty
- POST /api/benchmark/run: mock `runPlatformBenchmark` to return a fixture report; verify response shape matches `BenchmarkRunReport`

Add to curator-api tests:
- GET /api/curator/workshop/drafts returns `{ drafts: [] }` initially
- GET /api/curator/workshop/drafts/:id returns 404 for unknown id
- POST /api/curator/workshop/drafts/:id/approve returns 400 if id unknown

## Acceptance criteria

- `/benchmark` shows overall and per-category scores after running
- Run history chips let users browse older runs
- History persists across restarts (CARINA_HOME JSON file)
- `/workshop` lists drafts with status filter and approve/reject actions
- Approving promotes the draft and moves it to the approved column
- All pages render under workspace chrome with no console errors
