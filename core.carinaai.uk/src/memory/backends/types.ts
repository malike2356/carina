import type { Memory, Role } from '../../types/index.js';

export interface MemoryBackend {
  readonly name: string;
  saveMemory(sessionId: string, role: Role, content: string): Promise<void>;
  searchMemory(query: string, limit: number): Promise<Memory[]>;
  getSessionHistory(sessionId: string, limit: number): Promise<Memory[]>;
  clearSession(sessionId: string): Promise<void>;
}
