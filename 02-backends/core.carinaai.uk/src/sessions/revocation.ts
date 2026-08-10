/**
 * Instant session revocation + audit log.
 */
import { randomUUID } from 'node:crypto';
import type { AuthSession, RevocationLogEntry, RevocationReason } from './types.js';
import type { SessionStore } from './session-store.js';

export function appendRevocationLog(
  store: SessionStore,
  entry: Omit<RevocationLogEntry, 'id' | 'timestamp'> & { id?: string; timestamp?: string },
): RevocationLogEntry {
  const row: RevocationLogEntry = {
    id: entry.id ?? randomUUID(),
    timestamp: entry.timestamp ?? new Date().toISOString(),
    userId: entry.userId,
    sessionId: entry.sessionId,
    reason: entry.reason,
    initiatedBy: entry.initiatedBy,
    meta: entry.meta,
  };
  store.appendRevocation(row);
  return row;
}

export function revokeSession(
  store: SessionStore,
  sessionId: string,
  reason: RevocationReason | string,
  initiatedBy: string = 'user',
): AuthSession | null {
  const session = store.get(sessionId);
  if (!session || session.revokedAt) return null;
  const updated = store.markRevoked(sessionId, reason);
  if (updated) {
    appendRevocationLog(store, {
      userId: updated.userId,
      sessionId,
      reason,
      initiatedBy,
    });
  }
  return updated;
}

export function revokeAllSessions(
  store: SessionStore,
  userId: string,
  reason: RevocationReason | string,
  initiatedBy: string = 'system',
  exceptSessionId?: string | null,
): { count: number; sessionIds: string[] } {
  const sessions = store.listByUser(userId).filter((s) => !s.revokedAt);
  const sessionIds: string[] = [];
  for (const s of sessions) {
    if (exceptSessionId && s.sessionId === exceptSessionId) continue;
    const updated = store.markRevoked(s.sessionId, reason);
    if (updated) {
      sessionIds.push(s.sessionId);
      appendRevocationLog(store, {
        userId,
        sessionId: s.sessionId,
        reason,
        initiatedBy,
      });
    }
  }
  return { count: sessionIds.length, sessionIds };
}

/** Password change MUST revoke every session immediately (including current). */
export function revokeOnPasswordChange(store: SessionStore, userId: string): { count: number; sessionIds: string[] } {
  return revokeAllSessions(store, userId, 'password_changed', 'system');
}

/** Role/permission change forces re-login. */
export function revokeOnRoleChange(store: SessionStore, userId: string): { count: number; sessionIds: string[] } {
  return revokeAllSessions(store, userId, 'role_changed', 'system');
}

export function getRevocationLog(
  store: SessionStore,
  filters: { userId?: string; sessionId?: string; limit?: number } = {},
): RevocationLogEntry[] {
  return store.searchRevocations(filters);
}
