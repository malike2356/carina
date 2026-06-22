import { createServer, request as httpRequest } from 'node:http';
import { spawn, execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const deployDir = process.env.CARINA_DEPLOY_DIR?.trim() || __dirname;
const internalPort = Number(process.env.NEXT_INTERNAL_PORT || 4102);
const publicPort = Number(process.env.PORT || 4100);
const internalHost = process.env.NEXT_INTERNAL_HOST || '127.0.0.1';

function freePort(port) {
  try {
    execSync(`fuser -k ${port}/tcp`, { stdio: 'ignore' });
  } catch {
    // Port was already free or fuser unavailable.
  }
}

function resolveCoreTerminalWsUrl(search) {
  // PTY bridge lives in the ops container, not the core.
  // Prefer CARINA_OPS_PTY_URL if explicitly configured (e.g. wss://ops.carinaai.uk/ws/tui).
  const opsPtyRaw = process.env.CARINA_OPS_PTY_URL?.trim();
  if (opsPtyRaw) {
    try {
      const url = new URL(opsPtyRaw);
      if (url.protocol === 'http:') url.protocol = 'ws:';
      else if (url.protocol === 'https:') url.protocol = 'wss:';
      // Append original query string (token=...) to the ops PTY URL
      return `${url.toString()}${search}`;
    } catch {
      // fall through to constructed default
    }
  }

  // Construct default ops PTY bridge URL.
  // Docker-internal: carina-ops:4001.  Public: ops.carinaai.uk (HTTPS).
  const opsHost = process.env.CARINA_OPS_HOST?.trim()
    || (process.env.CARINA_OPS_IN_DOCKER === 'true' ? 'carina-ops:4001' : 'ops.carinaai.uk');
  const secure = process.env.NODE_ENV === 'production'
    && !opsHost.startsWith('localhost')
    && !opsHost.startsWith('127.0.0.1')
    && !opsHost.includes(':');
  const wsProto = secure ? 'wss' : 'ws';
  return `${wsProto}://${opsHost}/ws/tui${search}`;
}

function waitForNextReady(maxMs = 60_000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = httpRequest(
        { hostname: internalHost, port: internalPort, path: '/', method: 'GET', timeout: 2000 },
        (res) => {
          res.resume();
          resolve(undefined);
        },
      );
      req.on('error', () => {
        if (Date.now() - started > maxMs) {
          reject(new Error(`Next internal server did not start on ${internalHost}:${internalPort}`));
          return;
        }
        setTimeout(tick, 500);
      });
      req.on('timeout', () => {
        req.destroy();
        if (Date.now() - started > maxMs) {
          reject(new Error(`Next internal server timed out on ${internalHost}:${internalPort}`));
          return;
        }
        setTimeout(tick, 500);
      });
      req.end();
    };
    tick();
  });
}

function proxyHttp(req, res) {
  const headers = { ...req.headers, host: `${internalHost}:${internalPort}` };
  if (!headers['x-forwarded-host'] && req.headers.host) {
    headers['x-forwarded-host'] = req.headers.host;
  }
  if (!headers['x-forwarded-proto']) {
    headers['x-forwarded-proto'] = 'https';
  }
  const upstream = httpRequest(
    {
      hostname: internalHost,
      port: internalPort,
      path: req.url,
      method: req.method,
      headers,
    },
    (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode ?? 502, upstreamRes.headers);
      upstreamRes.pipe(res);
    },
  );
  upstream.on('error', () => {
    if (!res.headersSent) res.writeHead(502, { 'content-type': 'text/plain' });
    res.end('Bad gateway');
  });
  req.pipe(upstream);
}

function wireRelay(client, upstream) {
  client.on('message', (data, isBinary) => {
    if (upstream.readyState === WebSocket.OPEN) upstream.send(data, { binary: isBinary });
  });
  upstream.on('message', (data, isBinary) => {
    if (client.readyState === WebSocket.OPEN) client.send(data, { binary: isBinary });
  });
  client.on('close', (code, reason) => upstream.close(code, reason));
  upstream.on('close', (code, reason) => client.close(code, reason));
  client.on('error', () => upstream.close(1011, 'Client error'));
  upstream.on('error', () => client.close(1011, 'Upstream error'));
}

freePort(publicPort);
freePort(internalPort);

const child = spawn(process.execPath, [path.join(deployDir, 'server.js')], {
  cwd: deployDir,
  env: { ...process.env, PORT: String(internalPort), HOSTNAME: internalHost },
  stdio: 'inherit',
});

function shutdownChild() {
  if (!child.killed) child.kill('SIGTERM');
}

process.on('SIGTERM', () => {
  shutdownChild();
  process.exit(0);
});
process.on('SIGINT', () => {
  shutdownChild();
  process.exit(0);
});

child.on('exit', (code, signal) => {
  console.error(`Next server exited (code=${code ?? 'null'}, signal=${signal ?? 'null'})`);
  process.exit(code ?? 1);
});

await waitForNextReady();

const wss = new WebSocketServer({ noServer: true });
const server = createServer(proxyHttp);

server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url || '/', 'http://internal');
  if (url.pathname !== '/api/terminal/ws') {
    socket.destroy();
    return;
  }

  wss.handleUpgrade(req, socket, head, (clientWs) => {
    const upstream = new WebSocket(resolveCoreTerminalWsUrl(url.search));
    upstream.on('open', () => wireRelay(clientWs, upstream));
    upstream.on('error', () => clientWs.close(1011, 'Upstream failed'));
    clientWs.on('close', () => upstream.close());
  });
});

server.listen(publicPort, process.env.HOSTNAME || '127.0.0.1', () => {
  console.log(`Carina cloud front proxy on ${publicPort}; Next internal ${internalHost}:${internalPort}`);
});
