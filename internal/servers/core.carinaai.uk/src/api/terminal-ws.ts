import { randomUUID } from 'node:crypto';
import path from 'node:path';
import type { Server as HttpServer, IncomingMessage } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { getUserByApiKey, verifyJwt } from './hosted-auth.js';
import { createPty } from '../infrastructure/pty.js';

type TerminalMessage =
  | { type: 'input'; data: string }
  | { type: 'resize'; cols: number; rows: number }
  | { type: 'heartbeat' };

function parseMessage(raw: string): TerminalMessage | null {
  try {
    const msg = JSON.parse(raw) as TerminalMessage;
    if (!msg || typeof msg !== 'object' || typeof msg.type !== 'string') return null;
    return msg;
  } catch {
    return null;
  }
}

async function authenticateTerminal(req: IncomingMessage): Promise<boolean> {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const token = url.searchParams.get('token') ?? '';
  if (!token) return false;
  if (verifyJwt(token)) return true;
  const apiUser = await getUserByApiKey(token);
  return apiUser != null;
}

function resolveTerminalCwd(): string {
  const explicit = process.env.CARINA_TERMINAL_WORKDIR?.trim();
  if (explicit) return explicit;
  return process.cwd();
}

export function attachTerminalWebSocket(server: HttpServer): void {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname !== '/api/terminal/ws') return;

    void authenticateTerminal(req).then((ok) => {
      if (!ok) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
      });
    }).catch(() => {
      socket.write('HTTP/1.1 503 Service Unavailable\r\n\r\n');
      socket.destroy();
    });
  });

  wss.on('connection', (ws) => {
    const sessionId = randomUUID();
    const pty = createPty({
      cols: 120,
      rows: 40,
      cwd: resolveTerminalCwd(),
      env: {
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
        FORCE_COLOR: '3',
      },
    });

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
    });

    ws.on('error', () => {
      pty.kill();
    });
  });
}
