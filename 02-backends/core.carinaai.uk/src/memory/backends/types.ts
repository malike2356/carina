import type { Memory, Role } from '../../types/index.js';

/** Optional scope metadata used by channel-resident ambient memory (see channel_context_facts). */
export type MemoryScope = 'global' | `channel:${string}` | `user:${string}`;

/** Scope for episodic search / recent list. Prefer this over unscoped global dumps. */
export type EpisodicSearchScope = {
  /** Exact session_id match */
  sessionId?: string;
  /** Prefix match, e.g. aiva-<workerId>- */
  sessionIdPrefix?: string;
};

export interface MemoryBackend {
  readonly name: string;
  readonly displayName: string;
  readonly description: string;
  isConfigured(): boolean;
  requiredEnv(): string[];
  saveMemory(sessionId: string, role: Role, content: string): Promise<void>;
  searchMemory(query: string, limit: number, scope?: EpisodicSearchScope): Promise<Memory[]>;
  getSessionHistory(sessionId: string, limit: number, before?: Date): Promise<Memory[]>;
  clearSession(sessionId: string): Promise<void>;
  listRecentMemories?(limit: number, scope?: EpisodicSearchScope): Promise<Memory[]>;
}

export type MemoryBackendName = 'builtin' | 'postgres' | 'sqlite' | 'honcho' | 'mem0';
