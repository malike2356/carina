# Prompt 18: Plugins, Extensions, Updates, and Migration

You are working in the Carina mono-repo at `core.carinaai.uk/`.

## What already exists

**Extensions backend (complete):**
- `src/extensions/manager.ts` - `loadExtension(path)`, `listExtensions()`, `unloadExtension(id)`, `reloadExtension(id)`
- `src/extensions/installer.ts` - `installExtension(source)`, `uninstallExtension(id)`
- `src/extensions/store.ts` - `ExtensionRecord` persistence under CARINA_HOME/extensions/
- `src/extensions/manifest.ts` - `ExtensionManifest` type: `{ id, name, version, description, hooks, entrypoint }`
- `src/extensions/health.ts` - `checkExtensionHealth(id)`, `ExtensionHealthResult`

**Plugins backend (complete):**
- `src/plugins/loader.ts` - `loadPlugin(path)`, `listLoadedPlugins()`
- `src/plugins/registry.ts` - `registerPlugin(manifest)`, `getPlugin(id)`, `listPlugins()`

**No GUI pages exist for either.**

## Part A: Extensions and plugins page

### Step 1: Add `'extensions'` to `WorkspacePageId` in `packages/web/src/workspace-chrome.ts`

```typescript
| 'extensions'
```

### Step 2: Add nav item

```typescript
{
  id: 'extensions',
  href: '/extensions',
  label: 'Extensions',
  description: 'Manage installed extensions and plugins',
},
```

### Step 3: Create `src/api/extensions-api.ts`

```typescript
import { Router, type Request, type Response } from 'express';
import {
  listExtensions, unloadExtension, reloadExtension,
} from '../extensions/manager.js';
import {
  installExtension, uninstallExtension,
} from '../extensions/installer.js';
import { checkExtensionHealth } from '../extensions/health.js';
import { listPlugins, getPlugin } from '../plugins/registry.js';

export const extensionsApiRouter = Router();

// Extensions
extensionsApiRouter.get('/', (_req, res) => {
  res.json({ extensions: listExtensions() });
});

extensionsApiRouter.get('/:id/health', async (req, res) => {
  try {
    const result = await checkExtensionHealth(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(404).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

extensionsApiRouter.post('/:id/reload', async (req, res) => {
  try {
    await reloadExtension(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

extensionsApiRouter.delete('/:id', async (req, res) => {
  try {
    await uninstallExtension(req.params.id);
    res.status(204).end();
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

extensionsApiRouter.post('/install', async (req, res) => {
  const source = String(req.body?.source ?? '').trim();
  if (!source) { res.status(400).json({ error: 'source is required' }); return; }
  try {
    const ext = await installExtension(source);
    res.status(201).json(ext);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// Plugins
extensionsApiRouter.get('/plugins', (_req, res) => {
  res.json({ plugins: listPlugins() });
});

extensionsApiRouter.get('/plugins/:id', (req, res) => {
  const p = getPlugin(req.params.id);
  if (!p) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(p);
});
```

Mount in `createWebServer()`:
```typescript
import { extensionsApiRouter } from '#core/api/extensions-api.js';
app.use('/api/extensions', express.json(), requireAuth, extensionsApiRouter);
```

### Step 4: Load extensions HTML in `createWebServer()`

```typescript
const extensionsHtml = decoratePageHtml(
  await fs.readFile(path.join(WEB_STATIC, 'extensions.html'), 'utf-8').catch(() => null),
  carinaVersion,
  { workspacePage: 'extensions' },
);
if (extensionsHtml) {
  app.get('/extensions', (_req, res) => { res.type('html').send(extensionsHtml); });
}
app.get('/extensions.js', (_req, res) => {
  res.set('Cache-Control', 'no-cache');
  res.type('application/javascript').sendFile(path.join(WEB_STATIC, 'extensions.js'));
});
```

### Step 5: Create `packages/web/assets/web/extensions.html`

