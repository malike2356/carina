import * as episodic from '../episodic-postgres.js';
import type { MemoryBackend } from './types.js';

export const postgresBackend: MemoryBackend = {
  name: 'postgres',
  saveMemory: episodic.saveMemory,
  searchMemory: episodic.searchMemory,
  getSessionHistory: episodic.getSessionHistory,
  clearSession: episodic.clearSession,
};
