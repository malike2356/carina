import type { Server as HttpServer } from 'http';
import type { NodeCommand } from './types.js';
import { completeNodeCommand, validateNodeToken } from './store.js';
import { registerNodeSocket, unregisterNodeSocket } from './node-ws-hub.js';
import { appendNodeAudit } from './audit.js';

export type NodeWsMessage =
  | { type: 'command'; command: NodeCommand }
  | { type: 'complete'; id: string; result?: unknown; error?: string }
  | { type: 'heartbeat' }
  | { type: 'pong' };

export function parseNodeWsMessage(raw: string): NodeWsMessage | null {
  try {
    const data = JSON.parse(raw) as NodeWsMessage;
    if (!data || typeof data !== 'object' || !('type' in data)) return null;
    return data;
  } catch {
    return null;
  }
}

export function nodeWebSocketEnabled(): boolean {
  return process.env.CARINA_NODE_WS !== 'false';
}

export function attachNodeWebSocketServer(server: HttpServer): void {
  if (!nodeWebSocketEnabled()) return;
  if (process.env.CARINA_NODE_HOST_ENABLED !== 'true') return;

  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname !== '/api/nodes/ws') {
      return;
    }
    const token = url.searchParams.get('token') ?? '';
    const node = validateNodeToken(token);
    if (!node) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    void import('ws').then(({ WebSocketServer }) => {
      const wss = new WebSocketServer({ noServer: true });
      wss.handleUpgrade(req, socket, head, (ws) => {
        const sender = {
          send: (payload: unknown) => {
            if (ws.readyState === ws.OPEN) {
              ws.send(JSON.stringify(payload));
            }
          },
          close: () => ws.close(),
        };
        registerNodeSocket(node.id, sender);
        appendNodeAudit({ action: 'ws.connect', nodeId: node.id });

        ws.on('message', (data) => {
          const msg = parseNodeWsMessage(String(data));
          if (!msg) return;
          if (msg.type === 'heartbeat') {
            sender.send({ type: 'pong', at: new Date().toISOString() });
            return;
          }
          if (msg.type === 'complete') {
            completeNodeCommand(msg.id, node.id, msg.result, msg.error);
            appendNodeAudit({ action: 'command.complete', nodeId: node.id, detail: msg.id });
          }
        });

        ws.on('close', () => {
          unregisterNodeSocket(node.id, sender);
          appendNodeAudit({ action: 'ws.disconnect', nodeId: node.id });
        });

        ws.send(JSON.stringify({ type: 'ready', nodeId: node.id }));
      });
    }).catch(() => {
      socket.write('HTTP/1.1 503 Service Unavailable\r\n\r\n');
      socket.destroy();
    });
  });
}
