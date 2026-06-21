import { createHmac, randomUUID } from 'node:crypto';
import type { Server as HttpServer, IncomingMessage } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { getUserByApiKey, verifyJwt } from './hosted-auth.js';
import { createPty } from '../infrastructure/pty.js';
import { appendSecurityAudit } from '../security/security-audit.js';

type TerminalMessage =
  | { type: 'input'; data: string }
  | { type: 'resize'; cols: number; rows: number }
  | { type: 'heartbeat' };

type TerminalAuth =
  | { kind: 'session'; userId: string; email?: string }
  | { kind: 'bridge'; userId: string; email: string; workspaceId: string | null }

function resolveBridgeSecret(): string {
  return (
    process.env.CARINA_TERMINAL_BRIDGE_SECRET?.trim() ||
    process.env.CARINA_INTERNAL_KEY?.trim() ||
    process.env.CARINA_OPS_TOKEN?.trim() ||
    ''
  );
}

export function verifyTerminalBridgeToken(token: string): TerminalAuth | null {
  const secret = resolveBridgeSecret();
  if (!secret) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, signature] = parts;
  const expected = createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  if (signature !== expected) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as {
      userId?: string;
      email?: string;
      workspaceId?: string | null;
      exp?: number;
      kind?: string;
    };
    if (!payload.userId || !payload.email) return null;
    if (typeof payload.exp !== 'number' || payload.exp < Date.now()) return null;
    if (payload.kind !== 'terminal-bridge') return null;
    return {
      kind: 'bridge',
      userId: payload.userId,
      email: payload.email,
      workspaceId: payload.workspaceId ?? null,
    };
  } catch {
    return null;
  }
}

function parseMessage(raw: string): TerminalMessage | null {
  try {
    const msg = JSON.parse(raw) as TerminalMessage;
    if (!msg || typeof msg !== 'object' || typeof msg.type !== 'string') return null;
    return msg;
  } catch {
    return null;
  }
}

async function authenticateTerminal(req: IncomingMessage): Promise<TerminalAuth | null> {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const token = url.searchParams.get('token') ?? '';
  if (!token) return null;
  const bridge = verifyTerminalBridgeToken(token);
  if (bridge) return bridge;

  const jwt = verifyJwt(token);
  if (jwt) {
    return {
      kind: 'session',
      userId: jwt.userId,
      email: jwt.email,
    };
  }

  const apiUser = await getUserByApiKey(token);
  if (apiUser) {
    return {
      kind: 'session',
      userId: apiUser.id,
      email: apiUser.email,
    };
  }
  return null;
}

function resolveTerminalCwd(): string {
  const explicit = process.env.CARINA_TERMINAL_WORKDIR?.trim();
  if (explicit) return explicit;
  return process.cwd();
}

export function attachTerminalWebSocket(server: HttpServer): void {
  const wss = new WebSocketServer({ noServer: true });
  const authBySocket = new WeakMap<WebSocket, TerminalAuth>();

  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname !== '/api/terminal/ws') return;

    void authenticateTerminal(req).then((auth) => {
      if (!auth) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }
      wss.handleUpgrade(req, socket, head, (ws) => {
        authBySocket.set(ws, auth);
        wss.emit('connection', ws, req);
      });
    }).catch(() => {
      socket.write('HTTP/1.1 503 Service Unavailable\r\n\r\n');
      socket.destroy();
    });
  });

  wss.on('connection', (ws, req) => {
    const auth = authBySocket.get(ws);
    if (!auth) {
      ws.close();
      return;
    }
    const sessionId = randomUUID();
    const cwd = resolveTerminalCwd();
    const pty = createPty({
      cols: 120,
      rows: 40,
      cwd,
      env: {
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
        FORCE_COLOR: '3',
      },
    });
    let audited = false;

    const appendAudit = (action: string): void => {
      if (audited && action === 'pty.close') return;
      if (action === 'pty.close') audited = true;
      appendSecurityAudit({
        category: 'tool_policy',
        action,
        detail: `terminal ${sessionId}`,
        sessionId,
        toolName: 'pty',
        metadata: {
          cwd,
          userId: auth.userId,
          email: auth.email,
          workspaceId: auth.kind === 'bridge' ? auth.workspaceId : null,
          remoteAddress: req.socket.remoteAddress ?? null,
        },
      });
    };

    appendAudit('pty.open');

    ws.send(JSON.stringify({
      type: 'connected',
      sessionId,
      cols: 120,
      rows: 40,
    }));

    pty.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'output', data }));
      }
    });

    pty.onExit(({ exitCode }) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'exit', exitCode }));
        ws.close();
      }
    });

    ws.on('message', (raw) => {
      const msg = parseMessage(raw.toString());
      if (!msg) return;
      if (msg.type === 'input') {
        pty.write(msg.data);
      } else if (msg.type === 'resize') {
        pty.resize(Math.max(2, Math.floor(msg.cols)), Math.max(2, Math.floor(msg.rows)));
      }
    });

    ws.on('close', () => {
      pty.kill();
      appendAudit('pty.close');
    });

    ws.on('error', () => {
      pty.kill();
      appendAudit('pty.close');
    });
  });
}
