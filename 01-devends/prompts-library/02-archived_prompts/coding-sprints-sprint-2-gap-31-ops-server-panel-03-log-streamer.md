# Gap 31 - Prompt 03: Log Streamer

**Status: COMPLETED 2026-06-21**

**Gap:** 31 Ops Server Panel
**Prompt number:** 03 of 03
**Name:** Live log file streaming via SSE
**Primary agent:** Cursor
**Estimated hours:** 1.5 h
**Depends on:** 01-file-browser.md (server-panel.ts must exist)

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

1. `backends/admin/ops.carinaai.uk/routes/server-panel.ts` - append new routes here
2. `backends/admin/ops.carinaai.uk/routes/scout-dashboard.ts` - look at any SSE
   streaming pattern; the ops panel already uses SSE for real-time data
3. `backends/admin/ops.carinaai.uk/lib/server-fs.ts` - `resolveSafe` is reused here
   for path validation

---

## Goal

Add a `/server/logs` page with two parts:
- Left: a file picker listing known log files grouped by source
- Right: a live stream area that tails the selected file via SSE

When the user picks a file, the browser opens an SSE connection to
`/server/api/logs/stream?file=<path>`. The server spawns `tail -n 100 -f <file>`
and pipes each line as an SSE event. When the browser disconnects, the `tail`
process is killed.

---

## Step 1: Add log file discovery to `backends/admin/ops.carinaai.uk/lib/server-fs.ts`

Append these exports to the existing `server-fs.ts` (do not rewrite the file):

```typescript
import { glob } from 'fs/promises'; // Node 22+ has fs.glob; use fast-glob if not available

// Allowed log roots. Source directories only - glob will descend.
// Configurable via CARINA_SERVER_LOG_ROOTS (comma-separated).
function getLogRoots(): string[] {
  const env = process.env.CARINA_SERVER_LOG_ROOTS;
  if (env) return env.split(',').map(s => s.trim()).filter(Boolean);
  return [
    '/www/wwwroot/propreneur-v2/storage/logs',
    '/var/log/nginx',
    '/home/malike/apps/core.carinaai.uk/data/logs',
    '/home/malike/apps',   // docker container logs are in subdirs
  ];
}

export interface LogFileEntry {
  displayName: string; // e.g. "laravel.log"
  path: string; // absolute path
  group: string; // derived from parent dir
}

// Scan log roots for *.log files (depth 3). Returns sorted list.
export async function discoverLogFiles(): Promise<LogFileEntry[]> {
  const roots = getLogRoots();
  const result: LogFileEntry[] = [];
  const { readdir, stat } = await import('fs/promises');
  const pathMod = await import('path');

  async function scan(dir: string, depth: number, group: string): Promise<void> {
    if (depth < 0) return;
    let entries: import('fs').Dirent[];
    try { entries = await readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const full = pathMod.join(dir, e.name);
      if (e.isDirectory() && depth > 0) {
        await scan(full, depth - 1, group || e.name);
      } else if (e.isFile() && (e.name.endsWith('.log') || e.name.endsWith('.log.gz') === false && e.name.includes('.log.'))) {
        if (e.name.endsWith('.gz')) continue;
        try {
          const s = await stat(full);
          if (s.size === 0) continue;
        } catch { continue; }
        result.push({ displayName: e.name, path: full, group: group || pathMod.basename(dir) });
      }
    }
  }

  for (const root of roots) {
    const groupName = root.split('/').at(-1) ?? root;
    await scan(root, 3, groupName);
  }

  result.sort((a, b) => a.group.localeCompare(b.group) || a.displayName.localeCompare(b.displayName));
  return result;
}

// Validate that a log path is under an allowed log root.
export function resolveLogSafe(requestedPath: string): string {
  const pathMod = require('path');
  const resolved = pathMod.resolve(requestedPath);
  const roots = getLogRoots();
  for (const root of roots) {
    const resolvedRoot = pathMod.resolve(root);
    if (resolved === resolvedRoot || resolved.startsWith(resolvedRoot + pathMod.sep)) {
      if (!resolved.endsWith('.gz')) return resolved;
    }
  }
  throw new Error(`Log path not in allowed roots: ${resolved}`);
}
```

Note: if `fs.glob` is not available in the Node version on the VPS, use the
recursive `scan` helper above (which is already written) and remove the `glob`
import. The `scan` helper is the implementation to use.

For the `require('path')` in `resolveLogSafe`: since this is ESM, use
`import path from 'path'` at the top of the file (it is already imported
in the existing `server-fs.ts`) and reference `path.resolve` / `path.sep` directly.

---

