# Gap 09 - Prompt 12: ACP IDE Adapter (VS Code / Zed / JetBrains)

> **REUSE RULE:** See `../REUSE-RULES.md`. Implement the behavior below in Carina's own voice. No competitor product names, labels, CLI text, UI copy, or config key names may appear verbatim in shipped code. Rename all user-visible elements to Carina equivalents before committing.


**Agent:** Claude Code
**Estimated hours:** 4-5 hrs
**Depends on:** Core agent API running on a port (HTTP/WebSocket)

---

## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`


## The Problem

Hermes ships an `acp_adapter/` that lets VS Code, Zed, and JetBrains treat Hermes as an
AI coding backend. The Agent Communication Protocol (ACP) is a JSON-RPC over WebSocket
standard that IDE extensions use to talk to external AI agents.

Carina has no IDE integration at all. This means users must switch between their IDE and
the Carina terminal/browser. Integrating Carina directly into VS Code would make it the
first choice for developers, not just property professionals.

This prompt builds an ACP-compatible adapter that exposes Carina's agent capabilities
over a local WebSocket, plus a minimal VS Code extension to consume it.

---

## Read First

```
core.carinaai.uk/src/server.ts                    (main HTTP server)
core.carinaai.uk/src/api/                         (existing API routes)
core.carinaai.uk/src/gateway/session-control.ts   (session management)
core.carinaai.uk/src/agents/carina.ts             (agent invocation)
core.carinaai.uk/package.json                     (add ws dependency)
```

---

## 1. ACP Protocol Types

```typescript
// src/acp/acp-types.ts  (new file)

/** Agent Communication Protocol message types */
export type AcpMethod =
  | 'initialize'
  | 'session.create'
  | 'session.send'
  | 'session.abort'
  | 'session.close'
  | 'tools.list'
  | 'ping';

export interface AcpRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: AcpMethod;
  params?: Record<string, unknown>;
}

export interface AcpResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

export interface AcpNotification {
  jsonrpc: '2.0';
  method: 'session.output' | 'session.complete' | 'session.error';
  params: Record<string, unknown>;
}

export interface AcpCapabilities {
  streaming: boolean;
  multiSession: boolean;
  tools: boolean;
  fileContext: boolean;
  cancelation: boolean;
}
```

---

## 2. ACP WebSocket Handler

```typescript
// src/acp/acp-server.ts  (new file)

import { WebSocketServer, WebSocket } from 'ws';
import type { Server as HttpServer } from 'http';
import type { AcpRequest, AcpResponse, AcpNotification } from './acp-types.js';

const ACP_PORT = Number(process.env.CARINA_ACP_PORT ?? 3334);

// Each IDE connection gets its own session map
interface AcpConnection {
  ws: WebSocket;
  sessions: Map<string, AcpSession>;
}

interface AcpSession {
  id: string;
  agentController: any; // CarinaAgent instance
  abortController: AbortController;
}

function send(ws: WebSocket, msg: AcpResponse | AcpNotification) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function ok(id: string | number, result: unknown): AcpResponse {
  return { jsonrpc: '2.0', id, result };
}

function err(id: string | number, code: number, message: string): AcpResponse {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

export function startAcpServer(): void {
  const wss = new WebSocketServer({ port: ACP_PORT });

  wss.on('connection', (ws) => {
    const conn: AcpConnection = { ws, sessions: new Map() };

    ws.on('message', async (raw) => {
      let req: AcpRequest;
      try {
        req = JSON.parse(raw.toString());
      } catch {
        send(ws, err(0, -32700, 'Parse error'));
        return;
      }

      await handleRequest(conn, req);
    });

    ws.on('close', () => {
      // Clean up all sessions
      for (const session of conn.sessions.values()) {
        session.abortController.abort();
      }
      conn.sessions.clear();
    });
  });

  console.log(`[acp] ACP server listening on ws://localhost:${ACP_PORT}`);
}

async function handleRequest(conn: AcpConnection, req: AcpRequest): Promise<void> {
  const { ws } = conn;

  switch (req.method) {
    case 'initialize': {
      send(ws, ok(req.id, {
        name: 'Carina',
        version: process.env.npm_package_version ?? '1.0.0',
        capabilities: {
          streaming: true,
          multiSession: true,
          tools: true,
          fileContext: true,
          cancelation: true,
        } satisfies import('./acp-types.js').AcpCapabilities,
      }));
      break;
    }

    case 'ping': {
      send(ws, ok(req.id, { pong: true, time: Date.now() }));
      break;
    }

    case 'session.create': {
      const sessionId = crypto.randomUUID();
      const abort = new AbortController();

      // Create a Carina agent session
      const { createAgentSession } = await import('../agents/carina.js');
      const agentController = await createAgentSession({
        sessionId,
        context: req.params?.context as string | undefined,
        workingDirectory: req.params?.workingDirectory as string | undefined,
      });

      conn.sessions.set(sessionId, { id: sessionId, agentController, abortController: abort });
      send(ws, ok(req.id, { sessionId }));
      break;
    }

    case 'session.send': {
      const sessionId = req.params?.sessionId as string;
      const session = conn.sessions.get(sessionId);
      if (!session) { send(ws, err(req.id, -32602, 'Session not found')); return; }

      const prompt = req.params?.prompt as string;
      const fileContext = req.params?.fileContext as string | undefined;

      try {
        // Stream response tokens back as notifications
        await session.agentController.stream(prompt, {
          context: fileContext,
          signal: session.abortController.signal,
          onToken: (token: string) => {
            const notif: AcpNotification = {
              jsonrpc: '2.0',
              method: 'session.output',
              params: { sessionId, token },
            };
            send(ws, notif);
          },
        });

        send(ws, ok(req.id, { done: true }));
        const complete: AcpNotification = {
          jsonrpc: '2.0',
          method: 'session.complete',
          params: { sessionId },
        };
        send(ws, complete);
      } catch (e: any) {
        if (e.name === 'AbortError') {
          send(ws, ok(req.id, { aborted: true }));
        } else {
          send(ws, err(req.id, -32000, String(e.message)));
        }
      }
      break;
    }

    case 'session.abort': {
      const sessionId = req.params?.sessionId as string;
      const session = conn.sessions.get(sessionId);
      if (session) { session.abortController.abort(); }
      send(ws, ok(req.id, { aborted: true }));
      break;
    }

    case 'session.close': {
      const sessionId = req.params?.sessionId as string;
      const session = conn.sessions.get(sessionId);
      if (session) {
        session.abortController.abort();
        conn.sessions.delete(sessionId);
      }
      send(ws, ok(req.id, { closed: true }));
      break;
    }

    case 'tools.list': {
      const { listAvailableTools } = await import('../tools/index.js');
      const tools = await listAvailableTools();
      send(ws, ok(req.id, { tools: tools.map(t => ({ name: t.name, description: t.description })) }));
      break;
    }

    default:
      send(ws, err(req.id, -32601, `Method not found: ${req.method}`));
  }
}
```

---

## 3. Wire Into Main Server

```typescript
// src/server.ts or bin/carina.ts  (add ACP startup)

