import type { Memory, Role } from '../../types/index.js';

export interface MemoryBackend {
  readonly name: string;
  readonly displayName: string;
  readonly description: string;
  isConfigured(): boolean;
  requiredEnv(): string[];
  saveMemory(sessionId: string, role: Role, content: string): Promise<void>;
  searchMemory(query: string, limit: number): Promise<Memory[]>;
  getSessionHistory(sessionId: string, limit: number): Promise<Memory[]>;
  clearSession(sessionId: string): Promise<void>;
  listRecentMemories?(limit: number): Promise<Memory[]>;
}

export type MemoryBackendName = 'builtin' | 'postgres' | 'sqlite' | 'honcho' | 'mem0';
