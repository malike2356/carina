/**
 * Reverse proxy in front of dist/server.js.
 * Production nginx (Hestia) proxies ops.carinaai.uk to 127.0.0.1:4002.
 * The app itself listens on OPS_BACKEND_PORT (default 4001).
 */
import http from 'http';

const bridgePort = Number(process.env.OPS_BRIDGE_PORT ?? process.env.PORT ?? 4002);
const backendPort = Number(process.env.OPS_BACKEND_PORT ?? 4001);
const backendHost = process.env.OPS_BACKEND_HOST ?? '127.0.0.1';

const server = http.createServer((req, res) => {
  const upstream = http.request(
    {
      host: backendHost,
      port: backendPort,
      path: req.url,
      method: req.method,
      headers: req.headers,
    },
    (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode ?? 502, upstreamRes.headers);
      upstreamRes.pipe(res);
    },
  );

  upstream.on('error', (err) => {
    res.statusCode = 502;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end(`Ops backend unavailable (${backendHost}:${backendPort}): ${err.message}\n`);
  });

  req.pipe(upstream);
});

server.listen(bridgePort, '127.0.0.1', () => {
  console.log(`Ops bridge listening on 127.0.0.1:${bridgePort} -> ${backendHost}:${backendPort}`);
});
