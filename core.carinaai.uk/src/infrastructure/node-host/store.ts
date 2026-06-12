import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { CARINA_HOME } from '../../config/paths.js';
import type { NodeCommand, NodeHostLocalConfig, PairedNode, PendingNodePairing } from './types.js';

const NODES_FILE = path.join(CARINA_HOME, 'nodes.json');
const NODE_HOST_CONFIG = path.join(CARINA_HOME, 'node-host.json');
const COMMAND_TTL_MS = 60 * 60 * 1000;

type NodeStore = {
  version: number;
  pending: PendingNodePairing[];
  nodes: PairedNode[];
  commands: NodeCommand[];
};

function emptyStore(): NodeStore {
  return { version: 1, pending: [], nodes: [], commands: [] };
}

function loadStore(): NodeStore {
  if (!fs.existsSync(NODES_FILE)) return emptyStore();
  try {
    const raw = JSON.parse(fs.readFileSync(NODES_FILE, 'utf-8')) as NodeStore;
    return {
      ...emptyStore(),
      ...raw,
      pending: raw.pending ?? [],
      nodes: raw.nodes ?? [],
      commands: raw.commands ?? [],
    };
  } catch {
    return emptyStore();
  }
}

function saveStore(store: NodeStore): void {
  fs.mkdirSync(CARINA_HOME, { recursive: true });
  fs.writeFileSync(NODES_FILE, JSON.stringify(store, null, 2), { mode: 0o600 });
}

export function hashNodeToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function generateNodeToken(): string {
  return `cnh_${crypto.randomBytes(24).toString('base64url')}`;
}

export function generatePairingCode(): string {
  return crypto.randomBytes(3).toString('hex').toUpperCase();
}

export function listPendingPairings(): PendingNodePairing[] {
  const store = loadStore();
  const now = Date.now();
  store.pending = store.pending.filter((p) => new Date(p.expiresAt).getTime() > now);
  saveStore(store);
  return store.pending;
}

export function addPendingPairing(input: Omit<PendingNodePairing, 'id' | 'code' | 'createdAt' | 'expiresAt'> & {
  ttlMs?: number;
}): PendingNodePairing {
  const store = loadStore();
  const ttl = input.ttlMs ?? 15 * 60 * 1000;
  const pending: PendingNodePairing = {
    id: crypto.randomUUID(),
    code: generatePairingCode(),
    name: input.name,
    hostname: input.hostname,
    platform: input.platform,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + ttl).toISOString(),
  };
  store.pending.push(pending);
  saveStore(store);
  return pending;
}

export function getPendingPairing(id: string): PendingNodePairing | undefined {
  return listPendingPairings().find((p) => p.id === id);
}

export function getPendingByCode(code: string): PendingNodePairing | undefined {
  return listPendingPairings().find((p) => p.code.toUpperCase() === code.toUpperCase());
}

export function removePendingPairing(id: string): boolean {
  const store = loadStore();
  const before = store.pending.length;
  store.pending = store.pending.filter((p) => p.id !== id);
  if (store.pending.length === before) return false;
  saveStore(store);
  return true;
}

export function approvePendingPairing(id: string): PairedNode | null {
  const store = loadStore();
  const pending = store.pending.find((p) => p.id === id);
  if (!pending) return null;
  const node: PairedNode = {
    id: pending.id,
    name: pending.name,
    hostname: pending.hostname,
    platform: pending.platform,
    tokenHash: hashNodeToken(`pending:${pending.id}:${pending.code}`),
    pairingCodeHash: hashNodeToken(pending.code),
    status: 'offline',
    pairedAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
    approvedAt: new Date().toISOString(),
  };
  store.nodes.push(node);
  store.pending = store.pending.filter((p) => p.id !== id);
  saveStore(store);
  return node;
}

export function claimApprovedNodePairing(
  pendingId: string,
  code: string,
): { nodeId: string; token: string; name: string } | null {
  const store = loadStore();
  const node = store.nodes.find((n) => n.id === pendingId);
  if (!node || !node.pairingCodeHash) return null;
  const codeHash = hashNodeToken(code.toUpperCase());
  if (node.pairingCodeHash !== codeHash) return null;
  node.pairingCodeHash = undefined;
  const token = generateNodeToken();
  node.tokenHash = hashNodeToken(token);
  saveStore(store);
  return { nodeId: node.id, token, name: node.name };
}

