import { clearSession, getSessionHistory } from '../store.js';
import {
  addWorkerPersistentFact,
  listWorkerPersistentFacts,
  removeWorkerPersistentFact,
  getWorkerMemoryBudgetStatus,
} from './worker-persistent-memory.js';
import { searchWorkerConversations } from './conversation-search.js';
import { describeExternalMemoryForStatus } from './external-provider.js';
import {
  addPersistentFact,
  listPersistentFacts,
  removePersistentFact,
  getMemoryBudgetStatus,
  type MemoryTarget,
} from '../persistent-memory.js';
import { forceImmediateInvalidation } from '../../brain/prompt-cache.js';

export function aivaSessionId(workerId: string, channel: string, contactId: string): string {
  return `aiva-${workerId}-${channel}-${contactId}`;
}

export async function formatWorkerMemoryStatus(opts: {
  workspaceId: string;
  workerId: string;
  contactId?: string | null;
}): Promise<string> {
  const contactId = opts.contactId ?? null;
  const [user, memory, userBudget, memoryBudget] = await Promise.all([
    listWorkerPersistentFacts({
      workspaceId: opts.workspaceId,
      workerId: opts.workerId,
      target: 'user',
      contactId,
    }),
    listWorkerPersistentFacts({
      workspaceId: opts.workspaceId,
      workerId: opts.workerId,
      target: 'memory',
    }),
    getWorkerMemoryBudgetStatus({
      workspaceId: opts.workspaceId,
      workerId: opts.workerId,
      target: 'user',
      contactId,
    }),
    getWorkerMemoryBudgetStatus({
      workspaceId: opts.workspaceId,
      workerId: opts.workerId,
      target: 'memory',
    }),
  ]);

  const lines = [
    'Durable memory (clear split)',
    '',
    `USER PROFILE [${userBudget.percent}% — ${userBudget.used}/${userBudget.max}]`,
    ...(user.length ? user.map((f) => `- [${f.id.slice(0, 8)}] ${f.content}`) : ['(empty)']),
    '',
    `MEMORY / notes [${memoryBudget.percent}% — ${memoryBudget.used}/${memoryBudget.max}]`,
    ...(memory.length ? memory.map((f) => `- [${f.id.slice(0, 8)}] ${f.content}`) : ['(empty)']),
    '',
    describeExternalMemoryForStatus(),
    '',
    'Commands: /remember <text> | /forget <id|text> | /search <query> | /new | /clear',
  ];
  return lines.join('\n');
}

export async function rememberForWorker(opts: {
  workspaceId: string;
  workerId: string;
  contactId?: string | null;
  text: string;
  target?: 'user' | 'memory';
}): Promise<string> {
  const content = opts.text.trim();
  if (!content) return 'Usage: /remember <text>  (optional prefix: user: or memory:)';
  let target: 'user' | 'memory' = opts.target ?? 'user';
  let body = content;
  if (/^user:\s*/i.test(body)) {
    target = 'user';
    body = body.replace(/^user:\s*/i, '');
  } else if (/^memory:\s*/i.test(body)) {
    target = 'memory';
    body = body.replace(/^memory:\s*/i, '');
  }
  const fact = await addWorkerPersistentFact({
    workspaceId: opts.workspaceId,
    workerId: opts.workerId,
    target,
    content: body,
    contactId: opts.contactId,
  });
  return `Saved to ${target}: ${fact.content}`;
}

export async function forgetForWorker(opts: {
  workspaceId: string;
  workerId: string;
  idOrText: string;
}): Promise<string> {
  const needle = opts.idOrText.trim();
  if (!needle) return 'Usage: /forget <id or unique text substring>';
  const result = await removeWorkerPersistentFact({
    workspaceId: opts.workspaceId,
    workerId: opts.workerId,
    idOrText: needle,
  });
  if (result.removed === 0) return `No memory matched "${needle}".`;
  return `Removed ${result.removed} entr${result.removed === 1 ? 'y' : 'ies'}.`;
}

