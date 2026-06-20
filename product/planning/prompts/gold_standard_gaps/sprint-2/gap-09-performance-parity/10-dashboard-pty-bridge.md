# Gap 09 - Prompt 10: Dashboard PTY Bridge (Real TUI in Web)

> **REUSE RULE:** See `../REUSE-RULES.md`. Implement the behavior below in Carina's own voice. No competitor product names, labels, CLI text, UI copy, or config key names may appear verbatim in shipped code. Rename all user-visible elements to Carina equivalents before committing.


**Agent:** Claude Code
**Estimated hours:** 4-5 hrs
**Depends on:** Gap 07 TUI must be working; ops.carinaai.uk or app.carinaai.uk admin panel exists

---

## The Problem

Hermes ships a `hermes dashboard` command that embeds the REAL Hermes terminal TUI inside a
web browser via xterm.js and a WebSocket PTY bridge. It is NOT a React re-implementation of
the TUI - it spawns the actual `hermes --tui` process and streams its output to the browser.

Carina's web admin (ops.carinaai.uk) likely has a custom-built dashboard UI. The gap is:
any feature added to the TUI is NOT automatically in the web dashboard, because they are
separate implementations that diverge over time. The PTY bridge pattern fixes this forever:
one codebase for the TUI, visible in both terminal AND browser.

This also means operators without a terminal can access the full TUI from a browser tab,
including Scout panels, memory browser, skills manager, and operator logs.

---

## Read First

```
ops.carinaai.uk/server.ts                         (Express server)
ops.carinaai.uk/views/                            (EJS templates)
ops.carinaai.uk/routes/                           (Express routes)
core.carinaai.uk/bin/carina.ts                    (CLI entry point)
core.carinaai.uk/src/tui/                         (TUI code)
core.carinaai.uk/package.json                     (check if node-pty is present)
```

---

## Architecture

```
Browser (xterm.js)  <-->  WebSocket  <-->  Express WS Handler  <-->  node-pty  <-->  carina --tui
```

The PTY is a real pseudo-terminal. xterm.js renders it pixel-perfect including colors, box
drawing characters, and keyboard input. The user gets the exact same experience as the
terminal app, in a browser tab.

---

## 1. Install Dependencies

```bash
# In ops.carinaai.uk/ (or wherever the web admin lives)
pnpm add node-pty ws xterm
pnpm add -D @types/ws
```

`node-pty` requires native compilation. Add to package.json:
```json
{
  "scripts": {
    "postinstall": "electron-rebuild -f -w node-pty || true"
  }
}
```

Or use `@lydell/node-pty` (pure JS fallback - slower but no native compile):
```bash
pnpm add @lydell/node-pty
```

---

## 2. PTY WebSocket Handler

```typescript
// ops.carinaai.uk/src/pty-bridge.ts  (new file)

import { WebSocketServer, WebSocket } from 'ws';
import * as pty from 'node-pty';
import type { Server as HttpServer } from 'http';
import { resolve } from 'path';

const CARINA_BIN = resolve(process.env.CARINA_BIN ?? '../../core.carinaai.uk/bin/carina.ts');
const CARINA_CMD = process.env.NODE_ENV === 'production'
  ? ['node', CARINA_BIN]
  : ['npx', 'tsx', CARINA_BIN];

interface PTYSession {
  ptyProcess: pty.IPty;
  ws: WebSocket;
  cols: number;
  rows: number;
}

const sessions = new Map<string, PTYSession>();

export function attachPtyBridge(server: HttpServer): void {
  const wss = new WebSocketServer({ server, path: '/ws/tui' });

  wss.on('connection', (ws, req) => {
    // Require auth token (check session cookie or Authorization header)
    if (!isAuthorized(req)) {
      ws.close(4001, 'Unauthorized');
      return;
    }

    const sessionId = crypto.randomUUID();
    const cols = 220;
    const rows = 50;

    // Spawn the real Carina TUI
    const ptyProcess = pty.spawn(CARINA_CMD[0], [...CARINA_CMD.slice(1), '--tui'], {
      name: 'xterm-256color',
      cols,
      rows,
      cwd: process.env.HOME ?? '/tmp',
      env: {
        ...process.env,
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
        FORCE_COLOR: '3',
        // Pass through the workspace and profile
        CARINA_HOME: process.env.CARINA_HOME ?? `${process.env.HOME}/.carina`,
      },
    });

    sessions.set(sessionId, { ptyProcess, ws, cols, rows });

    // Stream PTY output to browser
    ptyProcess.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'output', data }));
      }
    });

    // Handle PTY exit
    ptyProcess.onExit(({ exitCode }) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'exit', exitCode }));
        ws.close();
      }
      sessions.delete(sessionId);
    });

    // Browser -> PTY: keyboard input and resize events
    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'input') {
          ptyProcess.write(msg.data);
        } else if (msg.type === 'resize') {
          ptyProcess.resize(msg.cols, msg.rows);
          sessions.get(sessionId)!.cols = msg.cols;
          sessions.get(sessionId)!.rows = msg.rows;
        }
      } catch { /* ignore malformed messages */ }
    });

    ws.on('close', () => {
      ptyProcess.kill();
      sessions.delete(sessionId);
    });

    // Send initial handshake
    ws.send(JSON.stringify({ type: 'connected', sessionId, cols, rows }));
  });
}

function isAuthorized(req: any): boolean {
  // Check session cookie from Express-session or a Bearer token
  const auth = req.headers.authorization ?? '';
  const validToken = process.env.ADMIN_WS_TOKEN;
  if (validToken && auth === `Bearer ${validToken}`) return true;
  // Add session cookie check here
  return process.env.NODE_ENV === 'development'; // dev: allow without auth
}
```