import { startAcpServer } from './acp/acp-server.js';

// Start ACP alongside the main server
if (process.env.CARINA_ACP !== 'false') {
  startAcpServer();
}
```

---

## 4. VS Code Extension (Minimal)

Create a separate package `carina-vscode/`:

```
carina-vscode/
├── package.json
├── src/
│   └── extension.ts
└── tsconfig.json
```

```typescript
// carina-vscode/src/extension.ts

import * as vscode from 'vscode';
import WebSocket from 'ws';

let ws: WebSocket | null = null;
let sessionId: string | null = null;

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand('carina.connect', connectToCarina),
    vscode.commands.registerCommand('carina.ask', askCarina),
    vscode.commands.registerCommand('carina.explainSelection', explainSelection),
  );
}

async function connectToCarina() {
  const port = vscode.workspace.getConfiguration('carina').get<number>('port') ?? 3334;
  ws = new WebSocket(`ws://localhost:${port}`);

  ws.on('open', async () => {
    // Initialize
    ws!.send(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }));

    // Create a session
    ws!.send(JSON.stringify({
      jsonrpc: '2.0', id: 2, method: 'session.create',
      params: { workingDirectory: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath },
    }));
  });

  ws.on('message', (raw) => {
    const msg = JSON.parse(raw.toString());
    if (msg.method === 'session.output') {
      vscode.window.activeTerminal?.sendText('', false);
      // Stream to output channel
      outputChannel.append(msg.params.token);
    }
    if (msg.id === 2 && msg.result?.sessionId) {
      sessionId = msg.result.sessionId;
      vscode.window.showInformationMessage('Connected to Carina');
    }
  });

  ws.on('close', () => {
    sessionId = null;
    vscode.window.showWarningMessage('Carina disconnected');
  });
}

const outputChannel = vscode.window.createOutputChannel('Carina');

async function askCarina() {
  if (!sessionId) {
    await connectToCarina();
    return;
  }
  const input = await vscode.window.showInputBox({ prompt: 'Ask Carina...' });
  if (!input) return;

  outputChannel.show();
  outputChannel.appendLine(`\nYou: ${input}`);
  outputChannel.appendLine('Carina: ');

  ws!.send(JSON.stringify({
    jsonrpc: '2.0', id: Date.now(), method: 'session.send',
    params: { sessionId, prompt: input },
  }));
}

async function explainSelection() {
  const editor = vscode.window.activeTextEditor;
  if (!editor || !sessionId) return;

  const selection = editor.document.getText(editor.selection);
  if (!selection) return;

  const language = editor.document.languageId;
  const prompt = `Explain this ${language} code:\n\`\`\`${language}\n${selection}\n\`\`\``;

  outputChannel.show();
  outputChannel.appendLine('\nCarina: ');

  ws!.send(JSON.stringify({
    jsonrpc: '2.0', id: Date.now(), method: 'session.send',
    params: { sessionId, prompt },
  }));
}

export function deactivate() {
  ws?.close();
}
```

---

## Files to Create

```
core.carinaai.uk/src/acp/acp-types.ts
core.carinaai.uk/src/acp/acp-server.ts
carina-vscode/                           (new package, sibling of core.carinaai.uk)
carina-vscode/src/extension.ts
carina-vscode/package.json
```

## Files to Modify

```
core.carinaai.uk/src/server.ts    start ACP server alongside main server
core.carinaai.uk/package.json     add ws dependency
```

---

## Done When

- [ ] `carina` starts the ACP server on port 3334 alongside the main server
- [ ] ACP `initialize` request returns Carina name, version, and capabilities
- [ ] ACP `session.create` returns a sessionId
- [ ] ACP `session.send` streams tokens back as `session.output` notifications
- [ ] ACP `session.abort` stops a running generation
- [ ] VS Code extension connects to the ACP server when "Carina: Connect" is run
- [ ] "Carina: Ask" opens an input box and streams the response to the output channel
- [ ] "Carina: Explain Selection" sends selected code to Carina and shows the explanation
- [ ] `CARINA_ACP=false` env var disables the ACP server
- [ ] `CARINA_ACP_PORT` env var changes the port
- [ ] Unit test: handleRequest for unknown method returns -32601 error