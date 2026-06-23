# Prompt 01: PTY Terminal Bridge in Web UI


## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`

## Context

Operators need to run shell commands from the Carina web interface without switching to a
separate terminal. The web UI at `app.carinaai.uk` already handles chat and tool output.
A PTY bridge adds a real terminal panel backed by a WebSocket connection to a server-side
pseudo-terminal process.

## What to Build

### 1. Server side: PTY WebSocket handler

In `core.carinaai.uk/src/gateway/pty-handler.ts`:

```typescript
import { spawn } from 'node-pty';
import type { WebSocket } from 'ws';

export function handlePtySession(ws: WebSocket, cols = 80, rows = 24): void {
  const pty = spawn('/bin/bash', [], {
    name: 'xterm-256color',
    cols,
    rows,
    cwd: process.env.HOME ?? '/app',
    env: process.env as Record<string, string>,
  });

  pty.onData((data) => ws.send(JSON.stringify({ type: 'pty.data', data })));
  pty.onExit(({ exitCode }) =>
    ws.send(JSON.stringify({ type: 'pty.exit', exitCode })));

  ws.on('message', (raw) => {
    const msg = JSON.parse(raw.toString());
    if (msg.type === 'pty.input') pty.write(msg.data);
    if (msg.type === 'pty.resize') pty.resize(msg.cols, msg.rows);
  });

  ws.on('close', () => pty.kill());
}
```

Mount this on the existing WebSocket server at path `/pty`:
```typescript
wss.handleUpgrade(req, socket, head, (ws) => {
  if (req.url?.startsWith('/pty')) {
    handlePtySession(ws);
    return;
  }
  // ... existing handlers
});
```

Add `node-pty` to dependencies:
```bash
pnpm add node-pty
pnpm add -D @types/node-pty
```

### 2. Client side: Terminal panel component

In `apps/cloud/src/components/Terminal.tsx` using `xterm.js`:

```tsx
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { useEffect, useRef } from 'react';

export function TerminalPanel({ wsUrl }: { wsUrl: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);

  useEffect(() => {
    const term = new Terminal({ theme: { background: '#06090f' } });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(containerRef.current!);
    fit.fit();
    termRef.current = term;

    const ws = new WebSocket(wsUrl);
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'pty.data') term.write(msg.data);
    };
    term.onData((data) => {
      ws.send(JSON.stringify({ type: 'pty.input', data }));
    });

    const observer = new ResizeObserver(() => {
      fit.fit();
      ws.send(JSON.stringify({ type: 'pty.resize', cols: term.cols, rows: term.rows }));
    });
    observer.observe(containerRef.current!);

    return () => { ws.close(); term.dispose(); observer.disconnect(); };
  }, [wsUrl]);

  return <div ref={containerRef} className="h-full w-full" />;
}
```

Add xterm.js:
```bash
pnpm add @xterm/xterm @xterm/addon-fit
```

### 3. Add terminal tab to workspace

In the workspace sidebar, add a "Terminal" entry that opens the TerminalPanel in a
resizable drawer at the bottom of the screen. The panel should be toggleable with Ctrl+\`.

### 4. Security

- PTY sessions require the same session auth as the rest of the web UI.
- Restrict to the container's filesystem: set `cwd` to `/app` not `/`.
- Log all PTY sessions to Scout: emit `{ tool: 'pty', session: id }` on open.
- Scout Govern tier can disable PTY access org-wide via a policy flag.

## Verification Checklist

- [ ] Open terminal panel, type `ls -la`, see output rendered with colors
- [ ] Resize browser window - terminal reflows to new size
- [ ] Ctrl+C kills running command in terminal
- [ ] Closing the panel terminates the PTY process on the server (no zombie bash)
- [ ] Scout log shows PTY session open/close events

## Files to Create or Modify

- CREATE `src/gateway/pty-handler.ts`
- MODIFY `src/gateway/ws-server.ts` - mount `/pty` handler
- CREATE `apps/cloud/src/components/Terminal.tsx`
- MODIFY `apps/cloud/src/pages/WorkspacePage.tsx` - add terminal drawer
- MODIFY `package.json` - add node-pty, @xterm/xterm, @xterm/addon-fit
