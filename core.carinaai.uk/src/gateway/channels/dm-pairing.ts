import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { CARINA_HOME } from '../../config/paths.js';
import type { ChannelName } from './channel-adapter.interface.js';

export type DmPeerStatus = 'pending' | 'approved' | 'rejected' | 'revoked';

export type DmPeerRecord = {
  id: string;
  channel: ChannelName;
  peerId: string;
  status: DmPeerStatus;
  label?: string;
  token?: string;
  createdAt: string;
  updatedAt: string;
};

type DmStore = {
  version: number;
  peers: DmPeerRecord[];
  audit: Array<{ at: string; action: string; channel: string; peerId: string; detail?: string }>;
};

const STORE_PATH = path.join(CARINA_HOME, 'channel-dm-pairing.json');
let cached: DmStore | null = null;

const DM_PAIRING_CHANNELS = new Set<ChannelName>([
  'telegram', 'whatsapp', 'discord', 'slack', 'signal', 'matrix', 'mattermost', 'imessage', 'sms',
]);

function loadStore(): DmStore {
  if (cached) return cached;
  if (!fs.existsSync(STORE_PATH)) {
    cached = { version: 1, peers: [], audit: [] };
    return cached;
  }
  try {
    cached = JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8')) as DmStore;
    cached.peers = cached.peers ?? [];
    cached.audit = cached.audit ?? [];
    return cached;
  } catch {
    cached = { version: 1, peers: [], audit: [] };
    return cached;
  }
}

function saveStore(store: DmStore): void {
  fs.mkdirSync(CARINA_HOME, { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), { mode: 0o600 });
  cached = store;
}

function audit(store: DmStore, action: string, channel: ChannelName, peerId: string, detail?: string): void {
  store.audit.push({ at: new Date().toISOString(), action, channel, peerId, detail });
  if (store.audit.length > 500) store.audit = store.audit.slice(-500);
}

export function channelDmPairingEnabled(channel?: ChannelName): boolean {
  if (process.env.CARINA_CHANNEL_DM_PAIRING !== 'true') return false;
  if (!channel) return true;
  const flag = process.env[`CARINA_${channel.toUpperCase()}_DM_PAIRING`];
  if (flag === 'false') return false;
  return DM_PAIRING_CHANNELS.has(channel);
}

export function listDmPeers(channel?: ChannelName, status?: DmPeerStatus): DmPeerRecord[] {
  return loadStore().peers.filter((p) =>
    (!channel || p.channel === channel) && (!status || p.status === status));
}

export function getDmPeer(channel: ChannelName, peerId: string): DmPeerRecord | undefined {
  return loadStore().peers.find((p) => p.channel === channel && p.peerId === peerId);
}

export function requestDmPeer(channel: ChannelName, peerId: string, label?: string): DmPeerRecord {
  const store = loadStore();
  const existing = store.peers.find((p) => p.channel === channel && p.peerId === peerId);
  if (existing) return existing;
  const record: DmPeerRecord = {
    id: crypto.randomUUID(),
    channel,
    peerId,
    status: 'pending',
    label,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  store.peers.push(record);
  audit(store, 'request', channel, peerId);
  saveStore(store);
  return record;
}

export function approveDmPeer(channel: ChannelName, peerId: string): DmPeerRecord | null {
  const store = loadStore();
  const record = store.peers.find((p) => p.channel === channel && p.peerId === peerId);
  if (!record) return null;
  record.status = 'approved';
  record.updatedAt = new Date().toISOString();
  audit(store, 'approve', channel, peerId);
  saveStore(store);
  return record;
}

export function rejectDmPeer(channel: ChannelName, peerId: string): DmPeerRecord | null {
  const store = loadStore();
  const record = store.peers.find((p) => p.channel === channel && p.peerId === peerId);
  if (!record) return null;
  record.status = 'rejected';
  record.updatedAt = new Date().toISOString();
  audit(store, 'reject', channel, peerId);
  saveStore(store);
  return record;
}

export function revokeDmPeer(channel: ChannelName, peerId: string): DmPeerRecord | null {
  const store = loadStore();
  const record = store.peers.find((p) => p.channel === channel && p.peerId === peerId);
  if (!record) return null;
  record.status = 'revoked';
  record.updatedAt = new Date().toISOString();
  audit(store, 'revoke', channel, peerId);
  saveStore(store);
  return record;
}

export function rotateDmPeerToken(channel: ChannelName, peerId: string): string | null {
  const store = loadStore();
  const record = store.peers.find((p) => p.channel === channel && p.peerId === peerId);
  if (!record || record.status !== 'approved') return null;
  record.token = crypto.randomBytes(16).toString('hex');
  record.updatedAt = new Date().toISOString();
  audit(store, 'rotate', channel, peerId);
  saveStore(store);
  return record.token;
}

export function checkDmAllowed(channel: ChannelName, peerId: string, isDirect: boolean): {
  allowed: boolean;
  reason?: string;
  pending?: boolean;
} {
  if (!isDirect || !channelDmPairingEnabled(channel)) {
    return { allowed: true };
  }
  const peer = getDmPeer(channel, peerId);
  if (!peer) {
    requestDmPeer(channel, peerId);
    return { allowed: false, reason: 'DM pairing required; peer pending approval', pending: true };
  }
  if (peer.status === 'approved') return { allowed: true };
  if (peer.status === 'pending') {
    return { allowed: false, reason: 'DM pending operator approval', pending: true };
  }
  return { allowed: false, reason: `DM ${peer.status}` };
}

export function listDmAudit(limit = 50): DmStore['audit'] {
  return loadStore().audit.slice(-limit);
}

export function resetDmPairingCache(): void {
  cached = null;
}
