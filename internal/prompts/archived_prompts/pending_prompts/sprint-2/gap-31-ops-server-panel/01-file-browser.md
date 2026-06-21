# Gap 31 - Prompt 01: File Browser

**Status: COMPLETED 2026-06-21**

**Gap:** 31 Ops Server Panel
**Prompt number:** 01 of 03
**Name:** File browser with inline editor
**Primary agent:** Cursor
**Estimated hours:** 2.5 h
**Depends on:** Nothing

---

## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`


## Read first

1. `backends/admin/ops.carinaai.uk/server.ts` - import pattern (lines 1-38), router registration (lines 132-158)
2. `backends/admin/ops.carinaai.uk/middleware/auth.ts` - requireAdmin, requireSuperAdmin
3. `backends/admin/ops.carinaai.uk/views/layout.ejs` lines 143-152 - the Admin nav group where "Server" link goes
4. `backends/admin/ops.carinaai.uk/routes/settings.ts` - example of a simple CRUD route with EJS render
5. `backends/admin/ops.carinaai.uk/views/settings.ejs` - example of a form-based EJS view

---

## Goal

Build a file browser at `/server/files` that lets ops admins navigate the VPS
filesystem (within a set of allowlisted root paths) and view any text file.
Superadmins can also save edits. The editor is Monaco (loaded from CDN).

This removes the need to SSH into the VPS to inspect or tweak config files.

---

## Step 1: Create `backends/admin/ops.carinaai.uk/lib/server-fs.ts`

This module contains all filesystem logic. The route file must not call `fs`
directly; it must call these helpers.

```typescript
import fs from 'fs/promises';
import path from 'path';

// Read allowed roots from env; fall back to sensible VPS defaults.
// Format: comma-separated absolute paths.
// Example env: CARINA_SERVER_FS_ROOTS=/home/malike/apps,/www/wwwroot,/etc/nginx/conf.d
function getAllowedRoots(): string[] {
  const env = process.env.CARINA_SERVER_FS_ROOTS;
  if (env) return env.split(',').map(s => s.trim()).filter(Boolean);
  return [
    '/home/malike/apps',
    '/www/wwwroot',
    '/etc/nginx/conf.d',
    '/etc/php/8.3/fpm/pool.d',
  ];
}

// SECURITY: Resolve the requested path and confirm it is under an allowed root.
// Returns the resolved absolute path or throws if not allowed.
export function resolveSafe(requestedPath: string): string {
  const resolved = path.resolve(requestedPath);
  const roots = getAllowedRoots();
  for (const root of roots) {
    const resolvedRoot = path.resolve(root);
    if (resolved === resolvedRoot || resolved.startsWith(resolvedRoot + path.sep)) {
      return resolved;
    }
  }
  throw new Error(`Path not in allowed roots: ${resolved}`);
}

export interface FsEntry {
  name: string;
  path: string; // absolute path
  type: 'dir' | 'file';
  size?: number; // bytes, only for files
  mtime?: number; // unix ms, only for files
}

// List direct children of a directory. Returns [] if not a directory or unreadable.
export async function listDir(absPath: string): Promise<FsEntry[]> {
  resolveSafe(absPath); // throws if outside allowed roots
  let entries: fs.Dirent[];
  try {
    entries = await fs.readdir(absPath, { withFileTypes: true });
  } catch {
    return [];
  }
  const result: FsEntry[] = [];
  for (const e of entries) {
    const fullPath = path.join(absPath, e.name);
    if (e.isDirectory()) {
      result.push({ name: e.name, path: fullPath, type: 'dir' });
    } else if (e.isFile()) {
      let size: number | undefined;
      let mtime: number | undefined;
      try {
        const stat = await fs.stat(fullPath);
        size = stat.size;
        mtime = stat.mtimeMs;
      } catch { /* ignore */ }
      result.push({ name: e.name, path: fullPath, type: 'file', size, mtime });
    }
  }
  return result.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

const MAX_FILE_BYTES = 512 * 1024; // 512 KB

// Read a text file. Returns { content, language } or throws.
// Throws if file is binary or too large.
export async function readFile(absPath: string): Promise<{ content: string; language: string }> {
  resolveSafe(absPath);
  const stat = await fs.stat(absPath);
  if (!stat.isFile()) throw new Error('Not a file');
  if (stat.size > MAX_FILE_BYTES) throw new Error(`File too large (${stat.size} bytes; max ${MAX_FILE_BYTES})`);
  const buf = await fs.readFile(absPath);
  // Reject binary: check for null bytes in first 8KB
  const sample = buf.subarray(0, 8192);
  if (sample.indexOf(0) !== -1) throw new Error('Binary file');
  return { content: buf.toString('utf8'), language: detectLanguage(absPath) };
}

// Write a text file. The path must already exist (no creating new files).
export async function writeFile(absPath: string, content: string): Promise<void> {
  resolveSafe(absPath);
  const stat = await fs.stat(absPath);
  if (!stat.isFile()) throw new Error('Not a file');
  await fs.writeFile(absPath, content, 'utf8');
}

function detectLanguage(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const map: Record<string, string> = {
    '.ts': 'typescript', '.js': 'javascript', '.mjs': 'javascript',
    '.json': 'json', '.env': 'shell', '.sh': 'shell',
    '.md': 'markdown', '.html': 'html', '.css': 'css',
    '.conf': 'nginx', '.ini': 'ini', '.yaml': 'yaml', '.yml': 'yaml',
    '.php': 'php', '.py': 'python', '.sql': 'sql', '.txt': 'plaintext',
    '.log': 'plaintext',
  };
  return map[ext] ?? 'plaintext';
}

export function getAllowedRootsPublic(): string[] {
  return getAllowedRoots();
}
```

