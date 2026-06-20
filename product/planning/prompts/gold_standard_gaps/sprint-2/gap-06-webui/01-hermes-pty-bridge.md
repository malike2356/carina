# Web UI Upgrade 01; Hermes PTY Bridge

> **REUSE RULE:** See `../REUSE-RULES.md`. File name references the behavioral source only. All implementation must use Carina's own voice, naming, CLI output, and UI copy. No competitor brand names in any shipped file.


**Source:** Hermes Agent (`web/src/pages/ChatPage.tsx`, `hermes_cli/pty_bridge.py`)
**Status:** Partial in Carina
**Effort:** 2 weeks

---

## SPECIFICATION

### What This Is

Hermes embeds the REAL terminal UI (`hermes --tui`) inside the web dashboard via a pseudo-terminal (PTY) bridge. The chat experience is written ONCE in Ink (React for terminal) and used everywhere; CLI, TUI, and web dashboard. No reimplementation.

Carina should adopt this pattern: embed the existing TUI (`src/tui/app.ts`) into the web dashboard via a WebSocket PTY bridge.

Carina note: the web workspace now ships a terminal page in `app.carinaai.uk/src/app/(workspace)/terminal/page.tsx` backed by `src/lib/terminal-session.ts`. Keep future terminal work aligned with that surface instead of introducing a second terminal stack.

### Architecture

```
Browser                          Server
  │                                │
  ├── xterm.js Terminal ──WS──→   /api/pty (WebSocket endpoint)
  │   (WebGL renderer)            │
  │   (@xterm/addon-fit)          ├── spawn: node dist/tui/index.js
  │   (@xterm/addon-unicode11)    │   via ptyprocess (POSIX PTY)
  │                                │
  │   Raw PTY bytes ◀──────────→  │   Raw PTY bytes
  │                                │
  │   Resize: ESC[RESIZE:80;24] → │   TIOCSWINSZ applied
```

### What Already Exists in Carina (REUSE)

```
Done:  src/tui/app.ts (13KB); full TUI application
Done:  src/tui/terminal.ts (2.1KB); terminal handling
Done:  src/tui/index.ts (7.9KB); TUI entry point
Done:  src/tui/data-provider.ts (3.2KB); data layer
Done:  src/infrastructure/pty.ts; PTY infrastructure EXISTS
Done:  packages/web/web-server.ts (51KB); web server (add WS endpoint here)
```

### What to Build

#### 1. WebSocket PTY Endpoint (Server)

Add to `packages/web/web-server.ts`:

```typescript
// New endpoint: /api/pty
// Upgrades HTTP to WebSocket
// Spawns TUI process via pty
// Forwards PTY bytes bidirectionally

app.ws('/api/pty', (ws, req) => {
  // Auth: same ephemeral _SESSION_TOKEN as REST
  const token = new URL(req.url, 'http://x').searchParams.get('token');
  if (!validateSessionToken(token)) {
    ws.close(4001, 'Unauthorized');
    return;
  }

  // Spawn TUI process
  const pty = spawn('node', ['dist/tui/index.js'], {
    env: { ...process.env, TERM: 'xterm-256color', CARINA_TUI_PTY: '1' },
    pty: true,
  });

  // Forward browser → PTY
  ws.on('message', (data) => {
    // Handle resize escape sequences
    if (data.toString().startsWith('\x1b[RESIZE:')) {
      const [cols, rows] = parseResize(data.toString());
      pty.resize(cols, rows);
      return;
    }
    pty.stdin.write(data);
  });

  // Forward PTY → browser
  pty.stdout.on('data', (data) => {
    ws.send(data);
  });

  // Cleanup
  ws.on('close', () => pty.kill());
  pty.on('exit', () => ws.close());
});
```

**Study reference:** `hermes-agent/hermes_cli/pty_bridge.py` + `hermes-agent/hermes_cli/web_server.py` (the `/api/pty` endpoint).

#### 2. Web Chat Page with xterm.js (Client)

Create `app.carinaai.uk/src/app/(workspace)/terminal/page.tsx`:

