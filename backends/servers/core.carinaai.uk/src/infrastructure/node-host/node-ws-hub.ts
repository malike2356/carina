import type { NodeCommand } from './types.js';
import type { NodeCapability, NodeProtocolCommand, NodeProtocolResponse } from './node-protocol.js';

export type NodeWsSender = {
  send: (payload: unknown) => void;
  close: () => void;
};

export type NodeConnectionInfo = {
  nodeId: string;
  deviceName: string;
  platform: string;
  capabilities: NodeCapability[];
  connectedAt: number;
  lastHeartbeat: number;
  protocolVersion: 'legacy' | 'v2';
};

type PendingProtocolCommand = {
  resolve: (response: NodeProtocolResponse) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

const sockets = new Map<string, NodeWsSender>();
const connectionInfo = new Map<string, NodeConnectionInfo>();
const pendingProtocol = new Map<string, PendingProtocolCommand>();

export function registerNodeSocket(nodeId: string, sender: NodeWsSender): void {
  const existing = sockets.get(nodeId);
  existing?.close();
  sockets.set(nodeId, sender);
}

export function unregisterNodeSocket(nodeId: string, sender?: NodeWsSender): void {
  const current = sockets.get(nodeId);
  if (!current) return;
  if (sender && current !== sender) return;
  sockets.delete(nodeId);
  connectionInfo.delete(nodeId);
}

export function isNodeSocketConnected(nodeId: string): boolean {
  return sockets.has(nodeId);
}

export function setNodeConnectionInfo(
  nodeId: string,
  info: Omit<NodeConnectionInfo, 'nodeId'>,
): void {
  connectionInfo.set(nodeId, { nodeId, ...info });
}

export function getNodeConnectionInfo(nodeId: string): NodeConnectionInfo | undefined {
  return connectionInfo.get(nodeId);
}

export function touchNodeHeartbeat(nodeId: string): void {
  const info = connectionInfo.get(nodeId);
  if (info) info.lastHeartbeat = Date.now();
}

export function listConnectedNodeInfos(): NodeConnectionInfo[] {
  return Array.from(connectionInfo.values());
}

export function pushNodeCommand(nodeId: string, command: NodeCommand): boolean {
  const sender = sockets.get(nodeId);
  if (!sender) return false;
  sender.send({ type: 'command', command });
  return true;
}

export function sendProtocolCommand(nodeId: string, command: NodeProtocolCommand): boolean {
  const sender = sockets.get(nodeId);
  if (!sender) return false;
  sender.send(command);
  return true;
}

export function registerPendingProtocolCommand(
  commandId: string,
  pending: PendingProtocolCommand,
): void {
  pendingProtocol.set(commandId, pending);
}

export function rejectPendingProtocolCommand(commandId: string, error: Error): void {
  const pending = pendingProtocol.get(commandId);
  if (!pending) return;
  clearTimeout(pending.timer);
  pending.reject(error);
  pendingProtocol.delete(commandId);
}

export function resolveProtocolResponse(response: NodeProtocolResponse): void {
  const pending = pendingProtocol.get(response.id);
  if (!pending) return;
  clearTimeout(pending.timer);
  pending.resolve(response);
  pendingProtocol.delete(response.id);
}

export function resetNodeSocketHub(): void {
  for (const pending of pendingProtocol.values()) {
    clearTimeout(pending.timer);
    pending.reject(new Error('Node socket hub reset'));
  }
  pendingProtocol.clear();
  for (const sender of sockets.values()) {
    sender.close();
  }
  sockets.clear();
  connectionInfo.clear();
}
