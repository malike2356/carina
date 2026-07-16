import * as episodic from '../episodic-postgres.js';
import type { MemoryBackend } from './types.js';

export const postgresBackend: MemoryBackend = {
  name: 'postgres',
  displayName: 'PostgreSQL',
  description: 'Carina episodic store with pgvector semantic search',
  isConfigured() {
    return Boolean(process.env.DATABASE_URL);
  },
  requiredEnv() {
    return ['DATABASE_URL'];
  },
  saveMemory: episodic.saveMemory,
  searchMemory: episodic.searchMemory,
  getSessionHistory: episodic.getSessionHistory,
  clearSession: episodic.clearSession,
  listRecentMemories: episodic.listRecentMemories,
};