```tsx
'use client';

import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { WebglAddon } from '@xterm/addon-webgl';
import '@xterm/xterm/css/xterm.css';

export default function TerminalPage() {
  const terminalRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket>();

  useEffect(() => {
    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Fira Code, monospace',
      theme: {
        background: '#0d1117',
        foreground: '#c9d1d9',
      },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(new Unicode11Addon());

    // Try WebGL, fall back to canvas
    try {
      term.loadAddon(new WebglAddon());
    } catch {
      console.warn('WebGL not available, using canvas renderer');
    }

    term.open(terminalRef.current!);
    fitAddon.fit();

    // Connect to PTY
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${location.host}/api/pty?token=${getSessionToken()}`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      if (event.data instanceof Blob) {
        event.data.arrayBuffer().then(buf => term.write(new Uint8Array(buf)));
      } else {
        term.write(event.data);
      }
    };

    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });

    // Resize handling
    const handleResize = () => fitAddon.fit();
    window.addEventListener('resize', handleResize);
    fitAddon.fit();

    // Send initial size
    const { cols, rows } = term;
    ws.onopen = () => {
      ws.send(`\x1b[RESIZE:${cols};${rows}]`);
      // Resize on terminal resize
      term.onResize(({ cols, rows }) => {
        ws.send(`\x1b[RESIZE:${cols};${rows}]`);
      });
    };

    return () => {
      window.removeEventListener('resize', handleResize);
      ws.close();
      term.dispose();
    };
  }, []);

  return (
    <div className="h-full w-full bg-[#0d1117]">
      <div ref={terminalRef} className="h-full w-full" />
    </div>
  );
}
```

**Dependencies to add:**
```json
{
  "@xterm/xterm": "^5.x",
  "@xterm/addon-fit": "^0.x",
  "@xterm/addon-unicode11": "^0.x",
  "@xterm/addon-webgl": "^0.x"
}
```

**Study reference:** `hermes-agent/web/src/pages/ChatPage.tsx` (the original xterm.js implementation).

#### 3. Navigation Integration

Add "Terminal" to the workspace sidebar (`app/shell/AppSidebar.tsx`):

```tsx
// Add to sidebar navigation items
{
  icon: <TerminalIcon />,
  label: 'Terminal',
  href: '/terminal',
  shortcut: 'Ctrl+`',
}
```

#### 4. Feature Toggle

Add a config flag to enable/disable the PTY bridge (some deployments may not support PTY):

```typescript
// In config: features.terminalPtyBridge: boolean (default: true)
// In web-server.ts: check flag before registering /api/pty endpoint
```

### Edge Cases

```
- PTY unavailable (Windows): Show "Terminal not available on this platform" message
- WebSocket disconnect: Show reconnecting overlay, auto-retry
- Session token expiry: Redirect to login
- Multiple tabs: Each gets own PTY (separate TUI process per tab)
- Process crash: Auto-restart TUI process, reconnect WebSocket
- Unsupported browser: Fallback to "Launch desktop app" prompt
```

---

## IMPLEMENTATION PHASES

### Week 1; Server
```
- Add ws WebSocket support to web-server.ts (if not present)
- Implement /api/pty endpoint with session token auth
- Implement PTY spawn using existing infrastructure/pty.ts
- Implement resize handling (TIOCSWINSZ)
- Test: connect with wscat, verify TUI appears
```

### Week 2; Client
```
- Install xterm.js dependencies
- Create terminal page component
- Implement WebSocket client with auto-reconnect
- Add WebGL renderer with canvas fallback
- Add resize handling (FitAddon + window resize)
- Add sidebar navigation entry
- Add feature toggle
- Test: full TUI experience in browser
```

---

## REFERENCE FILES

```
Hermes:
  hermes-agent/hermes_cli/pty_bridge.py; PTY server bridge
  hermes-agent/hermes_cli/web_server.py; /api/pty WS endpoint
  hermes-agent/web/src/pages/ChatPage.tsx; xterm.js client

Carina (reuse):
  src/infrastructure/pty.ts; PTY infrastructure
  src/tui/app.ts; TUI application
  src/tui/index.ts; TUI entry
  packages/web/web-server.ts; add WS endpoint here
```
