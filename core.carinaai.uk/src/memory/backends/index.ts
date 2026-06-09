import type { Role } from '../../types/index.js';
import type { MemoryBackend } from './types.js';
import { postgresBackend } from './postgres-backend.js';
import { sqliteBackend } from './sqlite-backend.js';
import { honchoBackend, mem0Backend } from './remote-backend.js';

const BACKENDS: Record<string, MemoryBackend> = {
  postgres: postgresBackend,
  sqlite: sqliteBackend,
  honcho: honchoBackend,
  mem0: mem0Backend,
};

let active: MemoryBackend = postgresBackend;

export function getMemoryBackend(): MemoryBackend {
  return active;
}

export function setMemoryBackend(name: string): MemoryBackend {
  const backend = BACKENDS[name];
  if (!backend) {
    throw new Error(`Unknown memory backend: ${name}. Available: ${Object.keys(BACKENDS).join(', ')}`);
  }
  active = backend;
  return backend;
}

export function initMemoryBackend(): MemoryBackend {
  const name = (process.env.CARINA_MEMORY_BACKEND ?? 'postgres').toLowerCase();
  if (BACKENDS[name]) active = BACKENDS[name];
  return active;
}

export function listMemoryBackends(): string[] {
  return Object.keys(BACKENDS);
}

export async function backendSaveMemory(sessionId: string, role: Role, content: string): Promise<void> {
  return active.saveMemory(sessionId, role, content);
}

export async function backendSearchMemory(query: string, limit: number) {
  return active.searchMemory(query, limit);
}

export async function backendGetSessionHistory(sessionId: string, limit: number) {
  return active.getSessionHistory(sessionId, limit);
}

export async function backendClearSession(sessionId: string): Promise<void> {
  return active.clearSession(sessionId);
}
