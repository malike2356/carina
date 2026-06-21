# Prompt 16: Taskflows, Kanban, and Cron

You are working in the Carina mono-repo at `core.carinaai.uk/`.

## What already exists

**Kanban backend (complete):**
- `src/agents/kanban-service.ts` - `createBoard()`, `listBoards()`, `getBoard(id)`, `moveCard()`, `addCard()`, `deleteCard()`
- `src/agents/kanban-store.ts` - persistence under CARINA_HOME/kanban/
- `src/agents/kanban-types.ts` - `KanbanBoard`, `KanbanColumn`, `KanbanCard`

**Kanban API (complete):**
- `src/api/kanban-api.ts` - router with CRUD routes for boards, cards, columns
- `src/api/kanban-api.test.ts` - tests exist

**Kanban workspace page (exists):**
- `packages/web/assets/web/kanban.html` - full board view (check line count to assess completeness)
- Served at GET `/kanban` with `workspacePage: 'kanban'`

**Cron/workflow backend (complete):**
- `src/agents/cron-scheduler.ts` - `scheduleCronJob()`, `listCronJobs()`, `cancelCronJob(id)`
- `src/agents/cron-workflow-engine.ts` - `runWorkflow(def)`, `resumeWorkflow(id, input)`
- `src/agents/cron-workflow-store.ts` - persistence under CARINA_HOME/workflows/
- `src/agents/cron-workflow-types.ts` - `WorkflowDefinition`, `WorkflowRun`, `WorkflowStep`
- `src/agents/job-history.ts` - `logJobRun(entry)`, `listJobHistory(limit)`, `JobHistoryEntry`
- `src/tools/cronjob.ts` - `CronJobTool` registered in tool registry

**No GUI exists for cron/workflow yet.**

## Part A: Enhance kanban page

Check the current state of `packages/web/assets/web/kanban.html`. If it is a basic stub (under 100 lines), implement the full board UI. If it is already substantial, add the missing features listed below.

### Missing kanban features to add

**1. Drag-and-drop card movement**

The kanban page may render columns and cards but rely on buttons to move. Add HTML5 drag-and-drop:

In the JS file (likely `kanban.js`), add:
```javascript
// Make cards draggable
card.draggable = true;
card.addEventListener('dragstart', function(e) {
  e.dataTransfer.setData('cardId', card.dataset.id);
  e.dataTransfer.setData('fromCol', card.dataset.col);
});

// Make columns drop targets
col.addEventListener('dragover', function(e) { e.preventDefault(); col.classList.add('drag-over'); });
col.addEventListener('dragleave', function() { col.classList.remove('drag-over'); });
col.addEventListener('drop', async function(e) {
  e.preventDefault();
  col.classList.remove('drag-over');
  const cardId = e.dataTransfer.getData('cardId');
  const toCol = col.dataset.colId;
  await api('PATCH', '/api/kanban/cards/' + cardId, { column: toCol });
  loadBoard(activeBoardId);
});
```

Add CSS:
```css
.kanban-col.drag-over { background: rgba(108,140,255,0.08); outline: 2px dashed var(--accent); }
```

**2. Board switcher**

If multiple boards can exist but the page only shows one, add a board selector dropdown in the toolbar:

```html
<select id="board-select" style="background:var(--surface-2);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:0.4rem 0.6rem;font-size:0.82rem;"></select>
```

On load: GET /api/kanban/boards, populate select. On change: load selected board.

**3. Card detail panel**

Clicking a card should show a side panel with:
- Full description field (editable textarea, auto-saved)
- Assignee field (freetext input)
- Priority selector (none / low / medium / high)
- Due date picker
- "Ask Carina" button: POSTs card description to chat as context

Add routes if missing in `kanban-api.ts`:
```typescript
kanbanApiRouter.get('/cards/:id', async (req, res) => {
  const card = await getCard(req.params.id);
  if (!card) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(card);
});

kanbanApiRouter.patch('/cards/:id', async (req, res) => {
  try {
    const updated = await updateCard(req.params.id, req.body);
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
```

