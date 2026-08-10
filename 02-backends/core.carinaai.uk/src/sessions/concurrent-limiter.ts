/**
 * Concurrent session limit enforcement.
 */
import type { AuthSession, ConcurrentLimitPolicy, SessionConfig } from './types.js';

const projectLimits = new Map<string, number>();

export function setMaxConcurrent(project: string, limit: number): void {
  if (!project || !(limit > 0)) return;
  projectLimits.set(project, Math.floor(limit));
}

export function getMaxConcurrent(config: SessionConfig): number {
  if (config.project && projectLimits.has(config.project)) {
    return projectLimits.get(config.project)!;
  }
  return config.maxConcurrent;
}

export function getConcurrentCount(sessions: AuthSession[]): number {
  return sessions.filter((s) => !s.revokedAt).length;
}

export type EnforceResult =
  | { allowed: true; killedSessionIds: string[] }
  | { allowed: false; killedSessionIds: string[]; reason: 'blocked_at_limit' };

/**
 * Given active (non-revoked) sessions for a user, decide whether a new login
 * may proceed and which existing sessions must die.
 */
export function enforceConcurrentLimit(
  activeSessions: AuthSession[],
  config: SessionConfig,
  policy?: ConcurrentLimitPolicy,
): EnforceResult {
  const max = getMaxConcurrent(config);
  const onLimit = policy ?? config.onLimit;
  const live = activeSessions
    .filter((s) => !s.revokedAt)
    .slice()
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));

  if (live.length < max) {
    return { allowed: true, killedSessionIds: [] };
  }

  if (onLimit === 'block_new') {
    return { allowed: false, killedSessionIds: [], reason: 'blocked_at_limit' };
  }

  // Kill oldest until there is room for one new session.
  const overflow = live.length - max + 1;
  const killedSessionIds = live.slice(0, Math.max(overflow, 0)).map((s) => s.sessionId);
  return { allowed: true, killedSessionIds };
}

export function clearProjectLimitsForTests(): void {
  projectLimits.clear();
}
