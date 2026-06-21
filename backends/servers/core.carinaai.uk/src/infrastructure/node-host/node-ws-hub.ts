import type { NodeCommand } from './types.js';

export type NodeWsSender = {
  send: (payload: unknown) => void;
  close: () => void;
};

const sockets = new Map<string, NodeWsSender>();

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
}

export function isNodeSocketConnected(nodeId: string): boolean {
  return sockets.has(nodeId);
}

export function pushNodeCommand(nodeId: string, command: NodeCommand): boolean {
  const sender = sockets.get(nodeId);
  if (!sender) return false;
  sender.send({ type: 'command', command });
  return true;
}

export function resetNodeSocketHub(): void {
  for (const sender of sockets.values()) {
    sender.close();
  }
  sockets.clear();
}
