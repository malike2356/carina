import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { resolveCarinaHome } from '../config/paths.js';

type LineageStore = {
  version: number;
  // child session id -> parent session id
  parents: Record<string, string>;
  // timestamps for display
  timestamps: Record<string, string>;
};

let warnedWriteFailure = false;

function storePath(): string {
  return path.join(resolveCarinaHome(), 'session-lineage.json');
}

function emptyStore(): LineageStore {
  return { version: 1, parents: {}, timestamps: {} };
}

function loadStore(): LineageStore {
  try {
    const raw = JSON.parse(fs.readFileSync(storePath(), 'utf-8')) as LineageStore;
    return { ...emptyStore(), ...raw };
  } catch {
    return emptyStore();
  }
}

function saveStore(store: LineageStore): void {
  const home = resolveCarinaHome();
  const filePath = storePath();
  try {
    fs.mkdirSync(home, { recursive: true });
    const tmpPath = `${filePath}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(store, null, 2), { mode: 0o644 });
    fs.renameSync(tmpPath, filePath);
  } catch (err) {
    if (!warnedWriteFailure) {
      warnedWriteFailure = true;
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[session-lineage] Could not persist lineage store (${msg}); continuing without disk write`);
    }
  }
}

export function recordSessionContinuation(childSessionId: string, parentSessionId: string): void {
  const store = loadStore();
  store.parents[childSessionId] = parentSessionId;
  store.timestamps[childSessionId] = new Date().toISOString();
  saveStore(store);
}

export function getSessionParent(sessionId: string): string | null {
  return loadStore().parents[sessionId] ?? null;
}

export function getSessionChain(sessionId: string): Array<{ sessionId: string; timestamp?: string }> {
  const store = loadStore();
  const chain: Array<{ sessionId: string; timestamp?: string }> = [];
  const seen = new Set<string>();
  let current: string | undefined = sessionId;
  while (current && !seen.has(current)) {
    seen.add(current);
    chain.push({ sessionId: current, timestamp: store.timestamps[current] });
    current = store.parents[current];
  }
  return chain;
}

export function getSessionChildren(sessionId: string): string[] {
  const store = loadStore();
  return Object.entries(store.parents)
    .filter(([, parent]) => parent === sessionId)
    .map(([child]) => child);
}

export function recordNewSession(sessionId: string): void {
  const store = loadStore();
  if (!store.timestamps[sessionId]) {
    store.timestamps[sessionId] = new Date().toISOString();
    saveStore(store);
  }
}

export function generateSessionId(): string {
  return crypto.randomUUID();
}

/** Root session id in a continuation chain (oldest ancestor). */
export function getLineageRoot(sessionId: string): string {
  const chain = getSessionChain(sessionId);
  return chain[chain.length - 1]?.sessionId ?? sessionId;
}

/** Session id plus ancestors and direct children (bounded for search dedupe). */
export function lineageRelatedSessionIds(sessionId: string, maxIds = 32): string[] {
  const ids = new Set<string>();
  for (const entry of getSessionChain(sessionId)) {
    if (ids.size >= maxIds) break;
    ids.add(entry.sessionId);
    for (const child of getSessionChildren(entry.sessionId)) {
      if (ids.size >= maxIds) break;
      ids.add(child);
    }
  }
  return [...ids];
}
