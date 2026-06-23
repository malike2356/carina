import type { Memory, Role } from '../../types/index.js';
import type { MemoryBackend } from './types.js';
import { postgresBackend } from './postgres-backend.js';
import { sqliteBackend } from './sqlite-backend.js';

export function resolveBuiltinTarget(): MemoryBackend {
  const explicit = (process.env.CARINA_BUILTIN_MEMORY ?? '').toLowerCase();
  if (explicit === 'sqlite') return sqliteBackend;
  if (explicit === 'postgres') return postgresBackend;

  const local = process.env.CARINA_LOCAL_MODE === 'true'
    || process.env.CARINA_SKIP_POSTGRES === 'true';
  return local ? sqliteBackend : postgresBackend;
}

export const builtinBackend: MemoryBackend = {
  name: 'builtin',
  displayName: 'Built-in',
  description: 'Local Carina memory (PostgreSQL + pgvector, or SQLite in local mode)',
  isConfigured: () => true,
  requiredEnv: () => [],
  saveMemory(sessionId: string, role: Role, content: string) {
    return resolveBuiltinTarget().saveMemory(sessionId, role, content);
  },
  searchMemory(query: string, limit: number) {
    return resolveBuiltinTarget().searchMemory(query, limit);
  },
  getSessionHistory(sessionId: string, limit: number) {
    return resolveBuiltinTarget().getSessionHistory(sessionId, limit);
  },
  clearSession(sessionId: string) {
    return resolveBuiltinTarget().clearSession(sessionId);
  },
  async listRecentMemories(limit: number): Promise<Memory[]> {
    const target = resolveBuiltinTarget();
    if (target.listRecentMemories) return target.listRecentMemories(limit);
    return target.searchMemory('', limit);
  },
};
