import crypto from 'crypto';
import { WebSocketServer, WebSocket } from 'ws';
import type { AcpRequest, AcpResponse, AcpNotification, AcpCapabilities } from './acp-types.js';
import { getRouter } from '../gateway/router.js';
import { registry } from '../tools/registry.js';
import { createAcpSession, deleteAcpSession, touchAcpSession } from '../infrastructure/acp-bridge/store.js';

const DEFAULT_ACP_PORT = 3334;

export function acpServerPort(): number {
  const raw = process.env.CARINA_ACP_PORT ?? String(DEFAULT_ACP_PORT);
  const port = Number(raw);
  return Number.isFinite(port) && port > 0 ? port : DEFAULT_ACP_PORT;
}

export function acpServerEnabled(): boolean {
  return process.env.CARINA_ACP !== 'false';
}

export interface AcpSessionState {
  id: string;
  abortController: AbortController;
  workingDirectory?: string;
  context?: string;
  generating: boolean;
}

export interface AcpConnection {
  ws: Pick<WebSocket, 'readyState' | 'send'>;
  sessions: Map<string, AcpSessionState>;
}

let activeServer: WebSocketServer | null = null;

function send(ws: AcpConnection['ws'], msg: AcpResponse | AcpNotification): void {
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

function agentVersion(): string {
  return process.env.CARINA_VERSION?.trim()
    || process.env.npm_package_version
    || '0.2.0';
}

function buildPrompt(prompt: string, fileContext?: string, context?: string): string {
  const parts: string[] = [];
  if (context?.trim()) {
    parts.push(`Context:\n${context.trim()}`);
  }
  if (fileContext?.trim()) {
    parts.push(`File context:\n${fileContext.trim()}`);
  }
  parts.push(prompt);
  return parts.join('\n\n');
}

export async function handleAcpRequest(conn: AcpConnection, req: AcpRequest): Promise<void> {
  const { ws } = conn;

  switch (req.method) {
    case 'initialize': {
      const capabilities: AcpCapabilities = {
        streaming: true,
        multiSession: true,
        tools: true,
        fileContext: true,
        cancelation: true,
      };
      send(ws, ok(req.id, {
        name: 'Carina',
        version: agentVersion(),
        capabilities,
      }));
      break;
    }

    case 'ping': {
      send(ws, ok(req.id, { pong: true, time: Date.now() }));
      break;
    }

    case 'session.create': {
      const sessionId = crypto.randomUUID();
      const workingDirectory = req.params?.workingDirectory as string | undefined;
      const context = req.params?.context as string | undefined;

      createAcpSession({
        sessionId,
        label: workingDirectory ?? context,
        provenance: 'acp-ide',
      });

      conn.sessions.set(sessionId, {
        id: sessionId,
        abortController: new AbortController(),
        workingDirectory,
        context,
        generating: false,
      });
      send(ws, ok(req.id, { sessionId }));
      break;
    }

    case 'session.send': {
      const sessionId = String(req.params?.sessionId ?? '');
      const session = conn.sessions.get(sessionId);
      if (!session) {
        send(ws, err(req.id, -32602, 'Session not found'));
        return;
      }

      const prompt = String(req.params?.prompt ?? '').trim();
      if (!prompt) {
        send(ws, err(req.id, -32602, 'prompt is required'));
        return;
      }

      const fileContext = req.params?.fileContext as string | undefined;
      const fullPrompt = buildPrompt(prompt, fileContext, session.context);
      touchAcpSession(sessionId);

      if (session.generating) {
        getRouter().abortSessionTurn(sessionId);
        session.abortController.abort();
      }
      session.abortController = new AbortController();
      session.generating = true;

      try {
        const router = getRouter();
        for await (const chunk of router.handleInbound('web', {
          id: String(Date.now()),
          sessionId,
          message: fullPrompt,
        })) {
          if (session.abortController.signal.aborted) {
            send(ws, ok(req.id, { aborted: true }));
            return;
          }
          const notif: AcpNotification = {
            jsonrpc: '2.0',
            method: 'session.output',
            params: { sessionId, token: chunk },
          };
          send(ws, notif);
        }

        send(ws, ok(req.id, { done: true }));
        const complete: AcpNotification = {
          jsonrpc: '2.0',
          method: 'session.complete',
          params: { sessionId },
        };
        send(ws, complete);
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        if (session.abortController.signal.aborted) {
          send(ws, ok(req.id, { aborted: true }));
        } else {
          send(ws, err(req.id, -32000, message));
        }
      } finally {
        session.generating = false;
      }
      break;
    }

    case 'session.abort': {
      const sessionId = String(req.params?.sessionId ?? '');
      const session = conn.sessions.get(sessionId);
      if (session) {
        session.abortController.abort();
        getRouter().abortSessionTurn(sessionId);
        session.generating = false;
      }
      send(ws, ok(req.id, { aborted: true }));
      break;
    }

    case 'session.close': {
      const sessionId = String(req.params?.sessionId ?? '');
      const session = conn.sessions.get(sessionId);
      if (session) {
        session.abortController.abort();
        getRouter().abortSessionTurn(sessionId);
        await getRouter().clearSession(sessionId).catch(() => undefined);
        deleteAcpSession(sessionId);
        conn.sessions.delete(sessionId);
      }
      send(ws, ok(req.id, { closed: true }));
      break;
    }

    case 'tools.list': {
      const tools = registry.list().map((t) => ({
        name: t.name,
        description: t.description,
      }));
      send(ws, ok(req.id, { tools }));
      break;
    }

    default:
      send(ws, err(req.id, -32601, `Method not found: ${req.method}`));
  }
}

export function startAcpServer(): void {
  if (!acpServerEnabled()) return;
  if (activeServer) return;

  const port = acpServerPort();
  const wss = new WebSocketServer({ host: '127.0.0.1', port });

  wss.on('connection', (ws) => {
    const conn: AcpConnection = { ws, sessions: new Map() };

    ws.on('message', (raw) => {
      void (async () => {
        let req: AcpRequest;
        try {
          req = JSON.parse(raw.toString()) as AcpRequest;
        } catch {
          send(ws, err(0, -32700, 'Parse error'));
          return;
        }

        if (!req || req.jsonrpc !== '2.0' || !('method' in req)) {
          send(ws, err(req?.id ?? 0, -32600, 'Invalid Request'));
          return;
        }

        await handleAcpRequest(conn, req);
      })();
    });

    ws.on('close', () => {
      for (const session of conn.sessions.values()) {
        session.abortController.abort();
        getRouter().abortSessionTurn(session.id);
      }
      conn.sessions.clear();
    });
  });

  wss.on('error', (error) => {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'EADDRINUSE') {
      console.warn(`[acp] port ${port} already in use; ACP WebSocket server not started`);
      activeServer = null;
      return;
    }
    console.error('[acp] server error:', error);
  });

  activeServer = wss;
  console.log(`[acp] ACP server listening on ws://127.0.0.1:${port}`);
}

export function stopAcpServer(): void {
  if (!activeServer) return;
  activeServer.close();
  activeServer = null;
}
