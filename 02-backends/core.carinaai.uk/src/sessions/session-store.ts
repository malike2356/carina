/**
 * In-memory session store (Redis-compatible shape for product adapters).
 */
import type { AuthSession, RevocationLogEntry } from './types.js';

export interface SessionStore {
  get(sessionId: string): AuthSession | null;
  save(session: AuthSession): void;
  markRevoked(sessionId: string, reason: string): AuthSession | null;
  listByUser(userId: string): AuthSession[];
  delete(sessionId: string): void;
  appendRevocation(entry: RevocationLogEntry): void;
  searchRevocations(filters: {
    userId?: string;
    sessionId?: string;
    limit?: number;
  }): RevocationLogEntry[];
  clear(): void;
}

export class MemorySessionStore implements SessionStore {
  private sessions = new Map<string, AuthSession>();
  private revocations: RevocationLogEntry[] = [];

  get(sessionId: string): AuthSession | null {
    return this.sessions.get(sessionId) ?? null;
  }

  save(session: AuthSession): void {
    this.sessions.set(session.sessionId, { ...session, device: { ...session.device } });
  }

  markRevoked(sessionId: string, reason: string): AuthSession | null {
    const row = this.sessions.get(sessionId);
    if (!row || row.revokedAt) return null;
    const updated: AuthSession = {
      ...row,
      revokedAt: new Date().toISOString(),
      revokeReason: reason,
    };
    this.sessions.set(sessionId, updated);
    return updated;
  }

  listByUser(userId: string): AuthSession[] {
    return [...this.sessions.values()]
      .filter((s) => s.userId === userId)
      .sort((a, b) => Date.parse(b.lastActiveAt) - Date.parse(a.lastActiveAt));
  }

  delete(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  appendRevocation(entry: RevocationLogEntry): void {
    this.revocations.push(entry);
    if (this.revocations.length > 20_000) {
      this.revocations.splice(0, this.revocations.length - 15_000);
    }
  }

  searchRevocations(filters: {
    userId?: string;
    sessionId?: string;
    limit?: number;
  }): RevocationLogEntry[] {
    const limit = Math.min(Math.max(filters.limit ?? 100, 1), 500);
    const out: RevocationLogEntry[] = [];
    for (let i = this.revocations.length - 1; i >= 0 && out.length < limit; i -= 1) {
      const row = this.revocations[i]!;
      if (filters.userId && row.userId !== filters.userId) continue;
      if (filters.sessionId && row.sessionId !== filters.sessionId) continue;
      out.push(row);
    }
    return out;
  }

  clear(): void {
    this.sessions.clear();
    this.revocations.length = 0;
  }
}

let defaultStore: MemorySessionStore | null = null;

export function getDefaultSessionStore(): MemorySessionStore {
  if (!defaultStore) defaultStore = new MemorySessionStore();
  return defaultStore;
}

export function resetDefaultSessionStore(): void {
  getDefaultSessionStore().clear();
}