**4. "Add card" in each column**

Inline add form at the bottom of each column:
```html
<div class="add-card-wrap">
  <input type="text" placeholder="Add card..." class="add-card-input" data-col="COLUMN_ID">
  <button class="add-card-btn">Add</button>
</div>
```

POST /api/kanban/boards/:boardId/cards with `{ title, column }`.

## Part B: Cron/workflow management page

### Step 1: Add `'cron'` to `WorkspacePageId` in `packages/web/src/workspace-chrome.ts`

```typescript
| 'cron'
```

### Step 2: Add nav item

```typescript
{
  id: 'cron',
  href: '/cron',
  label: 'Cron',
  description: 'Scheduled jobs and workflow runs',
},
```

### Step 3: Create `src/api/cron-api.ts`

```typescript
import { Router, type Request, type Response } from 'express';
import {
  listCronJobs, scheduleCronJob, cancelCronJob,
} from '../agents/cron-scheduler.js';
import {
  listJobHistory,
} from '../agents/job-history.js';
import {
  listWorkflowRuns,
} from '../agents/cron-workflow-store.js';

export const cronApiRouter = Router();

cronApiRouter.get('/jobs', (_req, res) => {
  res.json({ jobs: listCronJobs() });
});

cronApiRouter.post('/jobs', async (req, res) => {
  const { name, schedule, prompt } = req.body ?? {};
  if (!name || !schedule || !prompt) {
    res.status(400).json({ error: 'name, schedule, and prompt are required' });
    return;
  }
  try {
    const job = await scheduleCronJob({ name, schedule, prompt });
    res.status(201).json(job);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

cronApiRouter.delete('/jobs/:id', async (req, res) => {
  try {
    await cancelCronJob(req.params.id);
    res.status(204).end();
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

cronApiRouter.get('/history', async (req, res) => {
  const limit = Number(req.query.limit) || 50;
  res.json({ runs: await listJobHistory(limit) });
});

cronApiRouter.get('/workflows', async (_req, res) => {
  const runs = await listWorkflowRuns();
  res.json({ workflows: runs });
});
```

Mount in `createWebServer()`:
```typescript
import { cronApiRouter } from '#core/api/cron-api.js';
app.use('/api/cron', express.json(), requireAuth, cronApiRouter);
```

### Step 4: Load cron HTML in `createWebServer()`

```typescript
const cronHtml = decoratePageHtml(
  await fs.readFile(path.join(WEB_STATIC, 'cron.html'), 'utf-8').catch(() => null),
  carinaVersion,
  { workspacePage: 'cron' },
);
if (cronHtml) {
  app.get('/cron', (_req, res) => { res.type('html').send(cronHtml); });
}
app.get('/cron.js', (_req, res) => {
  res.set('Cache-Control', 'no-cache');
  res.type('application/javascript').sendFile(path.join(WEB_STATIC, 'cron.js'));
});
```

### Step 5: Create `packages/web/assets/web/cron.html`

