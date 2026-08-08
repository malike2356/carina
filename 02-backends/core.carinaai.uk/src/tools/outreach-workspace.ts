import { getWorkerSessionContext } from '../workers/worker-session-context.js';

/**
 * Resolve outreach access from the authenticated worker session.
 * An explicit workspace may confirm scope, but can never change it.
 */
export function resolveOutreachWorkspaceId(sessionId: string, explicit?: unknown): string {
  const context = getWorkerSessionContext(sessionId);
  const workspaceId = context?.worker.workspaceId?.trim() ?? '';
  if (!workspaceId) return '';

  const requested = typeof explicit === 'string' ? explicit.trim() : '';
  if (requested && requested !== workspaceId) return '';
  return workspaceId;
}
