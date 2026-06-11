import http from 'node:http';
import type { McpServerState } from './handlers.js';
import { handleMcpRequest, type JsonRpcRequest, type JsonRpcResponse } from './handlers.js';
import { mcpHttpAuthToken, type McpServerOptions } from './config.js';

function isAuthorized(req: http.IncomingMessage): boolean {
  const token = mcpHttpAuthToken();
  if (!token) return false;
  const header = req.headers.authorization ?? '';
  return header === `Bearer ${token}`;
}

export async function runMcpHttpServer(
  state: McpServerState,
  options: McpServerOptions,
): Promise<http.Server> {
  const token = mcpHttpAuthToken();
  if (!token) {
    throw new Error(
      'HTTP MCP transport requires CARINA_MCP_SERVER_TOKEN (or CARINA_OPS_TOKEN) in the environment.',
    );
  }

  const server = http.createServer((req, res) => {
    void (async () => {
      if (req.method !== 'POST' || req.url !== '/mcp') {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
        return;
      }

      if (!isAuthorized(req)) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return;
      }

      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(chunk as Buffer);
      }
      const body = Buffer.concat(chunks).toString('utf8');

      let response: JsonRpcResponse;
      try {
        const request = JSON.parse(body) as JsonRpcRequest;
        const handled = await handleMcpRequest(state, request);
        response = handled ?? { jsonrpc: '2.0', id: request.id ?? null, result: {} };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        response = {
          jsonrpc: '2.0',
          id: null,
          error: { code: -32700, message: `Parse error: ${message}` },
        };
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(response));
    })();
  });

  await new Promise<void>((resolve, reject) => {
    server.listen(options.httpPort, options.httpHost, () => resolve());
    server.on('error', reject);
  });

  console.error(
    `[carina-mcp] HTTP listening on http://${options.httpHost}:${options.httpPort}/mcp (profile: ${state.profile.profileName})`,
  );

  return server;
}