---

## Step 2: Add file browser routes to `backends/admin/ops.carinaai.uk/routes/server-panel.ts`

Create this file (it will also receive service and log routes in later prompts).

```typescript
import { Router } from 'express';
import { requireSuperAdmin } from '../middleware/auth.js';
import {
  getAllowedRootsPublic,
  listDir,
  readFile,
  writeFile,
  resolveSafe,
} from '../lib/server-fs.js';

export const serverPanelRouter = Router();

// Landing page
serverPanelRouter.get('/', (_req, res) => {
  res.render('server/index', { title: 'Server' });
});

// File browser page
serverPanelRouter.get('/files', async (req, res) => {
  const roots = getAllowedRootsPublic();
  const pathParam = typeof req.query.path === 'string' ? req.query.path : null;
  let entries = null;
  let currentPath = null;
  let breadcrumbs: { name: string; path: string }[] = [];
  let error: string | null = null;

  if (pathParam) {
    try {
      const safe = resolveSafe(pathParam);
      currentPath = safe;
      entries = await listDir(safe);
      breadcrumbs = buildBreadcrumbs(safe, roots);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Access denied';
    }
  }

  res.render('server/files', {
    title: 'Server Files',
    roots,
    currentPath,
    entries,
    breadcrumbs,
    error,
    fileContent: null,
    fileLanguage: null,
    filePath: null,
    flash: req.query.saved === '1' ? 'Saved.' : null,
  });
});

// Read a single file (returns JSON for the editor fetch)
serverPanelRouter.get('/files/read', async (req, res) => {
  const filePath = typeof req.query.path === 'string' ? req.query.path : '';
  try {
    const { content, language } = await readFile(filePath);
    res.json({ ok: true, content, language, path: filePath });
  } catch (e) {
    res.status(400).json({ ok: false, error: e instanceof Error ? e.message : 'Error' });
  }
});

// Write a file (superadmin only)
serverPanelRouter.post('/files/write', requireSuperAdmin, async (req, res) => {
  const { path: filePath, content } = req.body as { path?: string; content?: string };
  if (!filePath || content === undefined) {
    res.status(400).json({ ok: false, error: 'path and content required' });
    return;
  }
  try {
    await writeFile(filePath, content);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ ok: false, error: e instanceof Error ? e.message : 'Error' });
  }
});

function buildBreadcrumbs(
  absPath: string,
  roots: string[],
): { name: string; path: string }[] {
  const crumbs: { name: string; path: string }[] = [];
  for (const root of roots) {
    if (absPath === root || absPath.startsWith(root + '/')) {
      const rel = absPath.slice(root.length);
      crumbs.push({ name: root.split('/').at(-1) ?? root, path: root });
      const parts = rel.split('/').filter(Boolean);
      let built = root;
      for (const part of parts) {
        built = built + '/' + part;
        crumbs.push({ name: part, path: built });
      }
      return crumbs;
    }
  }
  return crumbs;
}
```

---

## Step 3: Create `backends/admin/ops.carinaai.uk/views/server/index.ejs`

