# Prompt 11: Playbook, Capabilities, and Model Guidance

You are working in the Carina mono-repo at `core.carinaai.uk/`.

## What already exists

**Playbook backend (internal `src/cookbook` (complete):**
- `src/cookbook/hardware.ts` - detects RAM, CPU, VRAM
- `src/cookbook/catalog.ts` - model catalog with VRAM and RAM requirements
- `src/cookbook/recommender.ts` - `recommend(hardware)` returns `{ local, hosted, notes }`
- `src/cookbook/serve.ts` - Ollama and llama.cpp serve instructions
- `src/cookbook/cloud-recommendations.ts` - hosted provider recommendations
- `src/cookbook/index.ts` - re-exports all above

**Playbook API (created in a prior session):**
- `src/api/playbook-api.ts` - routes under `/api/playbook`

**Playbook HTML (261 lines - real implementation):**
- `packages/web/assets/web/playbook.html` - recipe cards, hardware banner, model list

**Route registration (done in `packages/web/src/web-server.ts`):**
- `cookbookHtml` is loaded via `decoratePageHtml` with `workspacePage: 'playbook'`
- Served at GET `/playbook`

## What is missing and must be built

### Gap 1: Capabilities page

A dedicated `/capabilities` page explaining what Carina can do right now, with per-feature status indicators.

**Step 1: Add `'capabilities'` to `WorkspacePageId` in `packages/web/src/workspace-chrome.ts`:**

```typescript
export type WorkspacePageId =
  | 'hub'
  | 'chat'
  | 'notes'
  | 'documents'
  | 'images'
  | 'email'
  | 'calendar'
  | 'memory'
  | 'packs'
  | 'cookbook'
  | 'capabilities'   // ADD THIS
  | 'research'
  | 'compare'
  | 'kanban'
  | 'webhooks';
```

**Step 2: Add nav item in `WORKSPACE_NAV_ITEMS`:**

```typescript
{
  id: 'capabilities',
  href: '/capabilities',
  label: 'Capabilities',
  description: 'What Carina can do right now',
},
```

**Step 3: Create `packages/web/assets/web/capabilities.html`:**

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<meta name="theme-color" content="#0d0d0f">
<title>Capabilities; Carina</title>
<style>
  .cap-wrap { flex: 1; overflow-y: auto; padding: 1rem 1.25rem 2rem; max-width: 860px; }
  .cap-section { margin-bottom: 1.5rem; }
  .cap-section h2 { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); margin-bottom: 0.65rem; }
  .cap-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 0.6rem; }
  .cap-card {
    background: var(--surface-2); border: 1px solid var(--border); border-radius: 10px;
    padding: 0.75rem 0.85rem; display: flex; flex-direction: column; gap: 0.25rem;
  }
  .cap-card-title { font-size: 0.85rem; font-weight: 600; display: flex; align-items: center; gap: 0.45rem; }
  .cap-card-desc { font-size: 0.76rem; color: var(--muted); line-height: 1.45; }
  .cap-status {
    display: inline-block; font-size: 0.62rem; text-transform: uppercase; letter-spacing: 0.04em;
    padding: 0.1rem 0.4rem; border-radius: 4px; font-weight: 700;
  }
  .status-active { background: rgba(74,222,128,0.12); color: #4ade80; }
  .status-partial { background: rgba(251,191,36,0.12); color: #fbbf24; }
  .status-config  { background: rgba(108,140,255,0.12); color: var(--accent); }
  .status-wip     { background: rgba(255,77,106,0.12); color: var(--danger); }
  #cap-loading { color: var(--muted); font-size: 0.85rem; }
</style>
</head>
<body>
<!--CARINA_WORKSPACE_BEGIN-->
<header class="ws-page-header">
  <h1>Capabilities</h1>
  <span class="status" id="cap-status"></span>
</header>
<div class="cap-wrap">
  <p id="cap-loading">Loading...</p>
  <div id="cap-content" hidden></div>
</div>
<!--CARINA_WORKSPACE_END-->
<script src="/capabilities.js"></script>
</body>
</html>
```

**Step 4: Create `packages/web/assets/web/capabilities.js`:**

```javascript
(function () {
  const wrapEl = document.getElementById('cap-content');
  const loadingEl = document.getElementById('cap-loading');

  const SECTIONS = [
    {
      title: 'Conversation and memory',
      items: [
        { name: 'Chat', desc: 'Multi-turn conversation with tool use', status: 'active', href: '/' },
        { name: 'Session memory', desc: 'Persist and search past sessions', status: 'active', href: '/memory' },
        { name: 'Notes', desc: 'AI-assisted notes and reminders', status: 'active', href: '/notes' },
        { name: 'Documents', desc: 'Markdown/HTML/text document editor with AI assist', status: 'active', href: '/documents' },
      ],
    },
    {
      title: 'Research and compare',
      items: [
        { name: 'Deep Research', desc: 'Multi-step web search with citations', status: 'active', href: '/research' },
        { name: 'Model Compare', desc: 'Side-by-side provider output comparison', status: 'active', href: '/compare' },
      ],
    },
    {
      title: 'Creativity and images',
      items: [
        { name: 'Image generation', desc: 'DALL-E 3, Stable Diffusion via OpenAI', status: 'config', href: '/images' },
        { name: 'Inpaint', desc: 'Edit regions of existing images', status: 'config', href: '/images' },
        { name: 'Background removal', desc: 'Remove.bg integration', status: 'config', href: '/images' },
      ],
    },
    {
      title: 'Scheduling and tasks',
      items: [
        { name: 'Kanban', desc: 'AI-managed task boards', status: 'active', href: '/kanban' },
        { name: 'Calendar', desc: 'Google Calendar integration', status: 'config', href: '/calendar' },
        { name: 'Cron workflows', desc: 'Scheduled AI jobs', status: 'wip', href: null },
      ],
    },
    {
      title: 'Communication',
      items: [
        { name: 'Email (inbound)', desc: 'IMAP sync and Resend webhook', status: 'config', href: '/email' },
        { name: 'Email (send)', desc: 'SMTP via nodemailer', status: 'config', href: '/email' },
        { name: 'Channels (40+)', desc: 'Slack, Telegram, WhatsApp, Discord, and more', status: 'partial', href: '/webhooks' },
      ],
    },
    {
      title: 'Model management',
      items: [
        { name: 'Cookbook', desc: 'Hardware-aware model guidance', status: 'active', href: '/cookbook' },
        { name: 'Skill packs', desc: 'Deployable knowledge packs', status: 'active', href: '/packs' },
        { name: 'Provider health', desc: 'Live latency and token count per provider', status: 'wip', href: null },
      ],
    },
  ];

  const STATUS_LABELS = {
    active: 'Active',
    partial: 'Partial',
    config: 'Needs config',
    wip: 'Coming soon',
  };

  function escapeHtml(text) {
    return String(text).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function renderSection(section) {
    return '<div class="cap-section">' +
      '<h2>' + escapeHtml(section.title) + '</h2>' +
      '<div class="cap-grid">' +
      section.items.map(function(item) {
        const link = item.href
          ? '<a href="' + escapeHtml(item.href) + '" style="color:var(--accent);font-size:0.72rem;text-decoration:none;margin-top:0.35rem;">Open</a>'
          : '';
        return '<div class="cap-card">' +
          '<div class="cap-card-title">' +
            '<span class="cap-status status-' + escapeHtml(item.status) + '">' + (STATUS_LABELS[item.status] || item.status) + '</span>' +
            escapeHtml(item.name) +
          '</div>' +
          '<div class="cap-card-desc">' + escapeHtml(item.desc) + '</div>' +
          link +
        '</div>';
      }).join('') +
      '</div></div>';
  }

  fetch('/api/config')
    .then(function(r) { return r.json(); })
    .then(function(config) {
      loadingEl.hidden = true;
      wrapEl.hidden = false;
      wrapEl.innerHTML = SECTIONS.map(renderSection).join('');
      document.getElementById('cap-status').textContent = 'Provider: ' + (config.provider || 'none');
    })
    .catch(function() {
      loadingEl.hidden = true;
      wrapEl.hidden = false;
      wrapEl.innerHTML = SECTIONS.map(renderSection).join('');
    });
})();
```

**Step 5: Register in `packages/web/src/web-server.ts`:**

Add alongside existing page loads in `createWebServer()`:

```typescript
const capabilitiesHtml = decoratePageHtml(
  await fs.readFile(path.join(WEB_STATIC, 'capabilities.html'), 'utf-8').catch(() => null),
  carinaVersion,
  { workspacePage: 'capabilities' },
);
// ...
if (capabilitiesHtml) {
  app.get('/capabilities', (_req, res) => {
    res.type('html').send(capabilitiesHtml);
  });
}
app.get('/capabilities.js', (_req, res) => {
  res.set('Cache-Control', 'no-cache');
  res.type('application/javascript').sendFile(path.join(WEB_STATIC, 'capabilities.js'));
});
```

### Gap 2: Cookbook hardware API route

Check `src/api/playbook-api.ts` for GET `/api/playbook/hardware`. If missing, add:

```typescript
import { detectHardware } from '../cookbook/hardware.js';
import { recommend } from '../cookbook/recommender.js';

cookbookApiRouter.get('/hardware', async (_req: Request, res: Response) => {
  const hw = await detectHardware();
  const recs = recommend(hw);
  res.json({ hardware: hw, recommendations: recs });
});
```

### Gap 3: Cookbook model-click "How to run" panel

The existing playbook.html shows model cards but has no detail panel explaining how to run a model locally.

Add a slide-in detail panel to `playbook.html`:

```html
<div id="model-detail" hidden style="position:fixed;right:0;top:0;bottom:0;width:340px;background:var(--surface);border-left:1px solid var(--border);padding:1.25rem;overflow-y:auto;z-index:10;">
  <button id="close-detail" style="float:right;background:none;border:none;cursor:pointer;color:var(--muted);">x</button>
  <h2 id="detail-model-name" style="font-size:1rem;margin-bottom:0.5rem;"></h2>
  <div id="detail-serve-cmd" style="background:var(--surface-2);border-radius:8px;padding:0.65rem;font-size:0.78rem;font-family:monospace;white-space:pre-wrap;margin-bottom:0.75rem;"></div>
  <div id="detail-notes" style="font-size:0.82rem;color:var(--muted);line-height:1.5;"></div>
</div>
```

Add to cookbook JS: on model card click, fetch `GET /api/playbook/model/:id/serve-cmd` and display in the panel.

Add to `cookbook-api.ts`:

```typescript
import { getServeInstructions } from '../cookbook/serve.js';

cookbookApiRouter.get('/model/:id/serve-cmd', (req: Request, res: Response) => {
  const instructions = getServeInstructions(req.params.id);
  if (!instructions) {
    res.status(404).json({ error: 'Model not found' });
    return;
  }
  res.json(instructions);
});
```

## Service worker update

Add `/capabilities` and `/cookbook` to the precache list in `packages/web/assets/web/service-worker.js`:

```javascript
const PRECACHE_URLS = [
  // ... existing entries ...
  '/capabilities',
  '/cookbook',
];
```

## Tests

In `src/api/playbook-api.ts` test file (create if absent: `src/api/playbook-api.test.ts`):
- GET /api/playbook/hardware returns `{ hardware: { ramGb, cpuCores }, recommendations: { local, hosted } }`
- GET /api/playbook/model/:id/serve-cmd returns 404 for unknown model
- GET /api/playbook/model/llama3/serve-cmd returns `{ cmd, notes }`

For capabilities page (browser test or Vitest DOM):
- All six sections render
- Status badges use correct CSS class
- Links open to correct workspace pages

## Acceptance criteria

- `/capabilities` is a navigable workspace page showing what is active, partially configured, config-needed, and coming soon
- `/cookbook` shows hardware detection results and per-model "How to run" detail panels
- The detail panel shows the correct `ollama run <model>` or equivalent command
- No broken page loads; both pages render under the workspace chrome