export async function searchForWorker(opts: {
  workspaceId: string;
  workerId: string;
  query: string;
}): Promise<string> {
  const query = opts.query.trim();
  if (!query) return 'Usage: /search <query>';
  const hits = await searchWorkerConversations({
    workspaceId: opts.workspaceId,
    workerId: opts.workerId,
    query,
    limit: 8,
  });
  if (hits.length === 0) return `No conversation matches for "${query}".`;
  return [
    `Search results for "${query}":`,
    ...hits.map((hit, i) => {
      const src = hit.source === 'episodic' ? 'episodic' : 'thread';
      return `${i + 1}. [${src}] ${hit.content}`;
    }),
  ].join('\n');
}

export async function clearAivaConversation(opts: {
  workerId: string;
  channel: string;
  contactId: string;
}): Promise<string> {
  const sessionId = aivaSessionId(opts.workerId, opts.channel, opts.contactId);
  await clearSession(sessionId);
  forceImmediateInvalidation(sessionId);
  return 'Conversation context cleared. Durable USER/MEMORY notes were kept. Use /forget to remove those.';
}

export async function statusAivaConversation(opts: {
  workspaceId: string;
  workerId: string;
  channel: string;
  contactId: string;
}): Promise<{ episodicTurns: number; sessionId: string }> {
  const sessionId = aivaSessionId(opts.workerId, opts.channel, opts.contactId);
  const history = await getSessionHistory(sessionId, 50).catch(() => []);
  return { episodicTurns: history.length, sessionId };
}

export async function formatCoreMemoryStatus(): Promise<string> {
  const [user, memory, userBudget, memoryBudget] = await Promise.all([
    listPersistentFacts('user'),
    listPersistentFacts('memory'),
    getMemoryBudgetStatus('user'),
    getMemoryBudgetStatus('memory'),
  ]);
  return [
    'Durable memory (clear split)',
    '',
    `USER PROFILE [${userBudget.percent}% — ${userBudget.used}/${userBudget.max}]`,
    ...(user.length ? user.map((f) => `- [${f.id.slice(0, 8)}] ${f.content}`) : ['(empty)']),
    '',
    `MEMORY / notes [${memoryBudget.percent}% — ${memoryBudget.used}/${memoryBudget.max}]`,
    ...(memory.length ? memory.map((f) => `- [${f.id.slice(0, 8)}] ${f.content}`) : ['(empty)']),
    '',
    'Commands: /remember <text> | /forget <id|text> | /search <query> | /new | /clear',
  ].join('\n');
}

export async function rememberForCore(text: string, target: MemoryTarget = 'user'): Promise<string> {
  let resolvedTarget = target;
  let body = text.trim();
  if (!body) return 'Usage: /remember <text>  (optional prefix: user: or memory:)';
  if (/^user:\s*/i.test(body)) {
    resolvedTarget = 'user';
    body = body.replace(/^user:\s*/i, '');
  } else if (/^memory:\s*/i.test(body)) {
    resolvedTarget = 'memory';
    body = body.replace(/^memory:\s*/i, '');
  }
  const fact = await addPersistentFact(resolvedTarget, body);
  if (!fact) return 'Memory write was blocked.';
  return `Saved to ${resolvedTarget}: ${fact.content}`;
}

export async function forgetForCore(idOrText: string): Promise<string> {
  const needle = idOrText.trim();
  if (!needle) return 'Usage: /forget <id or unique text substring>';
  const all = [
    ...(await listPersistentFacts('user')),
    ...(await listPersistentFacts('memory')),
  ];
  const byId = all.find((f) => f.id === needle || f.id.startsWith(needle));
  if (byId) {
    await removePersistentFact(byId.target, byId.content);
    return `Removed: ${byId.content}`;
  }
  const matches = all.filter((f) => f.content.toLowerCase().includes(needle.toLowerCase()));
  if (matches.length === 0) return `No memory matched "${needle}".`;
  if (matches.length > 1) return `Multiple matches for "${needle}". Be more specific or use the id.`;
  await removePersistentFact(matches[0]!.target, matches[0]!.content);
  return `Removed: ${matches[0]!.content}`;
}
