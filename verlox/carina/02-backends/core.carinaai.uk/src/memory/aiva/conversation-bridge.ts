import { getSessionHistory, saveMemory } from '../store.js';
import { listEmployeeThreadMessages } from '../../aiva/employee-comms.js';
import type { AivaChannelName } from '../../channels/types.js';
import { config } from '../../config/index.js';
import { pool } from '../db.js';

export type BridgedTurn = {
  role: 'user' | 'assistant';
  content: string;
};

function mergeTurns(limit: number, ...groups: BridgedTurn[][]): BridgedTurn[] {
  const seen = new Set<string>();
  const merged: BridgedTurn[] = [];
  for (const group of groups) {
    for (const turn of group) {
      const content = turn.content.trim();
      if (!content) continue;
      const key = `${turn.role}:${content}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push({ role: turn.role, content });
    }
  }
  return merged.slice(-limit);
}

async function listRecentWorkerEpisodicTurns(opts: {
  workerId: string;
  excludeSessionId?: string;
  limit: number;
}): Promise<BridgedTurn[]> {
  const prefix = `aiva-${opts.workerId}-`;
  const result = await pool.query(
    `SELECT role, content
     FROM (
       SELECT role, content, created_at
       FROM episodic_memories
       WHERE session_id LIKE $1
         AND session_id <> $2
         AND role IN ('user', 'assistant')
       ORDER BY created_at DESC
       LIMIT $3
     ) recent
     ORDER BY created_at ASC`,
    [`${prefix}%`, opts.excludeSessionId ?? '', opts.limit],
  );
  return result.rows
    .map((row) => ({
      role: String(row.role) as 'user' | 'assistant',
      content: String(row.content ?? '').trim(),
    }))
    .filter((turn) => turn.content.length > 0);
}

/**
 * When episodic history is empty but the employee UI thread has messages,
 * copy prior turns into episodic memory so buildContext / session-search see them.
 * Skips the trailing user message when it matches the current turn (already persisted to the UI).
 */
export async function hydrateEpisodicFromEmployeeThread(opts: {
  sessionId: string;
  workspaceId: string;
  workerId: string;
  contactId: string;
  channel: AivaChannelName;
  currentUserMessage?: string;
}): Promise<{ hydrated: number; source: 'episodic' | 'employee_thread' | 'worker_recent' | 'none' }> {
  let episodicCount = 0;
  try {
    const history = await getSessionHistory(opts.sessionId, 5);
    episodicCount = history.length;
  } catch {
    episodicCount = 0;
  }
  if (episodicCount > 0) {
    return { hydrated: 0, source: 'episodic' };
  }

  let turns: BridgedTurn[] = [];
  try {
    const listed = await listEmployeeThreadMessages(opts.workspaceId, opts.workerId, {
      contactId: opts.contactId,
      channel: opts.channel,
      limit: 40,
    });
    turns = listed.messages
      .filter((msg) => msg.sender === 'user' || msg.sender === 'employee')
      .map((msg) => ({
        role: (msg.sender === 'employee' ? 'assistant' : 'user') as 'user' | 'assistant',
        content: String(msg.content ?? '').trim(),
      }))
      .filter((turn) => turn.content.length > 0);
  } catch {
    turns = [];
  }
  let source: 'employee_thread' | 'worker_recent' = 'employee_thread';

  if (turns.length === 0) {
    try {
      turns = await listRecentWorkerEpisodicTurns({
        workerId: opts.workerId,
        excludeSessionId: opts.sessionId,
        limit: 40,
      });
      source = 'worker_recent';
    } catch {
      turns = [];
    }
  }
  if (turns.length === 0) return { hydrated: 0, source: 'none' };

  const current = (opts.currentUserMessage ?? '').trim();
  const prior = [...turns];
  if (current) {
    for (let i = prior.length - 1; i >= 0; i -= 1) {
      const turn = prior[i];
      if (turn?.role === 'user' && turn.content.trim() === current) {
        prior.splice(i, 1);
        break;
      }
    }
  }

  let hydrated = 0;
  for (const turn of prior) {
    const content = turn.content.trim();
    if (!content) continue;
    await saveMemory(opts.sessionId, turn.role, content);
    hydrated += 1;
  }
  return {
    hydrated,
    source: hydrated > 0 ? source : 'none',
  };
}

/**
 * Build conversation context metadata for an Aiva turn.
 */
export async function resolveAivaConversationBridge(opts: {
  sessionId: string;
  workspaceId: string;
  workerId: string;
  contactId: string;
  channel: AivaChannelName;
  limit?: number;
}): Promise<{
  episodicCount: number;
  threadCount: number;
  source: 'episodic' | 'employee_thread' | 'worker_recent' | 'none';
  turns: BridgedTurn[];
  continuationHint: string;
}> {
  const limit = Math.min(
    Math.max(opts.limit ?? config.carina.maxMemoryContext ?? 20, 1),
    40,
  );

  let episodic: BridgedTurn[] = [];
  try {
    const history = await getSessionHistory(opts.sessionId, limit);
    episodic = history
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: String(m.content ?? '').trim(),
      }))
      .filter((m) => m.content.length > 0);
  } catch {
    episodic = [];
  }

  let thread: BridgedTurn[] = [];
  try {
    const listed = await listEmployeeThreadMessages(opts.workspaceId, opts.workerId, {
      contactId: opts.contactId,
      channel: opts.channel,
      limit,
    });
    thread = listed.messages
      .filter((m) => m.sender === 'user' || m.sender === 'employee')
      .map((m) => ({
        role: (m.sender === 'employee' ? 'assistant' : 'user') as 'user' | 'assistant',
        content: String(m.content ?? '').trim(),
      }))
      .filter((m) => m.content.length > 0);
  } catch {
    thread = [];
  }

  let workerRecent: BridgedTurn[] = [];
  try {
    workerRecent = await listRecentWorkerEpisodicTurns({
      workerId: opts.workerId,
      excludeSessionId: opts.sessionId,
      limit,
    });
  } catch {
    workerRecent = [];
  }

  if (episodic.length > 0) {
    const turns = mergeTurns(limit, workerRecent, thread, episodic);
    return {
      episodicCount: episodic.length,
      threadCount: thread.length,
      source: workerRecent.length > 0 || thread.length > episodic.length
        ? 'worker_recent'
        : 'episodic',
      turns,
      continuationHint:
        'Continuing an existing cross-channel Aiva conversation. Do not re-introduce yourself. '
        + 'Carry prior context forward from Telegram, web, email, and other connected channels unless the user asks to start fresh (/new).',
    };
  }

  if (thread.length > 0) {
    return {
      episodicCount: 0,
      threadCount: thread.length,
      source: 'employee_thread',
      turns: thread.slice(-limit),
      continuationHint:
        'Conversation history was recovered from the durable employee thread '
        + '(episodic store was empty). Do not re-introduce yourself.',
    };
  }

  if (workerRecent.length > 0) {
    return {
      episodicCount: 0,
      threadCount: thread.length,
      source: 'worker_recent',
      turns: workerRecent.slice(-limit),
      continuationHint:
        'Recent conversation history was recovered from this Aiva across another connected channel. '
        + 'Treat this as the same ongoing relationship and do not re-introduce yourself.',
    };
  }

  return {
    episodicCount: 0,
    threadCount: 0,
    source: 'none',
    turns: [],
    continuationHint: '',
  };
}

export function formatBridgeHistoryForPrompt(turns: BridgedTurn[], maxChars = 12_000): string {
  if (turns.length === 0) return '';
  const lines = turns.map((t) => `${t.role}: ${t.content}`);
  let joined = lines.join('\n');
  if (joined.length > maxChars) {
    joined = joined.slice(joined.length - maxChars);
    const firstNl = joined.indexOf('\n');
    if (firstNl > 0) joined = joined.slice(firstNl + 1);
  }
  return `Recent conversation history (${turns.length} turns):\n${joined}`;
}
