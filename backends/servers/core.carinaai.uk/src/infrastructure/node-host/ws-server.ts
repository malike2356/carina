import type { Server as HttpServer } from 'http';
import type { NodeCommand } from './types.js';
import { completeNodeCommand, getPairedNode, validateNodeToken } from './store.js';
import {
  getNodeConnectionInfo,
  registerNodeSocket,
  resolveProtocolResponse,
  setNodeConnectionInfo,
  touchNodeHeartbeat,
  unregisterNodeSocket,
} from './node-ws-hub.js';
import { appendNodeAudit } from './audit.js';
import {
  type NodeHello,
  NodeCapability,
  normalizeCapabilities,
  type NodeProtocolResponse,
} from './node-protocol.js';
import { getDeviceTrust, initDeviceTrust } from '../device-trust.js';
import { getNodeHostServer } from './node-host-server.js';
import { lookupDevicePublicKey } from '../device-public-keys.js';
import { validateDeviceToken } from '../device-pairing.js';

export type NodeWsMessage =
  | { type: 'command'; command: NodeCommand }
  | { type: 'complete'; id: string; result?: unknown; error?: string }
  | { type: 'heartbeat' }
  | { type: 'pong' }
  | NodeHello
  | NodeProtocolResponse;

const HELLO_TIMEOUT_MS = 5000;

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

function resolveAuthToken(hello: NodeHello): { nodeId: string; name: string; platform: string } | null {
  const token = hello.auth?.token ?? '';
  const node = validateNodeToken(token);
  if (node) {
    return { nodeId: node.id, name: node.name, platform: node.platform };
  }
  const device = validateDeviceToken(token);
  if (device) {
    return { nodeId: device.id, name: device.name, platform: device.platform };
  }
  return null;
}

async function verifyHelloAuth(hello: NodeHello, nodeId: string): Promise<boolean> {
  const publicKey = await lookupDevicePublicKey(nodeId);
  if (!publicKey) return true;
  if (!hello.auth.nonce || !hello.auth.signature) return true;
  return getDeviceTrust().verifyChallenge(
    nodeId,
    hello.auth.signature,
    hello.auth.nonce,
  );
}

function registerConnection(
  nodeId: string,
  deviceName: string,
  platform: string,
  capabilities: NodeCapability[],
  protocolVersion: 'legacy' | 'v2',
  sender: { send: (payload: unknown) => void; close: () => void },
): void {
  registerNodeSocket(nodeId, sender);
  setNodeConnectionInfo(nodeId, {
    deviceName,
    platform,
    capabilities,
    connectedAt: Date.now(),
    lastHeartbeat: Date.now(),
    protocolVersion,
  });
  appendNodeAudit({ action: 'ws.connect', nodeId, detail: protocolVersion });
  getNodeHostServer().emit('connected', nodeId, capabilities);
}

function handleDisconnect(nodeId: string, sender?: { close: () => void }): void {
  unregisterNodeSocket(nodeId, sender);
  appendNodeAudit({ action: 'ws.disconnect', nodeId });
  getNodeHostServer().emit('disconnected', nodeId);
}

export function attachNodeWebSocketServer(server: HttpServer): void {
  if (!nodeWebSocketEnabled()) return;
  if (process.env.CARINA_NODE_HOST_ENABLED !== 'true') return;

  initDeviceTrust(lookupDevicePublicKey);

  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname !== '/api/nodes/ws') {
      return;
    }

    const urlToken = url.searchParams.get('token') ?? '';
    const preAuth = urlToken ? validateNodeToken(urlToken) : null;

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

        let nodeId = preAuth?.id;
        let registered = false;
        let heartbeatTimer: ReturnType<typeof setInterval> | undefined;

        const finishRegister = (
          id: string,
          name: string,
          platform: string,
          capabilities: NodeCapability[],
          protocolVersion: 'legacy' | 'v2',
        ) => {
          if (registered) return;
          registered = true;
          nodeId = id;
          registerConnection(id, name, platform, capabilities, protocolVersion, sender);

          heartbeatTimer = setInterval(() => {
            const info = getNodeConnectionInfo(id);
            if (!info) return;
            if (Date.now() - info.lastHeartbeat > 30_000) {
              ws.terminate();
              clearInterval(heartbeatTimer);
              handleDisconnect(id, sender);
              return;
            }
            ws.ping();
          }, 10_000);
        };

        if (preAuth) {
          finishRegister(
            preAuth.id,
            preAuth.name,
            preAuth.platform,
            [NodeCapability.FILE_SYSTEM],
            'legacy',
          );
          sender.send({ type: 'ready', nodeId: preAuth.id });

          const paired = getPairedNode(preAuth.id);
          if (paired?.publicKey) {
            const challenge = getDeviceTrust().issueChallenge(preAuth.id);
            sender.send({
              type: 'challenge',
              nonce: challenge.nonce,
              deviceId: preAuth.id,
              expiresAt: challenge.expiresAt,
            });
          }
        }

        const helloTimer = preAuth
          ? undefined
          : setTimeout(() => {
            if (!registered) {
              ws.close(4001, 'No hello received');
            }
          }, HELLO_TIMEOUT_MS);

        ws.on('message', (data) => {
          const msg = parseNodeWsMessage(String(data));
          if (!msg) return;

          if (msg.type === 'hello') {
            void (async () => {
              const auth = resolveAuthToken(msg);
              if (!auth) {
                ws.close(4002, 'Device not paired');
                return;
              }
              const ok = await verifyHelloAuth(msg, auth.nodeId);
              if (!ok) {
                ws.close(4003, 'Challenge verification failed');
                return;
              }
              const capabilities = normalizeCapabilities(msg.capabilities);
              if (capabilities.length === 0) {
                capabilities.push(NodeCapability.FILE_SYSTEM);
              }
              finishRegister(
                auth.nodeId,
                msg.deviceName || auth.name,
                msg.platform || auth.platform,
                capabilities,
                'v2',
              );
              if (helloTimer) clearTimeout(helloTimer);
              sender.send({
                type: 'hello_ok',
                nodeId: auth.nodeId,
                capabilities,
              });
            })();
            return;
          }

          if (msg.type === 'heartbeat') {
            if (nodeId) touchNodeHeartbeat(nodeId);
            sender.send({ type: 'pong', at: new Date().toISOString() });
            return;
          }

          if (msg.type === 'response') {
            resolveProtocolResponse(msg);
            if (nodeId) {
              appendNodeAudit({ action: 'command.response', nodeId, detail: msg.id });
            }
            return;
          }

          if (msg.type === 'complete' && nodeId) {
            completeNodeCommand(msg.id, nodeId, msg.result, msg.error);
            appendNodeAudit({ action: 'command.complete', nodeId, detail: msg.id });
          }
        });

        ws.on('close', () => {
          if (helloTimer) clearTimeout(helloTimer);
          if (heartbeatTimer) clearInterval(heartbeatTimer);
          if (nodeId) handleDisconnect(nodeId, sender);
        });

        ws.on('pong', () => {
          if (nodeId) touchNodeHeartbeat(nodeId);
        });
      });
    }).catch(() => {
      socket.write('HTTP/1.1 503 Service Unavailable\r\n\r\n');
      socket.destroy();
    });
  });
}
