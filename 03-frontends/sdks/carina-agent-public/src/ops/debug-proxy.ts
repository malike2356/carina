import fs from 'fs';
import http from 'http';
import path from 'path';
import { URL } from 'url';
import { CARINA_HOME } from '../config/paths.js';
import { debugProxyPort } from './ops-config.js';

const PID_FILE = path.join(CARINA_HOME, 'debug-proxy.pid');
const LOG_FILE = path.join(CARINA_HOME, 'logs', 'debug-proxy.log');

export type DebugProxyOptions = {
  port?: number;
  target: string;
  logFile?: string;
};

export type DebugProxyState = {
  running: boolean;
  port?: number;
  target?: string;
  pid?: number;
  logFile?: string;
};

let activeServer: http.Server | null = null;

function appendLog(logFile: string, line: string): void {
  fs.mkdirSync(path.dirname(logFile), { recursive: true });
  fs.appendFileSync(logFile, `${new Date().toISOString()} ${line}\n`);
}

function readPidFile(): number | null {
  try {
    const raw = fs.readFileSync(PID_FILE, 'utf-8').trim();
    const pid = Number(raw);
    return Number.isFinite(pid) ? pid : null;
  } catch {
    return null;
  }
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function getDebugProxyState(): DebugProxyState {
  const pid = readPidFile();
  if (pid && isProcessAlive(pid)) {
    return {
      running: true,
      pid,
      port: debugProxyPort(),
      logFile: LOG_FILE,
    };
  }
  if (activeServer) {
    return {
      running: true,
      port: debugProxyPort(),
      logFile: LOG_FILE,
    };
  }
  return { running: false };
}

export async function startDebugProxy(options: DebugProxyOptions): Promise<DebugProxyState> {
  const port = options.port ?? debugProxyPort();
  const target = new URL(options.target);
  const logFile = options.logFile ?? LOG_FILE;

  if (activeServer) {
    return { running: true, port, target: target.origin, logFile };
  }

  const server = http.createServer((clientReq, clientRes) => {
    const upstreamPath = clientReq.url ?? '/';
    const upstreamUrl = new URL(upstreamPath, target.origin);
    const headers: Record<string, string | string[] | undefined> = {
      ...clientReq.headers,
      host: target.host,
    };
    delete headers['proxy-connection'];

    appendLog(
      logFile,
      `REQ ${clientReq.method} ${upstreamUrl.href} from=${clientReq.socket.remoteAddress ?? '?'}`,
    );

    const proxyReq = http.request(
      upstreamUrl,
      { method: clientReq.method, headers },
      (upstreamRes) => {
        appendLog(logFile, `RES ${upstreamRes.statusCode} ${upstreamUrl.href}`);
        clientRes.writeHead(upstreamRes.statusCode ?? 502, upstreamRes.headers);
        upstreamRes.pipe(clientRes);
      },
    );

    proxyReq.on('error', (err) => {
      appendLog(logFile, `ERR ${upstreamUrl.href} ${err.message}`);
      clientRes.writeHead(502, { 'content-type': 'application/json' });
      clientRes.end(JSON.stringify({ error: err.message }));
    });

    clientReq.pipe(proxyReq);
  });

  await new Promise<void>((resolve, reject) => {
    server.listen(port, '127.0.0.1', () => resolve());
    server.on('error', reject);
  });

  activeServer = server;
  fs.mkdirSync(CARINA_HOME, { recursive: true });
  fs.writeFileSync(PID_FILE, String(process.pid));
  appendLog(logFile, `START proxy 127.0.0.1:${port} -> ${target.origin}`);

  return { running: true, port, target: target.origin, logFile, pid: process.pid };
}

export async function stopDebugProxy(): Promise<boolean> {
  const pid = readPidFile();
  if (pid && pid !== process.pid && isProcessAlive(pid)) {
    try {
      process.kill(pid, 'SIGTERM');
    } catch {
      // ignore
    }
  }
  if (activeServer) {
    await new Promise<void>((resolve) => {
      activeServer!.close(() => resolve());
    });
    activeServer = null;
  }
  try {
    fs.unlinkSync(PID_FILE);
  } catch {
    // ignore
  }
  return true;
}
