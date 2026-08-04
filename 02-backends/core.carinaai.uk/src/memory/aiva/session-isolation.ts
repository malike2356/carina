/**
 * Multi-tenant isolation helpers for Aiva episodic / session-search scopes.
 * Session ids are shaped: aiva-<workerUuid>-<channel|contact|conv>-...
 */

const WORKER_UUID =
  /^aiva-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})-/i;

export function isAivaSessionId(sessionId: string): boolean {
  return sessionId.trim().startsWith('aiva-');
}

/** Extract worker UUID from an Aiva session id, or null if malformed. */
export function parseAivaWorkerIdFromSession(sessionId: string): string | null {
  const match = WORKER_UUID.exec(sessionId.trim());
  return match?.[1] ?? null;
}

export function aivaWorkerSessionPrefix(workerId: string): string {
  return `aiva-${workerId}-`;
}

/** SQL scope: only episodic rows belonging to this worker. */
export function aivaWorkerMemoryScope(workerId: string): { sql: string; params: unknown[] } {
  return {
    sql: 'session_id LIKE $1',
    params: [`${aivaWorkerSessionPrefix(workerId)}%`],
  };
}

export function sessionBelongsToAivaWorker(sessionId: string, workerId: string): boolean {
  return sessionId.startsWith(aivaWorkerSessionPrefix(workerId));
}
