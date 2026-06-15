import {
  getActiveProfileOrDefault,
  operatorMemoryScope,
  wrapSessionForProfile,
} from '../profiles/isolation.js';
import {
  generateSessionId,
  getLineageRoot,
  lineageRelatedSessionIds,
  recordNewSession,
  recordSessionContinuation,
} from './session-lineage.js';

export { operatorMemoryScope as searchMemoryScope };

/** Normalize a session id for episodic storage (profile-prefixed when not default). */
export function storageSessionId(sessionId: string): string {
  const profile = getActiveProfileOrDefault();
  if (profile === 'default') return sessionId;
  return wrapSessionForProfile(profile, sessionId);
}

/** Allocate a gateway session id and record it in lineage store. */
export function allocateGatewaySession(parentSessionId?: string): string {
  const sessionId = storageSessionId(generateSessionId());
  recordNewSession(sessionId);
  if (parentSessionId) {
    recordSessionContinuation(sessionId, storageSessionId(parentSessionId));
  }
  return sessionId;
}

/** Record a child session (e.g. subagent) under an existing parent. */
export function trackChildSession(childSessionId: string, parentSessionId: string): void {
  const child = storageSessionId(childSessionId);
  const parent = storageSessionId(parentSessionId);
  recordNewSession(child);
  recordSessionContinuation(child, parent);
}

export { getLineageRoot, lineageRelatedSessionIds };
