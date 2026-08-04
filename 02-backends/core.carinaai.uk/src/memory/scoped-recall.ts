/**
 * Tenant-safe answers for "what do you remember?" style prompts.
 * Never dump global episodic_memories; that table is shared across hosted Aiva workspaces.
 */
import { getWorkerSessionContext } from '../workers/worker-session-context.js';
import { listWorkerPersistentFacts } from './aiva/worker-persistent-memory.js';
import { listPersistentFacts } from './persistent-memory.js';
import { getSessionHistory } from './store.js';

function bulletList(lines: string[]): string {
  return lines.map((line) => `- ${line}`).join('\n');
}

/**
 * Build a user-facing memory recall string scoped to the active session / worker.
 * Returns curated durable facts only; never other tenants' chat transcripts.
 */
export async function formatScopedMemoryRecall(sessionId: string): Promise<string> {
  const workerCtx = getWorkerSessionContext(sessionId);
  if (workerCtx) {
    const contactId = workerCtx.contactId ?? null;
    const [user, memory] = await Promise.all([
      listWorkerPersistentFacts({
        workspaceId: workerCtx.worker.workspaceId,
        workerId: workerCtx.worker.id,
        target: 'user',
        contactId,
      }),
      listWorkerPersistentFacts({
        workspaceId: workerCtx.worker.workspaceId,
        workerId: workerCtx.worker.id,
        target: 'memory',
      }),
    ]);
    const lines = [
      ...user.map((f) => f.content.trim()),
      ...memory.map((f) => f.content.trim()),
    ].filter(Boolean);
    if (lines.length === 0) {
      return 'I checked durable memory for this contact and nothing is stored yet.';
    }
    return `What I remember for you:\n${bulletList(lines)}`;
  }

  const [userFacts, agentNotes] = await Promise.all([
    listPersistentFacts('user'),
    listPersistentFacts('memory'),
  ]);
  const curated = [
    ...userFacts.map((f) => f.content.trim()),
    ...agentNotes.map((f) => f.content.trim()),
  ].filter(Boolean);
  if (curated.length > 0) {
    return `What I remember for you:\n${bulletList(curated)}`;
  }

  const history = await getSessionHistory(sessionId, 12);
  const userTurns = history
    .filter((m) => m.role === 'user')
    .map((m) => m.content.trim())
    .filter((c) => c.length > 0 && c.length < 400)
    .slice(-5);
  if (userTurns.length === 0) {
    return 'I checked memory and nothing durable is stored for this session yet.';
  }
  return `From this session only:\n${bulletList(userTurns)}`;
}
