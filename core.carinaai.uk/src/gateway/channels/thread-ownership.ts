import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { CARINA_HOME } from '../../config/paths.js';
import type { ChannelName } from './channel-adapter.interface.js';
import { CHANNEL_CAPABILITIES } from './channel-capabilities.js';

export type ThreadOwnershipRecord = {
  key: string;
  channel: ChannelName;
  conversationId: string;
  threadId: string;
  agentId: string;
  profile: string;
  instanceId: string;
  acquiredAt: string;
  lastActivityAt: string;
  handoffFrom?: string;
};

type OwnershipStore = {
  version: number;
  threads: ThreadOwnershipRecord[];
  audit: Array<{ at: string; action: string; key: string; detail?: string }>;
};

const STORE_PATH = path.join(CARINA_HOME, 'thread-ownership.json');
const THREAD_CHANNELS = new Set<ChannelName>([
  'slack', 'discord', 'telegram', 'whatsapp', 'matrix', 'mattermost', 'imessage', 'signal', 'email', 'irc',
]);

let cached: OwnershipStore | null = null;

function loadStore(): OwnershipStore {
  if (cached) return cached;
  if (!fs.existsSync(STORE_PATH)) {
    cached = { version: 1, threads: [], audit: [] };
    return cached;
  }
  try {
    cached = JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8')) as OwnershipStore;
    cached.threads = cached.threads ?? [];
    cached.audit = cached.audit ?? [];
    return cached;
  } catch {
    cached = { version: 1, threads: [], audit: [] };
    return cached;
  }
}

function saveStore(store: OwnershipStore): void {
  fs.mkdirSync(CARINA_HOME, { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
  cached = store;
}

function audit(store: OwnershipStore, action: string, key: string, detail?: string): void {
  store.audit.push({ at: new Date().toISOString(), action, key, detail });
  if (store.audit.length > 500) store.audit = store.audit.slice(-500);
}

export function threadOwnershipEnabled(): boolean {
  return process.env.CARINA_THREAD_OWNERSHIP === 'true';
}

export function buildThreadKey(
  channel: ChannelName,
  conversationId: string,
  threadId?: string,
): string {
  const tid = threadId?.trim() || 'root';
  return `${channel}:${conversationId}:${tid}`;
}

export function channelSupportsThreadOwnership(channel: ChannelName): boolean {
  if (!THREAD_CHANNELS.has(channel)) return false;
  return CHANNEL_CAPABILITIES[channel]?.supportsThreading || channel !== 'web';
}

export function getThreadOwnership(key: string): ThreadOwnershipRecord | undefined {
  return loadStore().threads.find((t) => t.key === key);
}

export function listThreadOwnership(): ThreadOwnershipRecord[] {
  return [...loadStore().threads];
}

export function listOwnershipAudit(limit = 50): OwnershipStore['audit'] {
  return loadStore().audit.slice(-limit);
}

export type AcquireResult =
  | { ok: true; record: ThreadOwnershipRecord }
  | { ok: false; owner: ThreadOwnershipRecord; reason: string };

export function tryAcquireThreadOwnership(input: {
  channel: ChannelName;
  conversationId: string;
  threadId?: string;
  agentId: string;
  profile?: string;
}): AcquireResult {
  const key = buildThreadKey(input.channel, input.conversationId, input.threadId);
  const store = loadStore();
  const now = new Date().toISOString();
  const instanceId = process.env.CARINA_INSTANCE_ID ?? 'default';
  const profile = input.profile ?? process.env.CARINA_PROFILE ?? 'default';

  const existing = store.threads.find((t) => t.key === key);
  if (existing && existing.agentId !== input.agentId && existing.instanceId === instanceId) {
    audit(store, 'blocked', key, `held by ${existing.agentId}`);
    saveStore(store);
    return { ok: false, owner: existing, reason: `thread owned by agent ${existing.agentId}` };
  }
  if (existing && existing.instanceId !== instanceId) {
    audit(store, 'blocked', key, `held by instance ${existing.instanceId}`);
    saveStore(store);
    return { ok: false, owner: existing, reason: `thread owned by instance ${existing.instanceId}` };
  }

  const record: ThreadOwnershipRecord = existing ?? {
    key,
    channel: input.channel,
    conversationId: input.conversationId,
    threadId: input.threadId?.trim() || 'root',
    agentId: input.agentId,
    profile,
    instanceId,
    acquiredAt: now,
    lastActivityAt: now,
  };
  record.agentId = input.agentId;
  record.lastActivityAt = now;

  if (!existing) {
    store.threads.push(record);
    audit(store, 'acquire', key, input.agentId);
  } else {
    audit(store, 'renew', key, input.agentId);
  }
  saveStore(store);
  return { ok: true, record };
}

export function handoffThreadOwnership(
  key: string,
  toAgentId: string,
  reason?: string,
): ThreadOwnershipRecord | null {
  const store = loadStore();
  const record = store.threads.find((t) => t.key === key);
  if (!record) return null;
  const from = record.agentId;
  record.agentId = toAgentId;
  record.handoffFrom = from;
  record.lastActivityAt = new Date().toISOString();
  audit(store, 'handoff', key, `${from} -> ${toAgentId}${reason ? `: ${reason}` : ''}`);
  saveStore(store);
  return record;
}

export function releaseThreadOwnership(key: string, agentId?: string): boolean {
  const store = loadStore();
  const idx = store.threads.findIndex((t) => t.key === key && (!agentId || t.agentId === agentId));
  if (idx < 0) return false;
  store.threads.splice(idx, 1);
  audit(store, 'release', key, agentId);
  saveStore(store);
  return true;
}

export function resetThreadOwnershipCache(): void {
  cached = null;
}

export function rotateInstanceOwnership(instanceId: string): number {
  const store = loadStore();
  const before = store.threads.length;
  store.threads = store.threads.filter((t) => t.instanceId !== instanceId);
  const removed = before - store.threads.length;
  if (removed > 0) {
    audit(store, 'rotate-instance', instanceId, `removed ${removed}`);
    saveStore(store);
  }
  return removed;
}
