# Prompt 14: Providers, Profiles, and Agents

You are working in the Carina mono-repo at `core.carinaai.uk/`.

## What already exists

**Provider backend:**
- `src/brain/provider-registry.ts` - `PROVIDER_MAP`, `isProviderConfigured(id)`, `providerModel(id)`, `listConfiguredProviders()`
- `src/brain/provider-health.ts` - `checkProviderHealth(id)`, `ProviderHealthResult`, `HealthStatus`
- `src/brain/provider-catalog.ts` - provider metadata (name, homepage, models, context window)
- `src/brain/provider-capability-detection.ts` - detect what each provider can do
- `src/brain/llm.ts` - `llm.current()`, `llm.list()`, `llm.setProvider(id)`

**Profile backend:**
- `src/profiles/manager.ts` - `listProfiles()`, `getProfile(name)`, `createProfile(name, opts)`, `deleteProfile(name)`, `switchProfile(name)`
- `src/profiles/isolation.ts` - per-profile isolation rules
- `src/profiles/scope.ts` - `ProfileScope`, `resolveScope(profile)`

**Existing API routes (partial):**
- GET /api/providers and POST /api/providers/switch already exist in `packages/web/src/web-server.ts` (lines 205 and 221)
- GET /api/config returns `{ provider, providers, profile }`

**CLI commands:**
- `src/cli/commands/providers-cli.ts` - list, switch, test
- `src/cli/commands/profile-cli.ts` - create, switch, list, delete

**No GUI pages exist for providers or profiles.**

## Part A: Provider management page

### Step 1: Add `'providers'` to `WorkspacePageId` in `packages/web/src/workspace-chrome.ts`

```typescript
| 'providers'
```

### Step 2: Add nav item

```typescript
{
  id: 'providers',
  href: '/providers',
  label: 'Providers',
  description: 'LLM provider health and switching',
},
```

### Step 3: Create `src/api/providers-api.ts`

```typescript
import { Router, type Request, type Response } from 'express';
import {
  PROVIDER_MAP,
  isProviderConfigured,
  listConfiguredProviders,
} from '../brain/provider-registry.js';
import { checkProviderHealth } from '../brain/provider-health.js';
import { llm } from '../brain/llm.js';

export const providersApiRouter = Router();

providersApiRouter.get('/', (_req, res) => {
  const configured = listConfiguredProviders();
  const all = Object.entries(PROVIDER_MAP).map(([id, meta]) => ({
    id,
    name: meta.name ?? id,
    configured: isProviderConfigured(id),
    active: llm.current().name === id,
    models: meta.models ?? [],
  }));
  res.json({ providers: all, active: llm.current().name, configured });
});

providersApiRouter.get('/:id/health', async (req, res) => {
  const id = req.params.id;
  if (!isProviderConfigured(id)) {
    res.status(400).json({ error: 'Provider not configured' });
    return;
  }
  try {
    const health = await checkProviderHealth(id);
    res.json(health);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

providersApiRouter.post('/switch', async (req, res) => {
  const id = String(req.body?.provider ?? '');
  if (!id) { res.status(400).json({ error: 'provider is required' }); return; }
  if (!isProviderConfigured(id)) {
    res.status(400).json({ error: 'Provider not configured. Check API key.' });
    return;
  }
  try {
    await llm.setProvider(id);
    res.json({ ok: true, active: id });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
```

Mount in `createWebServer()`:
```typescript
import { providersApiRouter } from '#core/api/providers-api.js';
app.use('/api/providers/v2', express.json(), requireAuth, providersApiRouter);
```

Note: `/api/providers` already exists in web-server.ts. Use `/api/providers/v2` as the new rich endpoint to avoid conflicts, or refactor the existing route into this router.

### Step 4: Load provider HTML in `createWebServer()`