export function listPairedNodes(): PairedNode[] {
  return loadStore().nodes;
}

export function getPairedNode(id: string): PairedNode | undefined {
  return loadStore().nodes.find((n) => n.id === id);
}

export function validateNodeToken(token: string): PairedNode | null {
  if (!token.startsWith('cnh_')) return null;
  const store = loadStore();
  const hash = hashNodeToken(token);
  const node = store.nodes.find((n) => n.tokenHash === hash);
  if (!node) return null;
  node.lastSeenAt = new Date().toISOString();
  node.status = 'online';
  saveStore(store);
  return node;
}

export function revokePairedNode(id: string): boolean {
  const store = loadStore();
  const before = store.nodes.length;
  store.nodes = store.nodes.filter((n) => n.id !== id);
  store.commands = store.commands.filter((c) => c.nodeId !== id);
  if (store.nodes.length === before) return false;
  saveStore(store);
  return true;
}

export function rotateNodeToken(id: string): { node: PairedNode; token: string } | null {
  const store = loadStore();
  const node = store.nodes.find((n) => n.id === id);
  if (!node) return null;
  const token = generateNodeToken();
  node.tokenHash = hashNodeToken(token);
  node.lastSeenAt = new Date().toISOString();
  saveStore(store);
  return { node, token };
}

export function enqueueNodeCommand(
  nodeId: string,
  type: NodeCommand['type'],
  payload: Record<string, unknown>,
): NodeCommand {
  const store = loadStore();
  const cmd: NodeCommand = {
    id: crypto.randomUUID(),
    nodeId,
    type,
    payload,
    createdAt: new Date().toISOString(),
  };
  store.commands.push(cmd);
  pruneOldCommands(store);
  saveStore(store);
  return cmd;
}

export function pollNodeCommands(nodeId: string): NodeCommand[] {
  const store = loadStore();
  return store.commands.filter((c) => c.nodeId === nodeId && !c.completedAt);
}

export function completeNodeCommand(
  commandId: string,
  nodeId: string,
  result: unknown,
  error?: string,
): boolean {
  const store = loadStore();
  const cmd = store.commands.find((c) => c.id === commandId && c.nodeId === nodeId);
  if (!cmd || cmd.completedAt) return false;
  cmd.completedAt = new Date().toISOString();
  cmd.result = result;
  cmd.error = error;
  saveStore(store);
  return true;
}

export function getNodeCommand(commandId: string): NodeCommand | undefined {
  const store = loadStore();
  return store.commands.find((c) => c.id === commandId);
}

export async function waitForNodeCommand(
  commandId: string,
  timeoutMs = 60_000,
  pollMs = 250,
): Promise<NodeCommand | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const cmd = getNodeCommand(commandId);
    if (cmd?.completedAt) return cmd;
    await new Promise((r) => setTimeout(r, pollMs));
  }
  return getNodeCommand(commandId) ?? null;
}

function pruneOldCommands(store: NodeStore): void {
  const cutoff = Date.now() - COMMAND_TTL_MS;
  store.commands = store.commands.filter((c) => {
    const t = new Date(c.completedAt ?? c.createdAt).getTime();
    return t >= cutoff;
  });
}

export function readNodeHostConfig(): NodeHostLocalConfig | null {
  if (!fs.existsSync(NODE_HOST_CONFIG)) return null;
  try {
    return JSON.parse(fs.readFileSync(NODE_HOST_CONFIG, 'utf-8')) as NodeHostLocalConfig;
  } catch {
    return null;
  }
}

export function writeNodeHostConfig(config: NodeHostLocalConfig): void {
  fs.mkdirSync(CARINA_HOME, { recursive: true });
  fs.writeFileSync(NODE_HOST_CONFIG, JSON.stringify(config, null, 2), { mode: 0o600 });
}

export function clearNodeHostConfig(): void {
  try {
    fs.unlinkSync(NODE_HOST_CONFIG);
  } catch {
    // ignore
  }
}

export function nodeHostConfigPath(): string {
  return NODE_HOST_CONFIG;
}

export function redactNodesForApi(nodes: PairedNode[]): Array<Omit<PairedNode, 'tokenHash'>> {
  return nodes.map(({ tokenHash: _h, ...rest }) => rest);
}
