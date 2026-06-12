import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { CARINA_HOME } from '../../config/paths.js';

export type AcpProvenance = 'acp-client' | 'acp-ide' | 'bridge' | 'unknown';

export type AcpSession = {
  sessionId: string;
  label?: string;
  provenance: AcpProvenance;
  createdAt: string;
  lastUsed: string;
};

type AcpStoreFile = {
  version: number;
  sessions: AcpSession[];
};

const STORE_PATH = path.join(CARINA_HOME, 'acp-sessions.json');
let cached: AcpStoreFile | null = null;

function loadStore(): AcpStoreFile {
  if (cached) return cached;
  if (!fs.existsSync(STORE_PATH)) {
    cached = { version: 1, sessions: [] };
    return cached;
  }
  try {
    cached = JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8')) as AcpStoreFile;
    cached.sessions = cached.sessions ?? [];
    return cached;
  } catch {
    cached = { version: 1, sessions: [] };
    return cached;
  }
}

function saveStore(store: AcpStoreFile): void {
  fs.mkdirSync(CARINA_HOME, { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
  cached = store;
}

export function acpBridgeEnabled(): boolean {
  return process.env.CARINA_ACP_ENABLED === 'true';
}

export function acpProvenanceMode(): 'strict' | 'relaxed' {
  return process.env.CARINA_ACP_PROVENANCE === 'strict' ? 'strict' : 'relaxed';
}

export function createAcpSession(input: {
  label?: string;
  provenance?: AcpProvenance;
  sessionId?: string;
}): AcpSession {
  const store = loadStore();
  const now = new Date().toISOString();
  const session: AcpSession = {
    sessionId: input.sessionId ?? `acp:${crypto.randomUUID()}`,
    label: input.label,
    provenance: input.provenance ?? 'unknown',
    createdAt: now,
    lastUsed: now,
  };
  store.sessions.push(session);
  if (store.sessions.length > 200) store.sessions = store.sessions.slice(-200);
  saveStore(store);
  return session;
}

export function touchAcpSession(sessionId: string): AcpSession | null {
  const store = loadStore();
  const session = store.sessions.find((s) => s.sessionId === sessionId);
  if (!session) return null;
  session.lastUsed = new Date().toISOString();
  saveStore(store);
  return session;
}

export function getAcpSession(sessionId: string): AcpSession | undefined {
  return loadStore().sessions.find((s) => s.sessionId === sessionId);
}

export function listAcpSessions(): AcpSession[] {
  return [...loadStore().sessions];
}

export function deleteAcpSession(sessionId: string): boolean {
  const store = loadStore();
  const before = store.sessions.length;
  store.sessions = store.sessions.filter((s) => s.sessionId !== sessionId);
  if (store.sessions.length === before) return false;
  saveStore(store);
  return true;
}

export function setAcpSessionLabel(sessionId: string, label: string): AcpSession | null {
  const store = loadStore();
  const session = store.sessions.find((s) => s.sessionId === sessionId);
  if (!session) return null;
  session.label = label;
  session.lastUsed = new Date().toISOString();
  saveStore(store);
  return session;
}

export function resetAcpStoreCache(): void {
  cached = null;
}