## Step 2: Add log routes to `backends/admin/ops.carinaai.uk/routes/server-panel.ts`

Append to the existing file:

```typescript
import { spawn } from 'child_process';
import { discoverLogFiles, resolveLogSafe } from '../lib/server-fs.js';

// Log picker page
serverPanelRouter.get('/logs', async (_req, res) => {
  const files = await discoverLogFiles();
  // Group by the `group` field
  const grouped: Record<string, typeof files> = {};
  for (const f of files) {
    (grouped[f.group] ??= []).push(f);
  }
  res.render('server/logs', { title: 'Log Stream', grouped });
});

// SSE log stream
serverPanelRouter.get('/api/logs/stream', (req, res) => {
  const filePath = typeof req.query.file === 'string' ? req.query.file : '';
  let safePath: string;
  try {
    safePath = resolveLogSafe(filePath);
  } catch (e) {
    res.status(400).end('Invalid log path');
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('X-Accel-Buffering', 'no'); // prevent nginx buffering
  res.flushHeaders();

  const tail = spawn('tail', ['-n', '100', '-f', safePath]);

  function sendLine(line: string): void {
    // SSE format: "data: <content>\n\n"
    res.write('data: ' + line.replace(/\n/g, ' ') + '\n\n');
  }

  let buf = '';
  tail.stdout.on('data', (chunk: Buffer) => {
    buf += chunk.toString('utf8');
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const line of lines) {
      sendLine(line);
    }
  });

  tail.stderr.on('data', (chunk: Buffer) => {
    sendLine('[stderr] ' + chunk.toString('utf8').trim());
  });

  tail.on('close', (code) => {
    sendLine('[stream closed, exit code ' + code + ']');
    res.end();
  });

  req.on('close', () => {
    tail.kill('SIGTERM');
  });
});
```

---

## Step 3: Create `backends/admin/ops.carinaai.uk/views/server/logs.ejs`

Layout: two columns.
- Left (250px): grouped list of log files. Each entry is a clickable item.
  Clicking it opens the SSE stream for that file in the right panel.
- Right: a scrollable terminal-like area (`<pre id="log-output">`) that shows
  incoming lines. Limit the displayed lines to the last 2000 to avoid DOM bloat.

Include an "Auto-scroll" toggle checkbox. When checked (default), the log area
scrolls to the bottom on each new line.

Clear button: empties the log output area but keeps the SSE connection open.

Group display: use `<details open>` for each group so all groups are expanded
by default but can be collapsed.

JS sketch:

```js
let currentEs = null;

function openLog(filePath) {
  if (currentEs) { currentEs.close(); currentEs = null; }
  document.getElementById('log-output').textContent = '';
  document.getElementById('log-filename').textContent = filePath.split('/').at(-1);

  const es = new EventSource('/server/api/logs/stream?file=' + encodeURIComponent(filePath));
  currentEs = es;

  const output = document.getElementById('log-output');
  const autoScroll = document.getElementById('auto-scroll');
  const MAX_LINES = 2000;

  es.onmessage = function(e) {
    const line = document.createElement('div');
    line.className = 'log-line';
    line.textContent = e.data;
    output.appendChild(line);
    // Trim old lines
    while (output.children.length > MAX_LINES) {
      output.removeChild(output.firstChild);
    }
    if (autoScroll.checked) {
      output.scrollTop = output.scrollHeight;
    }
  };

  es.onerror = function() {
    const line = document.createElement('div');
    line.className = 'log-line log-error';
    line.textContent = '[connection lost]';
    output.appendChild(line);
  };
}

document.getElementById('clear-btn').addEventListener('click', () => {
  document.getElementById('log-output').textContent = '';
});
```

Styling for the log area:
```css
#log-output {
  background: #0d0d0d;
  color: #d4d4d4;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  line-height: 1.5;
  padding: 12px;
  overflow-y: auto;
  height: calc(100vh - 140px);
  white-space: pre-wrap;
  word-break: break-all;
}
.log-error { color: #e05555; }
```

The left sidebar list items should highlight the selected file. Use a
`data-log-path` attribute and add an `active` class on click.

---

## Done When

- [ ] `/server/logs` renders with grouped file list on the left
- [ ] Clicking a file name starts streaming in the right panel without a page reload
- [ ] Lines appear in real time as they are written to the log file
- [ ] Auto-scroll is enabled by default; unchecking it stops the scroll
- [ ] Clear button empties the output area
- [ ] Selecting a second file closes the previous SSE connection and opens a new one
- [ ] Navigating away from the page closes the SSE connection (no orphan `tail` processes)
- [ ] Requesting a path outside allowed log roots returns 400
- [ ] TypeScript compiles with no errors