Two-tab layout: Extensions / Plugins. Each tab has a list with card layout.

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<meta name="theme-color" content="#0d0d0f">
<title>Extensions; Carina</title>
<style>
  .ext-wrap { flex:1; overflow-y:auto; padding:1rem 1.25rem 2rem; max-width:900px; }
  .ext-tabs { display:flex; border-bottom:1px solid var(--border); margin-bottom:1rem; }
  .ext-tab { padding:0.55rem 1rem; border:none; border-bottom:2px solid transparent; background:transparent; color:var(--muted); cursor:pointer; font-size:0.82rem; }
  .ext-tab.active { color:var(--text); border-bottom-color:var(--accent); }
  .ext-card { background:var(--surface-2); border:1px solid var(--border); border-radius:10px; padding:0.75rem 0.85rem; margin-bottom:0.5rem; display:flex; align-items:flex-start; gap:0.65rem; }
  .ext-info { flex:1; min-width:0; }
  .ext-name { font-size:0.84rem; font-weight:600; }
  .ext-version { font-size:0.68rem; color:var(--muted); margin-left:0.4rem; }
  .ext-desc { font-size:0.75rem; color:var(--muted); margin-top:0.2rem; line-height:1.4; }
  .ext-hooks { font-size:0.68rem; color:var(--accent); margin-top:0.2rem; }
  .ext-actions { display:flex; flex-direction:column; gap:0.3rem; flex-shrink:0; }
  .btn-reload { background:var(--surface-2); border:1px solid var(--border); color:var(--text); border-radius:6px; padding:0.25rem 0.55rem; font-size:0.72rem; cursor:pointer; }
  .btn-uninstall { background:none; border:1px solid var(--border); color:var(--danger); border-radius:6px; padding:0.25rem 0.55rem; font-size:0.72rem; cursor:pointer; }
  .install-form { background:var(--surface-2); border:1px solid var(--border); border-radius:10px; padding:0.75rem; margin-bottom:1rem; display:flex; gap:0.5rem; }
  .install-form input { flex:1; background:var(--bg); border:1px solid var(--border); color:var(--text); border-radius:6px; padding:0.4rem 0.65rem; font-size:0.82rem; }
  .install-form button { background:var(--accent); color:#0d0d0f; border:none; border-radius:8px; padding:0.4rem 0.85rem; font-size:0.82rem; font-weight:700; cursor:pointer; }
  #install-status { font-size:0.75rem; margin-top:0.35rem; }
</style>
</head>
<body>
<!--CARINA_WORKSPACE_BEGIN-->
<header class="ws-page-header">
  <h1>Extensions</h1>
  <span class="status" id="status"></span>
</header>
<div class="ext-wrap">
  <div class="ext-tabs">
    <button class="ext-tab active" data-tab="extensions">Extensions</button>
    <button class="ext-tab" data-tab="plugins">Plugins</button>
  </div>

  <div id="tab-extensions">
    <div class="install-form">
      <input id="install-source" placeholder="Extension path or npm package name" type="text">
      <button id="install-btn">Install</button>
    </div>
    <div id="install-status" style="color:var(--muted);font-size:0.75rem;"></div>
    <div id="ext-list"></div>
  </div>

  <div id="tab-plugins" hidden>
    <div id="plugin-list"></div>
  </div>
</div>
<!--CARINA_WORKSPACE_END-->
<script src="/extensions.js"></script>
</body>
</html>
```

### Step 6: Create `packages/web/assets/web/extensions.js`

IIFE with:

```javascript
(function () {
  const statusEl = document.getElementById('status');
  const extListEl = document.getElementById('ext-list');
  const pluginListEl = document.getElementById('plugin-list');
  const installStatus = document.getElementById('install-status');

  function escapeHtml(t) {
    return String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function renderExtCard(ext) {
    var hooks = (ext.hooks || []).join(', ');
    return '<div class="ext-card">' +
      '<div class="ext-info">' +
        '<div class="ext-name">' + escapeHtml(ext.name || ext.id) +
          '<span class="ext-version">v' + escapeHtml(ext.version || '0.0.0') + '</span>' +
        '</div>' +
        (ext.description ? '<div class="ext-desc">' + escapeHtml(ext.description) + '</div>' : '') +
        (hooks ? '<div class="ext-hooks">Hooks: ' + escapeHtml(hooks) + '</div>' : '') +
      '</div>' +
      '<div class="ext-actions">' +
        '<button class="btn-reload" data-reload="' + escapeHtml(ext.id) + '">Reload</button>' +
        '<button class="btn-uninstall" data-uninstall="' + escapeHtml(ext.id) + '">Remove</button>' +
      '</div>' +
    '</div>';
  }

  async function loadExtensions() {
    extListEl.innerHTML = [1,2,3].map(function(){
      return '<div class="skeleton" style="height:80px;border-radius:10px;margin-bottom:6px;"></div>';
    }).join('');
    const data = await fetch('/api/extensions/').then(function(r){return r.json();});
    const exts = data.extensions || [];
    statusEl.textContent = exts.length + ' extension' + (exts.length === 1 ? '' : 's');
    if (!exts.length) {
      extListEl.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--muted);font-size:0.83rem;">No extensions installed. Enter a path or package name above.</div>';
      return;
    }
    extListEl.innerHTML = exts.map(renderExtCard).join('');
    extListEl.querySelectorAll('[data-reload]').forEach(function(btn) {
      btn.addEventListener('click', async function() {
        btn.disabled = true;
        await fetch('/api/extensions/' + btn.dataset.reload + '/reload', { method: 'POST' });
        loadExtensions();
      });
    });
    extListEl.querySelectorAll('[data-uninstall]').forEach(function(btn) {
      btn.addEventListener('click', async function() {
        if (!confirm('Remove this extension?')) return;
        await fetch('/api/extensions/' + btn.dataset.uninstall, { method: 'DELETE' });
        loadExtensions();
      });
    });
  }

  async function loadPlugins() {
    pluginListEl.innerHTML = '<div class="skeleton" style="height:60px;border-radius:8px;"></div>';
    const data = await fetch('/api/extensions/plugins').then(function(r){return r.json();});
    const plugins = data.plugins || [];
    if (!plugins.length) {
      pluginListEl.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--muted);font-size:0.83rem;">No plugins registered.</div>';
      return;
    }
    pluginListEl.innerHTML = plugins.map(function(p) {
      return '<div class="ext-card">' +
        '<div class="ext-info">' +
          '<div class="ext-name">' + escapeHtml(p.name || p.id) +
            (p.version ? '<span class="ext-version">v' + escapeHtml(p.version) + '</span>' : '') +
          '</div>' +
          (p.description ? '<div class="ext-desc">' + escapeHtml(p.description) + '</div>' : '') +
        '</div>' +
      '</div>';
    }).join('');
  }

  document.querySelectorAll('.ext-tab').forEach(function(tab) {
    tab.addEventListener('click', function() {
      document.querySelectorAll('.ext-tab').forEach(function(t){t.classList.remove('active');});
      tab.classList.add('active');
      var id = tab.dataset.tab;
      document.getElementById('tab-extensions').hidden = id !== 'extensions';
      document.getElementById('tab-plugins').hidden = id !== 'plugins';
      if (id === 'plugins') loadPlugins();
    });
  });

  document.getElementById('install-btn').addEventListener('click', async function() {
    var source = document.getElementById('install-source').value.trim();
    if (!source) { installStatus.textContent = 'Enter a path or package name'; return; }
    installStatus.textContent = 'Installing...';
    installStatus.style.color = 'var(--muted)';
    try {
      await fetch('/api/extensions/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source }),
      });
      installStatus.textContent = 'Installed';
      installStatus.style.color = '#4ade80';
      document.getElementById('install-source').value = '';
      loadExtensions();
    } catch (err) {
      installStatus.textContent = 'Error: ' + err.message;
      installStatus.style.color = 'var(--danger)';
    }
  });

  loadExtensions();
})();
```

## Part B: Version/update banner in workspace hub

The workspace hub page (`/workspace`) should show a Carina version badge and link to update notes if a newer version is detected.

In `packages/web/assets/web/workspace.html` (or the hub template in workspace-chrome.ts if the hub is generated dynamically), add:

```html
<div id="version-banner" style="font-size:0.72rem;color:var(--muted);margin-top:0.5rem;"></div>
```

In workspace JS or `workspace-prefs.js`:
```javascript
fetch('/api/health').then(function(r){return r.json();}).then(function(d) {
  var el = document.getElementById('version-banner');
  if (el && d.version) el.textContent = 'Carina v' + d.version;
});
```

## Tests

Create `src/api/extensions-api.test.ts`:
- GET /api/extensions/ returns `{ extensions: [] }` when none installed
- GET /api/extensions/plugins returns `{ plugins: [] }` when none registered
- GET /api/extensions/:id/health returns 404 for unknown extension
- DELETE /api/extensions/:id returns 204
- POST /api/extensions/install with missing source returns 400
- POST /api/extensions/:id/reload returns 400 for unknown id

## Acceptance criteria

- `/extensions` lists installed extensions with version, description, and hooks
- Reload and Remove buttons work and refresh the list
- Install form accepts a path or package name, shows feedback
- Plugins tab lists registered plugins (read-only)
- Version badge shows in the workspace hub
