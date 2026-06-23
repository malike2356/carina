import { randomUUID } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import type { Server as HttpServer } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import {
  isWsAuthorized,
  resolveCarinaSpawnCommand,
  validateWsAuthToken,
} from './pty-bridge-core.js';

interface PTYSession {
  ptyProcess: { onData: (cb: (data: string) => void) => void; onExit: (cb: (e: { exitCode: number }) => void) => void; write: (data: string) => void; resize: (cols: number, rows: number) => void; kill: () => void };
  ws: WebSocket;
  cols: number;
  rows: number;
}

const sessions = new Map<string, PTYSession>();

export { resolveCarinaSpawnCommand, isWsAuthorized, validateWsAuthToken } from './pty-bridge-core.js';

function resolvePtyUserHome(): string {
  const fromEnv = process.env.HOME?.trim();
  if (fromEnv) return fromEnv;
  try {
    const fromOs = os.homedir();
    if (fromOs && fromOs !== '/tmp') return fromOs;
  } catch {
    // fall through
  }
  return '/tmp';
}

function resolvePtyCarinaHome(): string {
  if (process.env.CARINA_HOME?.trim()) {
    return path.resolve(process.env.CARINA_HOME.trim());
  }
  return path.join(resolvePtyUserHome(), '.carina');
}

export function getActivePtySessionCount(): number {
  return sessions.size;
}

export function attachPtyBridge(server: HttpServer): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname !== '/ws/tui') {
      socket.destroy();
      return;
    }

    if (!isWsAuthorized(req)) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  });

  wss.on('connection', (ws, req) => {
    void handlePtyConnection(ws, req);
  });

  return wss;
}

async function handlePtyConnection(ws: WebSocket, req: import('node:http').IncomingMessage): Promise<void> {
  if (!validateWsAuthToken(req)) {
    ws.close(4001, 'Unauthorized');
    return;
  }

  const sessionId = randomUUID();
  const fallbackCols = 80;
  const fallbackRows = 24;

  let spawnCmd;
  try {
    spawnCmd = resolveCarinaSpawnCommand();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    ws.send(JSON.stringify({ type: 'output', data: `\r\n[pty-bridge] ${msg}\r\n` }));
    ws.close(1011, 'Carina CLI unavailable');
    return;
  }

  let pty: typeof import('node-pty');
  try {
    pty = await import('node-pty');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    ws.send(JSON.stringify({ type: 'output', data: `\r\n[pty-bridge] node-pty unavailable: ${msg}\r\n` }));
    ws.close(1011, 'PTY unavailable');
    return;
  }

  const ptyHome = resolvePtyUserHome();
  const carinaHome = resolvePtyCarinaHome();
  let ptyProcess: PTYSession['ptyProcess'] | null = null;
  let spawned = false;
  const pendingInput: string[] = [];
  let fallbackTimer: ReturnType<typeof setTimeout>;

  const spawnAtSize = (cols: number, rows: number) => {
    if (spawned) return;
    spawned = true;
    clearTimeout(fallbackTimer);

    ptyProcess = pty.spawn(spawnCmd.file, spawnCmd.args, {
      name: 'xterm-256color',
      cols,
      rows,
      cwd: spawnCmd.cwd,
      env: {
        ...process.env,
        HOME: ptyHome,
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
        FORCE_COLOR: '3',
        CARINA_HOME: carinaHome,
        CARINA_OPS_PTY: '1',
        CARINA_TUI_SIMPLE: 'true',
        DOTENV_CONFIG_QUIET: 'true',
      } as Record<string, string>,
    });

    sessions.set(sessionId, { ptyProcess, ws, cols, rows });

    ptyProcess.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'output', data }));
      }
    });

    ptyProcess.onExit(({ exitCode }) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'exit', exitCode }));
        ws.close();
      }
      sessions.delete(sessionId);
    });

    for (const data of pendingInput) {
      ptyProcess.write(data);
    }
    pendingInput.length = 0;

    ws.send(JSON.stringify({ type: 'connected', sessionId, cols, rows }));
  };

  fallbackTimer = setTimeout(() => {
    spawnAtSize(fallbackCols, fallbackRows);
  }, 3000);

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString()) as { type?: string; data?: string; cols?: number; rows?: number };
      if (msg.type === 'input' && typeof msg.data === 'string') {
        if (ptyProcess) {
          ptyProcess.write(msg.data);
        } else {
          pendingInput.push(msg.data);
        }
      } else if (msg.type === 'resize' && typeof msg.cols === 'number' && typeof msg.rows === 'number') {
        const nextCols = Math.max(2, Math.floor(msg.cols));
        const nextRows = Math.max(2, Math.floor(msg.rows));
        if (!spawned) {
          spawnAtSize(nextCols, nextRows);
          return;
        }
        ptyProcess?.resize(nextCols, nextRows);
        const session = sessions.get(sessionId);
        if (session) {
          session.cols = nextCols;
          session.rows = nextRows;
        }
      }
    } catch {
      // ignore malformed messages
    }
  });

  ws.on('close', () => {
    clearTimeout(fallbackTimer);
    ptyProcess?.kill();
    sessions.delete(sessionId);
  });
}
