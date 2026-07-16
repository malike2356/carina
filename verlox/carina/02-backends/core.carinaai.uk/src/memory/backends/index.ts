import type { Role } from '../../types/index.js';
import { guardMemoryWrite, roleToMemorySource } from '../memory-write-guard.js';
import { storageSessionId } from '../session-scope.js';
import type { MemoryBackend } from './types.js';
import { builtinBackend, resolveBuiltinTarget } from './builtin-backend.js';
export { resolveBuiltinTarget };
import { postgresBackend } from './postgres-backend.js';
import { sqliteBackend } from './sqlite-backend.js';
import { honchoBackend } from './honcho-backend.js';
import { mem0Backend } from './mem0-backend.js';

const BACKENDS: Record<string, MemoryBackend> = {
  builtin: builtinBackend,
  postgres: postgresBackend,
  sqlite: sqliteBackend,
  honcho: honchoBackend,
  mem0: mem0Backend,
};

let active: MemoryBackend = postgresBackend;

export function getMemoryBackend(): MemoryBackend {
  return active;
}

export function getAllMemoryBackends(): MemoryBackend[] {
  return Object.values(BACKENDS);
}

export function describeMemoryBackends(): Array<{
  name: string;
  displayName: string;
  description: string;
  configured: boolean;
  requiredEnv: string[];
  active: boolean;
}> {
  return getAllMemoryBackends().map((b) => ({
    name: b.name,
    displayName: b.displayName,
    description: b.description,
    configured: b.isConfigured(),
    requiredEnv: b.requiredEnv(),
    active: b.name === active.name,
  }));
}

export function setMemoryBackend(name: string): MemoryBackend {
  const normalized = normalizeBackendName(name);
  const backend = BACKENDS[normalized];
  if (!backend) {
    throw new Error(`Unknown memory backend: ${name}. Available: ${Object.keys(BACKENDS).join(', ')}`);
  }
  active = backend;
  process.env.CARINA_MEMORY_BACKEND = normalized;
  return backend;
}

function normalizeBackendName(name: string): string {
  const key = name.toLowerCase().trim();
  if (key === 'built-in' || key === 'built_in' || key === 'local') return 'builtin';
  return key;
}

export function initMemoryBackend(): MemoryBackend {
  const name = normalizeBackendName(process.env.CARINA_MEMORY_BACKEND ?? 'builtin');
  if (BACKENDS[name]) {
    active = BACKENDS[name];
  } else {
    active = builtinBackend;
  }
  return active;
}

export function listMemoryBackends(): string[] {
  return Object.keys(BACKENDS);
}

export async function backendSaveMemory(sessionId: string, role: Role, content: string): Promise<void> {
  const guard = await guardMemoryWrite(content, roleToMemorySource(role), sessionId);
  if (!guard.allowed) return;
  return active.saveMemory(storageSessionId(sessionId), role, content);
}

export async function backendSearchMemory(query: string, limit: number) {
  return active.searchMemory(query, limit);
}

export async function backendGetSessionHistory(
  sessionId: string,
  limit: number,
  before?: Date,
) {
  return active.getSessionHistory(storageSessionId(sessionId), limit, before);
}

export async function backendClearSession(sessionId: string): Promise<void> {
  return active.clearSession(storageSessionId(sessionId));
}

export async function backendListRecentMemories(limit: number) {
  if (active.listRecentMemories) return active.listRecentMemories(limit);
  return active.searchMemory('', limit);
}