```typescript
const providersHtml = decoratePageHtml(
  await fs.readFile(path.join(WEB_STATIC, 'providers.html'), 'utf-8').catch(() => null),
  carinaVersion,
  { workspacePage: 'providers' },
);
if (providersHtml) {
  app.get('/providers', (_req, res) => { res.type('html').send(providersHtml); });
}
app.get('/providers.js', (_req, res) => {
  res.set('Cache-Control', 'no-cache');
  res.type('application/javascript').sendFile(path.join(WEB_STATIC, 'providers.js'));
});
```

### Step 5: Create `packages/web/assets/web/providers.html`

Two-panel layout: provider list on left, detail/health on right.

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<meta name="theme-color" content="#0d0d0f">
<title>Providers; Carina</title>
<style>
  body { display:flex; flex-direction:column; height:100vh; }
  .prov-layout { flex:1; display:grid; grid-template-columns:280px 1fr; min-height:0; overflow:hidden; }
  .prov-list { border-right:1px solid var(--border); overflow-y:auto; background:var(--surface-2); }
  .prov-item { padding:0.7rem 0.85rem; border-bottom:1px solid var(--border); cursor:pointer; display:flex; align-items:center; gap:0.6rem; }
  .prov-item:hover { background:var(--surface); }
  .prov-item.active-page { background:var(--surface); }
  .prov-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
  .dot-ok { background:#4ade80; } .dot-err { background:var(--danger); } .dot-off { background:var(--muted); }
  .prov-name { font-size:0.84rem; font-weight:600; }
  .prov-models { font-size:0.7rem; color:var(--muted); margin-top:0.1rem; }
  .prov-badge { font-size:0.6rem; text-transform:uppercase; padding:0.08rem 0.3rem; border-radius:4px; background:rgba(108,140,255,0.12); color:var(--accent); margin-left:auto; }
  .prov-detail { display:flex; flex-direction:column; padding:1.25rem; overflow-y:auto; }
  .prov-detail h2 { font-size:1rem; margin-bottom:0.35rem; }
  .health-row { display:flex; align-items:center; gap:0.75rem; font-size:0.82rem; margin-bottom:0.75rem; }
  .health-status { font-weight:600; }
  .health-latency { color:var(--muted); font-size:0.75rem; }
  .model-chip { display:inline-block; margin:0 0.3rem 0.3rem 0; background:var(--surface-2); border:1px solid var(--border); border-radius:6px; padding:0.2rem 0.5rem; font-size:0.72rem; }
  .prov-actions { display:flex; gap:0.5rem; margin-top:auto; padding-top:1rem; }
  .btn-switch { background:var(--accent); color:#0d0d0f; border:none; border-radius:8px; padding:0.5rem 1rem; font-weight:700; cursor:pointer; font-size:0.82rem; }
  .btn-test { background:var(--surface-2); border:1px solid var(--border); color:var(--text); border-radius:8px; padding:0.5rem 1rem; cursor:pointer; font-size:0.82rem; }
  .btn-switch:disabled, .btn-test:disabled { opacity:0.5; cursor:not-allowed; }
  #prov-status { font-size:0.78rem; color:var(--muted); margin-top:0.5rem; }
  .empty-prov { flex:1; display:flex; align-items:center; justify-content:center; color:var(--muted); font-size:0.85rem; text-align:center; padding:2rem; }
</style>
</head>
<body>
<!--CARINA_WORKSPACE_BEGIN-->
<header class="ws-page-header">
  <h1>Providers</h1>
  <span class="status" id="status"></span>
</header>
<div class="prov-layout">
  <div class="prov-list" id="prov-list">
    <!-- skeleton loaded by JS -->
  </div>
  <div class="prov-detail" id="prov-detail">
    <div class="empty-prov">Select a provider to see health and switch.</div>
  </div>
</div>
<!--CARINA_WORKSPACE_END-->
<script src="/providers.js"></script>
</body>
</html>
```

### Step 6: Create `packages/web/assets/web/providers.js`

```javascript
(function () {
  const listEl = document.getElementById('prov-list');
  const detailEl = document.getElementById('prov-detail');
  const statusEl = document.getElementById('status');

  let providers = [];
  let activeProvider = '';
  let selectedId = null;

  function escapeHtml(t) {
    return String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function dotClass(p) {
    if (!p.configured) return 'dot-off';
    return 'dot-ok';
  }

  function renderList() {
    if (!providers.length) {
      listEl.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--muted);font-size:0.83rem;">No providers found. Add API keys in .env.</div>';
      return;
    }
    listEl.innerHTML = providers.map(function(p) {
      const badge = p.active ? '<span class="prov-badge">Active</span>' : '';
      const models = (p.models || []).slice(0, 3).join(', ') + ((p.models||[]).length > 3 ? '...' : '');
      return '<div class="prov-item' + (p.id === selectedId ? ' active-page' : '') + '" data-id="' + escapeHtml(p.id) + '">' +
        '<div class="prov-dot ' + dotClass(p) + '"></div>' +
        '<div style="flex:1;min-width:0;">' +
          '<div class="prov-name">' + escapeHtml(p.name || p.id) + badge + '</div>' +
          (models ? '<div class="prov-models">' + escapeHtml(models) + '</div>' : '') +
        '</div>' +
      '</div>';
    }).join('');
    listEl.querySelectorAll('.prov-item').forEach(function(el) {
      el.addEventListener('click', function() { openProvider(el.dataset.id); });
    });
  }

  function openProvider(id) {
    selectedId = id;
    renderList();
    const p = providers.find(function(x){return x.id === id;});
    if (!p) return;
    const models = (p.models || []).map(function(m){
      return '<span class="model-chip">' + escapeHtml(m) + '</span>';
    }).join('');
    detailEl.innerHTML =
      '<h2>' + escapeHtml(p.name || p.id) + '</h2>' +
      '<div class="health-row">' +
        '<span class="health-status" style="color:' + (p.configured ? '#4ade80' : 'var(--muted)') + '">' +
          (p.configured ? 'Configured' : 'Not configured') +
        '</span>' +
        (p.active ? '<span style="font-size:0.75rem;color:var(--accent)">Currently active</span>' : '') +
      '</div>' +
      (models ? '<div style="margin-bottom:0.75rem;"><div style="font-size:0.72rem;color:var(--muted);margin-bottom:0.35rem;">Models</div>' + models + '</div>' : '') +
      '<div id="health-result" style="font-size:0.8rem;color:var(--muted);min-height:1.5rem;"></div>' +
      '<div id="prov-status"></div>' +
      '<div class="prov-actions">' +
        '<button class="btn-switch" id="switch-btn"' + (p.active ? ' disabled' : '') + '>' +
          (p.active ? 'Already active' : 'Switch to ' + escapeHtml(p.name || p.id)) +
        '</button>' +
        '<button class="btn-test" id="test-btn"' + (!p.configured ? ' disabled' : '') + '>Test health</button>' +
      '</div>';

    document.getElementById('test-btn').addEventListener('click', function() { testHealth(id); });
    document.getElementById('switch-btn').addEventListener('click', function() { switchProvider(id); });
  }

  async function testHealth(id) {
    const resultEl = document.getElementById('health-result');
    const testBtn = document.getElementById('test-btn');
    if (!resultEl || !testBtn) return;
    testBtn.disabled = true;
    resultEl.textContent = 'Testing...';
    try {
      const h = await fetch('/api/providers/v2/' + encodeURIComponent(id) + '/health').then(function(r){return r.json();});
      resultEl.textContent = 'Health: ' + (h.status || 'unknown') + (h.latencyMs ? ' (' + h.latencyMs + 'ms)' : '');
      resultEl.style.color = h.status === 'ok' ? '#4ade80' : 'var(--danger)';
    } catch (err) {
      resultEl.textContent = 'Error: ' + err.message;
      resultEl.style.color = 'var(--danger)';
    } finally {
      testBtn.disabled = false;
    }
  }

  async function switchProvider(id) {
    const statusEl2 = document.getElementById('prov-status');
    const switchBtn = document.getElementById('switch-btn');
    if (!statusEl2 || !switchBtn) return;
    switchBtn.disabled = true;
    statusEl2.textContent = 'Switching...';
    try {
      await fetch('/api/providers/v2/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: id }),
      });
      await loadProviders();
      statusEl2.textContent = 'Switched to ' + id;
    } catch (err) {
      statusEl2.textContent = 'Error: ' + err.message;
      switchBtn.disabled = false;
    }
  }

  async function loadProviders() {
    try {
      const data = await fetch('/api/providers/v2/').then(function(r){return r.json();});
      providers = data.providers || [];
      activeProvider = data.active || '';
      statusEl.textContent = 'Active: ' + (activeProvider || 'none');
      renderList();
      if (selectedId) openProvider(selectedId);
    } catch (err) {
      statusEl.textContent = 'Error loading providers';
    }
  }

  // Skeleton
  listEl.innerHTML = [1,2,3,4].map(function(){
    return '<div class="skeleton" style="height:60px;margin:6px;border-radius:8px;"></div>';
  }).join('');

  loadProviders();
})();
```

## Part B: Profile management - add profiles tab to settings page

The existing `/settings` page at `packages/web/assets/web/settings.html` handles operator config. Add a "Profiles" tab there rather than a separate page.

### Add profile routes to `src/api/ops-routes.ts` or create a new file

```typescript
import { listProfiles, createProfile, deleteProfile, switchProfile } from '../profiles/manager.js';

// Mount at /api/profiles:
opsApiRouter.get('/profiles', (_req, res) => {
  res.json({ profiles: listProfiles() });
});

opsApiRouter.post('/profiles', express.json(), async (req, res) => {
  const name = String(req.body?.name ?? '').trim();
  if (!name) { res.status(400).json({ error: 'name is required' }); return; }
  try {
    const p = await createProfile(name, req.body?.opts ?? {});
    res.status(201).json(p);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

opsApiRouter.post('/profiles/:name/switch', async (req, res) => {
  try {
    await switchProfile(req.params.name);
    res.json({ ok: true, active: req.params.name });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

opsApiRouter.delete('/profiles/:name', async (req, res) => {
  try {
    await deleteProfile(req.params.name);
    res.status(204).end();
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
```

### Profile tab HTML to add in `settings.html`

Add a "Profiles" nav tab alongside existing settings tabs. The profiles panel shows:
- List of existing profiles (GET /api/profiles)
- Active profile badge
- "Switch" button per profile
- "Create profile" form: name input + submit
- "Delete" button (disabled for default profile)

### Profile tab JS

IIFE loaded by settings page or a new `packages/web/assets/web/profiles.js`:
- `loadProfiles()`: GET /api/profiles, render list
- Switch: POST /api/profiles/:name/switch, re-render
- Create: POST /api/profiles, refresh
- Delete: DELETE /api/profiles/:name with confirmation, refresh

## Tests

Add to or create `src/api/providers-api.test.ts`:
- GET /api/providers/v2/ returns `{ providers, active, configured }`
- GET /api/providers/v2/:id/health returns 400 for unconfigured provider
- POST /api/providers/v2/switch with missing provider returns 400

Profile routes in ops-routes tests:
- GET /api/profiles returns `{ profiles: [] }` or includes default profile
- POST /api/profiles with name creates profile and returns 201
- DELETE /api/profiles/:name returns 204

## Acceptance criteria

- `/providers` lists all providers with configured/unconfigured status
- Clicking a provider shows its models and a "Test health" button that returns latency
- "Switch to X" makes that provider active and reflects in the page header
- Profiles are manageable from the settings page without CLI
- Creating and switching profiles updates the workspace context line
