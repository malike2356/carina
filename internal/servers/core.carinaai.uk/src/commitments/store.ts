import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { CARINA_HOME } from '../config/paths.js';
import type {
  Commitment,
  CommitmentKind,
  CommitmentStore,
  ListCommitmentsFilter,
} from './types.js';

const STORE_FILE = path.join(CARINA_HOME, 'commitments.json');
const STORE_VERSION = 1;

function emptyStore(): CommitmentStore {
  return { version: STORE_VERSION, commitments: [] };
}

function loadStore(): CommitmentStore {
  if (!fs.existsSync(STORE_FILE)) return emptyStore();
  try {
    const raw = JSON.parse(fs.readFileSync(STORE_FILE, 'utf-8')) as CommitmentStore;
    return { ...emptyStore(), ...raw, commitments: raw.commitments ?? [] };
  } catch {
    return emptyStore();
  }
}

function saveStore(store: CommitmentStore): void {
  fs.mkdirSync(CARINA_HOME, { recursive: true });
  fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2), { mode: 0o600 });
}

export function commitmentsStorePath(): string {
  return STORE_FILE;
}

export function generateCommitmentId(): string {
  return `cm_${crypto.randomBytes(9).toString('base64url')}`;
}

export function listCommitments(filter: ListCommitmentsFilter = {}): Commitment[] {
  const store = loadStore();
  let rows = store.commitments;
  if (filter.agentId) rows = rows.filter((c) => c.agentId === filter.agentId);
  if (filter.sessionId) rows = rows.filter((c) => c.sessionId === filter.sessionId);
  if (filter.status && filter.status !== 'all') {
    rows = rows.filter((c) => c.status === filter.status);
  }
  return rows.sort((a, b) => a.dueAt.localeCompare(b.dueAt));
}

export function countPendingCommitments(agentId?: string): number {
  return listCommitments({ status: 'pending', agentId }).length;
}

export function getCommitment(id: string): Commitment | null {
  return loadStore().commitments.find((c) => c.id === id) ?? null;
}

export function addCommitment(input: {
  kind: CommitmentKind;
  agentId: string;
  sessionId: string;
  channel: string | null;
  conversationId: string | null;
  threadId: string | null;
  dueAt: Date;
  dueLatestAt: Date;
  checkInText: string;
  sourceSummary: string;
  confidence: number;
}): Commitment {
  const store = loadStore();
  const commitment: Commitment = {
    id: generateCommitmentId(),
    status: 'pending',
    kind: input.kind,
    agentId: input.agentId,
    sessionId: input.sessionId,
    channel: input.channel,
    conversationId: input.conversationId,
    threadId: input.threadId,
    dueAt: input.dueAt.toISOString(),
    dueLatestAt: input.dueLatestAt.toISOString(),
    checkInText: input.checkInText.trim(),
    sourceSummary: input.sourceSummary.trim(),
    confidence: input.confidence,
    createdAt: new Date().toISOString(),
  };
  store.commitments.push(commitment);
  saveStore(store);
  return commitment;
}

export function updateCommitment(
  id: string,
  patch: Partial<Pick<Commitment, 'status' | 'sentAt' | 'dismissedAt' | 'snoozedUntil' | 'dueAt'>>,
): Commitment | null {
  const store = loadStore();
  const idx = store.commitments.findIndex((c) => c.id === id);
  if (idx === -1) return null;
  store.commitments[idx] = { ...store.commitments[idx], ...patch };
  saveStore(store);
  return store.commitments[idx];
}

export function dismissCommitments(ids: string[]): number {
  const store = loadStore();
  const now = new Date().toISOString();
  let count = 0;
  for (const id of ids) {
    const row = store.commitments.find((c) => c.id === id);
    if (!row || row.status === 'dismissed') continue;
    row.status = 'dismissed';
    row.dismissedAt = now;
    count += 1;
  }
  if (count > 0) saveStore(store);
  return count;
}

export function expireStaleCommitments(now = new Date()): number {
  const store = loadStore();
  let count = 0;
  for (const row of store.commitments) {
    if (row.status !== 'pending' && row.status !== 'snoozed') continue;
    if (row.status === 'snoozed' && row.snoozedUntil) {
      if (new Date(row.snoozedUntil).getTime() > now.getTime()) continue;
      row.status = 'pending';
      delete row.snoozedUntil;
    }
    if (new Date(row.dueLatestAt).getTime() < now.getTime()) {
      row.status = 'expired';
      count += 1;
    }
  }
  if (count > 0) saveStore(store);
  return count;
}

export function clearCommitmentStoreForTests(): void {
  try {
    fs.unlinkSync(STORE_FILE);
  } catch {
    // ignore
  }
}