```html
<h1 class="page-title">Server</h1>
<div class="card-grid" style="margin-top:1.5rem;">
  <a href="/server/files" class="card card-link">
    <div class="card-icon">FS</div>
    <div class="card-body">
      <div class="card-title">File Browser</div>
      <div class="card-desc">Browse and edit config files on the VPS</div>
    </div>
  </a>
  <a href="/server/services" class="card card-link">
    <div class="card-icon">SVC</div>
    <div class="card-body">
      <div class="card-title">Services</div>
      <div class="card-desc">Service status and restart controls</div>
    </div>
  </a>
  <a href="/server/logs" class="card card-link">
    <div class="card-icon">LOG</div>
    <div class="card-body">
      <div class="card-title">Log Stream</div>
      <div class="card-desc">Live tail of application and server logs</div>
    </div>
  </a>
</div>
```

---

## Step 4: Create `backends/admin/ops.carinaai.uk/views/server/files.ejs`

The view has two columns: a left sidebar showing the tree and a right panel
showing file content in a Monaco editor.

Key requirements:
- When the page loads with no `?path=` query, show the list of allowed roots as
  clickable directory links.
- When `?path=` points to a directory, show a breadcrumb and the directory listing.
- When the user clicks a file in the listing, the JS fetches `/server/files/read?path=...`
  and loads the result into the Monaco editor (no page reload).
- Save button calls `POST /server/files/write` with the current path and editor content.
  On success, show a flash "Saved." On failure, show the error.
- Show the Save button only if the session role is 'superadmin':
  `<% if (locals.session && session.role === 'superadmin') { %>`.
- Binary file error from the API should display "Cannot display binary file" in the
  editor panel instead of crashing.

Monaco CDN loader:
```html
<script>
  var require = { paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.52.2/min/vs' } };
</script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.52.2/min/vs/loader.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.52.2/min/vs/editor/editor.main.nonce.js"></script>
```

Then in a DOMContentLoaded script:
```js
require(['vs/editor/editor.main'], function () {
  window._monacoEditor = monaco.editor.create(document.getElementById('editor-mount'), {
    value: '',
    language: 'plaintext',
    theme: 'vs-dark',
    automaticLayout: true,
    minimap: { enabled: false },
    fontSize: 13,
    lineNumbers: 'on',
    scrollBeyondLastLine: false,
  });
});
```

When a file is selected, call:
```js
async function loadFile(filePath) {
  const r = await fetch('/server/files/read?path=' + encodeURIComponent(filePath));
  const data = await r.json();
  if (!data.ok) {
    monaco.editor.setModelLanguage(window._monacoEditor.getModel(), 'plaintext');
    window._monacoEditor.setValue('Error: ' + data.error);
    return;
  }
  monaco.editor.setModelLanguage(window._monacoEditor.getModel(), data.language);
  window._monacoEditor.setValue(data.content);
  document.getElementById('current-file-path').value = data.path;
  document.getElementById('editor-filename').textContent = data.path.split('/').at(-1);
}
```

Layout hint: use a two-column CSS grid (`grid-template-columns: 280px 1fr`).
The left column scrolls independently; the right column fills the remaining height.
Match the existing ops dark theme (check `/public/ops-shell.css` for variable names).

---

## Step 5: Wire into server.ts and layout.ejs

In `server.ts`, after line 154 (`app.use('/users', usersRouter);`):
```typescript
import { serverPanelRouter } from './routes/server-panel.js';
// ...
app.use('/server', serverPanelRouter);
```

In `views/layout.ejs`, inside the Admin `nav-group` details block
(after the Users link and before `</div>`):
```html
<a href="<%= withV('/server') %>" class="nav-link<%= ap.startsWith('/server') ? ' active' : '' %>">Server</a>
```

Also update the `navOpen` call for that group to include `'/server'`:
```
navOpen(['/tui', '/settings', '/users', '/server'])
```

---

## Done When

- [ ] `/server/files` loads with no errors and shows allowed roots as clickable links
- [ ] Clicking a directory navigates into it with a breadcrumb
- [ ] Clicking a `.conf`, `.ts`, `.json`, `.env` file loads content into Monaco editor
- [ ] Clicking a binary or too-large file shows an error message instead of crashing
- [ ] Save button is hidden for non-superadmin sessions
- [ ] Save button calls the write endpoint and shows "Saved." flash on success
- [ ] Attempting to browse `/etc/passwd` or a path outside allowed roots returns 400
- [ ] TypeScript compiles with no errors (`pnpm build` in ops root passes)