Two-tab layout: Jobs / History.

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<meta name="theme-color" content="#0d0d0f">
<title>Cron; Carina</title>
<style>
  .cron-wrap { flex:1; overflow-y:auto; padding:1rem 1.25rem 2rem; max-width:900px; }
  .cron-tabs { display:flex; border-bottom:1px solid var(--border); margin-bottom:1rem; }
  .cron-tab { padding:0.55rem 1rem; border:none; border-bottom:2px solid transparent; background:transparent; color:var(--muted); cursor:pointer; font-size:0.82rem; }
  .cron-tab.active { color:var(--text); border-bottom-color:var(--accent); }
  .job-card { background:var(--surface-2); border:1px solid var(--border); border-radius:10px; padding:0.75rem 0.85rem; margin-bottom:0.5rem; display:flex; align-items:flex-start; gap:0.65rem; }
  .job-card .job-info { flex:1; min-width:0; }
  .job-name { font-size:0.84rem; font-weight:600; }
  .job-schedule { font-size:0.72rem; color:var(--accent); margin-top:0.15rem; font-family:monospace; }
  .job-prompt { font-size:0.75rem; color:var(--muted); margin-top:0.2rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .btn-cancel { background:none; border:1px solid var(--border); color:var(--danger); border-radius:6px; padding:0.25rem 0.55rem; font-size:0.72rem; cursor:pointer; white-space:nowrap; }
  .add-job-form { background:var(--surface-2); border:1px solid var(--border); border-radius:10px; padding:0.85rem; margin-bottom:1rem; display:flex; flex-direction:column; gap:0.5rem; }
  .add-job-form input, .add-job-form textarea { background:var(--bg); border:1px solid var(--border); color:var(--text); border-radius:6px; padding:0.4rem 0.6rem; font-size:0.82rem; font-family:inherit; }
  .add-job-form button { align-self:flex-start; background:var(--accent); color:#0d0d0f; border:none; border-radius:8px; padding:0.45rem 0.85rem; font-size:0.82rem; font-weight:700; cursor:pointer; }
  .history-row { display:flex; gap:0.6rem; align-items:center; padding:0.5rem 0; border-bottom:1px solid var(--border); font-size:0.8rem; }
  .history-row .job-label { flex:1; font-weight:500; }
  .history-row .run-time { font-size:0.72rem; color:var(--muted); }
  .run-ok { color:#4ade80; } .run-err { color:var(--danger); }
</style>
</head>
<body>
<!--CARINA_WORKSPACE_BEGIN-->
<header class="ws-page-header">
  <h1>Cron</h1>
  <span class="status" id="status"></span>
</header>
<div class="cron-wrap">
  <div class="cron-tabs">
    <button class="cron-tab active" data-tab="jobs">Jobs</button>
    <button class="cron-tab" data-tab="history">Run history</button>
  </div>
  <div id="tab-jobs">
    <details class="add-job-form" style="padding:0;">
      <summary style="padding:0.65rem 0.85rem;cursor:pointer;font-size:0.82rem;font-weight:600;">Add new job</summary>
      <div style="padding:0 0.85rem 0.85rem;display:flex;flex-direction:column;gap:0.5rem;">
        <input id="job-name" placeholder="Job name" required>
        <input id="job-schedule" placeholder="Cron schedule (e.g. 0 9 * * 1)" required style="font-family:monospace;">
        <textarea id="job-prompt" placeholder="Prompt to run" rows="3" required></textarea>
        <button id="add-job-btn">Add job</button>
        <div id="add-job-status" style="font-size:0.75rem;color:var(--muted);"></div>
      </div>
    </details>
    <div id="job-list"></div>
  </div>
  <div id="tab-history" hidden>
    <div id="history-list"></div>
  </div>
</div>
<!--CARINA_WORKSPACE_END-->
<script src="/cron.js"></script>
</body>
</html>
```

### Step 6: Create `packages/web/assets/web/cron.js`

IIFE with:

```javascript
(function () {
  const statusEl = document.getElementById('status');
  const jobListEl = document.getElementById('job-list');
  const historyListEl = document.getElementById('history-list');

  function escapeHtml(t) {
    return String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  async function loadJobs() {
    jobListEl.innerHTML = [1,2,3].map(function(){
      return '<div class="skeleton" style="height:72px;border-radius:10px;margin-bottom:6px;"></div>';
    }).join('');
    const data = await fetch('/api/cron/jobs').then(function(r){return r.json();});
    const jobs = data.jobs || [];
    statusEl.textContent = jobs.length + ' scheduled job' + (jobs.length === 1 ? '' : 's');
    if (!jobs.length) {
      jobListEl.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--muted);font-size:0.83rem;">No scheduled jobs. Add one above.</div>';
      return;
    }
    jobListEl.innerHTML = jobs.map(function(job) {
      return '<div class="job-card">' +
        '<div class="job-info">' +
          '<div class="job-name">' + escapeHtml(job.name) + '</div>' +
          '<div class="job-schedule">' + escapeHtml(job.schedule) + '</div>' +
          '<div class="job-prompt">' + escapeHtml(job.prompt || '') + '</div>' +
        '</div>' +
        '<button class="btn-cancel" data-cancel="' + escapeHtml(job.id) + '">Cancel</button>' +
      '</div>';
    }).join('');
    jobListEl.querySelectorAll('[data-cancel]').forEach(function(btn) {
      btn.addEventListener('click', async function() {
        if (!confirm('Cancel this job?')) return;
        await fetch('/api/cron/jobs/' + btn.dataset.cancel, { method: 'DELETE' });
        loadJobs();
      });
    });
  }

  async function loadHistory() {
    historyListEl.innerHTML = '<div class="skeleton" style="height:160px;border-radius:8px;"></div>';
    const data = await fetch('/api/cron/history').then(function(r){return r.json();});
    const runs = data.runs || [];
    if (!runs.length) {
      historyListEl.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--muted);">No runs yet.</div>';
      return;
    }
    historyListEl.innerHTML = runs.map(function(run) {
      return '<div class="history-row">' +
        '<div class="job-label">' + escapeHtml(run.jobName || run.jobId) + '</div>' +
        '<div class="run-time">' + escapeHtml(run.startedAt ? new Date(run.startedAt).toLocaleString() : '') + '</div>' +
        '<div class="' + (run.error ? 'run-err' : 'run-ok') + '">' + (run.error ? 'Error' : 'OK') + '</div>' +
      '</div>';
    }).join('');
  }

  // Tab switching
  document.querySelectorAll('.cron-tab').forEach(function(tab) {
    tab.addEventListener('click', function() {
      document.querySelectorAll('.cron-tab').forEach(function(t){t.classList.remove('active');});
      tab.classList.add('active');
      var tabId = tab.dataset.tab;
      document.getElementById('tab-jobs').hidden = tabId !== 'jobs';
      document.getElementById('tab-history').hidden = tabId !== 'history';
      if (tabId === 'history') loadHistory();
    });
  });

  // Add job
  document.getElementById('add-job-btn').addEventListener('click', async function() {
    var name = document.getElementById('job-name').value.trim();
    var schedule = document.getElementById('job-schedule').value.trim();
    var prompt = document.getElementById('job-prompt').value.trim();
    var statusMsg = document.getElementById('add-job-status');
    if (!name || !schedule || !prompt) { statusMsg.textContent = 'Fill in all fields'; return; }
    try {
      await fetch('/api/cron/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, schedule, prompt }),
      });
      statusMsg.textContent = 'Job added';
      document.getElementById('job-name').value = '';
      document.getElementById('job-schedule').value = '';
      document.getElementById('job-prompt').value = '';
      loadJobs();
    } catch (err) {
      statusMsg.textContent = 'Error: ' + err.message;
    }
  });

  loadJobs();
})();
```

## Tests

Create `src/api/cron-api.test.ts`:
- GET /api/cron/jobs returns `{ jobs: [] }` initially
- POST /api/cron/jobs with missing fields returns 400
- POST /api/cron/jobs with valid body returns 201
- DELETE /api/cron/jobs/:id returns 204
- GET /api/cron/history returns `{ runs: [] }`

Add to `src/api/kanban-api.test.ts`:
- PATCH /api/kanban/cards/:id returns updated card
- GET /api/kanban/cards/:id returns 404 for unknown id

## Acceptance criteria

- `/kanban` supports drag-and-drop card movement between columns
- `/kanban` has a board switcher for multiple boards
- Card click opens a detail panel with description and metadata
- `/cron` lists all scheduled jobs with schedule string and prompt preview
- "Add job" form validates and creates a new cron job
- "Run history" tab shows past runs with OK/Error status
- All cron API routes are authenticated