---

## 3. Wire Into Express Server

```typescript
// ops.carinaai.uk/server.ts  (modification)

import { createServer } from 'http';
import { attachPtyBridge } from './src/pty-bridge.js';

// Create HTTP server manually (WebSocket needs access to the raw http.Server)
const server = createServer(app);
attachPtyBridge(server);

// Use server.listen instead of app.listen
server.listen(PORT, () => {
  console.log(`Admin panel running on http://localhost:${PORT}`);
  console.log(`PTY bridge: ws://localhost:${PORT}/ws/tui`);
});
```

---

## 4. Browser xterm.js Client

Create a new admin page at `/tui`:

```html
<!-- ops.carinaai.uk/views/tui.ejs -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Carina TUI - Admin</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/xterm/css/xterm.css" />
  <style>
    body { margin: 0; background: #0a0a0a; display: flex; flex-direction: column; height: 100vh; }
    #toolbar { padding: 8px 16px; background: #111; display: flex; align-items: center; gap: 12px; }
    #toolbar span { color: #888; font-family: monospace; font-size: 13px; }
    #terminal { flex: 1; padding: 8px; }
    .status-dot { width: 8px; height: 8px; border-radius: 50%; background: #333; }
    .status-dot.connected { background: #22c55e; }
    .status-dot.disconnected { background: #ef4444; }
  </style>
</head>
<body>
  <div id="toolbar">
    <div class="status-dot" id="status-dot"></div>
    <span id="status-text">Connecting...</span>
    <span style="flex:1"></span>
    <button onclick="reconnect()" style="background:#222;color:#888;border:1px solid #333;padding:4px 12px;border-radius:4px;cursor:pointer">Reconnect</button>
  </div>
  <div id="terminal"></div>

  <script src="https://cdn.jsdelivr.net/npm/xterm/lib/xterm.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/xterm-addon-fit/lib/xterm-addon-fit.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/xterm-addon-web-links/lib/xterm-addon-web-links.js"></script>
  <script>
    const term = new Terminal({
      theme: {
        background: '#0a0a0a',
        foreground: '#e4e4e7',
        cursor: '#22c55e',
      },
      fontFamily: '"JetBrains Mono", "Fira Code", monospace',
      fontSize: 14,
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon.FitAddon();
    const linksAddon = new WebLinksAddon.WebLinksAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(linksAddon);
    term.open(document.getElementById('terminal'));
    fitAddon.fit();

    let ws;
    let cols = term.cols;
    let rows = term.rows;

    function connect() {
      const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
      ws = new WebSocket(`${proto}//${location.host}/ws/tui`);

      ws.onopen = () => {
        document.getElementById('status-dot').className = 'status-dot connected';
        document.getElementById('status-text').textContent = 'Connected';
      };

      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.type === 'output') term.write(msg.data);
        if (msg.type === 'exit') {
          document.getElementById('status-text').textContent = `Exited (${msg.exitCode})`;
          document.getElementById('status-dot').className = 'status-dot disconnected';
        }
      };

      ws.onclose = () => {
        document.getElementById('status-dot').className = 'status-dot disconnected';
        document.getElementById('status-text').textContent = 'Disconnected';
      };

      // Keyboard input: send to PTY
      term.onData((data) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'input', data }));
        }
      });
    }

    // Terminal resize: notify PTY
    window.addEventListener('resize', () => {
      fitAddon.fit();
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
      }
    });

    function reconnect() {
      if (ws) ws.close();
      term.clear();
      connect();
    }

    connect();
  </script>
</body>
</html>
```

---

## 5. Express Route

```typescript
// ops.carinaai.uk/routes/tui.ts  (new file)

import { Router } from 'express';
const router = Router();

router.get('/', (req, res) => {
  res.render('tui', { title: 'Carina TUI' });
});

export default router;
```

In `server.ts`:
```typescript
import tuiRouter from './routes/tui.js';
app.use('/tui', tuiRouter);
```

---

## 6. CLI Command

```bash
# Start the admin panel with PTY bridge
carina admin            # already exists, just ensure PTY route is included
# Navigate to http://localhost:4000/tui for the browser TUI
```

---

## Files to Create

```
ops.carinaai.uk/src/pty-bridge.ts
ops.carinaai.uk/routes/tui.ts
ops.carinaai.uk/views/tui.ejs
```

## Files to Modify

```
ops.carinaai.uk/server.ts           use createServer + attachPtyBridge
ops.carinaai.uk/package.json        add node-pty, ws, xterm
```

---

## Done When

- [ ] `pnpm admin` starts the server and logs "PTY bridge: ws://localhost:4000/ws/tui"
- [ ] Navigating to http://localhost:4000/tui shows the browser terminal
- [ ] The real Carina TUI appears in the browser (same output as terminal)
- [ ] Keyboard input from browser is sent to the PTY (can type and interact)
- [ ] Terminal resizes when the browser window is resized
- [ ] Status dot goes green on connection and red on disconnect
- [ ] Reconnect button spawns a new PTY session
- [ ] Unauthorized WebSocket connections are rejected with code 4001
- [ ] PTY process is killed when WebSocket closes (no zombie processes)
- [ ] Multiple browser tabs each get their own independent PTY session