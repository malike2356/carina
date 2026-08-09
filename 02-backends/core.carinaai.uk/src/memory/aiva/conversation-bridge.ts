import { getSessionHistory, saveMemory } from '../store.js';
import { listEmployeeThreadMessages } from '../../aiva/employee-comms.js';
import type { AivaChannelName } from '../../channels/types.js';
import { config } from '../../config/index.js';
import { pool } from '../db.js';
import {
  countConversationTurns,
  DEFAULT_SUMMARIZATION_CONFIG,
  formatSummaryPrefix,
  loadThreadSummaries,
  SUMMARY_CHAR_BUDGET,
  triggerSummarizeThread,
} from './thread-summarizer.js';

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
  contactId?: string;
  linkedContactIds?: string[];
  excludeSessionId?: string;
  conversationId?: string;
  limit: number;
}): Promise<BridgedTurn[]> {
  const contactIds = [
    ...new Set(
      [
        ...(opts.linkedContactIds ?? []),
        opts.contactId,
      ].filter((id): id is string => Boolean(id && id.trim())),
    ),
  ];
  if (contactIds.length === 0 && !opts.conversationId) return [];

  // Prefer pinned conv-* sessions. Legacy contact-* session ids without pinning
  // used to also expand every channel wildcard and flood the bridge with
  // unrelated history (and blow the episodic write rate limit after /clear).
  const sessionIds = new Set<string>();
  if (opts.conversationId) {
    sessionIds.add(`aiva-${opts.workerId}-conv-${opts.conversationId}`);
  }

  // Other pinned conversation sessions for these contacts (linked channels).
  if (contactIds.length > 0) {
    try {
      const pinned = await pool.query<{ conversation_id: string }>(
        `SELECT conversation_id::text AS conversation_id
         FROM channel_threads
         WHERE worker_id = $1
           AND contact_id = ANY($2::text[])
           AND conversation_id IS NOT NULL`,
        [opts.workerId, contactIds],
      );
      for (const row of pinned.rows) {
        if (row.conversation_id) {
          sessionIds.add(`aiva-${opts.workerId}-conv-${row.conversation_id}`);
        }
      }
    } catch {
      // pinning columns may not exist yet
    }
  }

  // Legacy fallback only when no pinned conversation exists yet.
  // Exact canonical contact session ids only; channel wildcards caused cross-thread bleed.
  if (sessionIds.size === 0) {
    for (const contactId of contactIds) {
      sessionIds.add(`aiva-${opts.workerId}-contact-${contactId}`);
    }
  }

  sessionIds.delete(opts.excludeSessionId ?? '');
  const ids = [...sessionIds];
  if (ids.length === 0) return [];

  // Only recent turns: prevents ancient cross-thread contamination.
  const result = await pool.query(
    `SELECT role, content
     FROM (
       SELECT role, content, created_at
       FROM episodic_memories
       WHERE session_id = ANY($1::text[])
         AND role IN ('user', 'assistant')
         AND created_at > NOW() - INTERVAL '4 hours'
       ORDER BY created_at DESC
       LIMIT $2
     ) recent
     ORDER BY created_at ASC`,
    [ids, opts.limit],
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
  linkedContactIds?: string[];
  conversationId?: string;
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
  // Do not copy worker_recent into episodic. That path re-imported legacy
  // contact-* history after /clear, burned the write rate limit, and then
  // silently dropped new user/assistant turns (continuity death).
  if (turns.length === 0) return { hydrated: 0, source: 'none' };
  const source: 'employee_thread' = 'employee_thread';

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
  linkedContactIds?: string[];
  conversationId?: string;
  sessionEpoch?: number;
  limit?: number;
}): Promise<{
  episodicCount: number;
  threadCount: number;
  source: 'episodic' | 'employee_thread' | 'worker_recent' | 'none';
  turns: BridgedTurn[];
  continuationHint: string;
  summaryPrefix: string;
}> {
  const sessionEpoch = opts.sessionEpoch ?? 1;
  const keepRecent = DEFAULT_SUMMARIZATION_CONFIG.windowKeepRecent;
  const limit = Math.min(
    Math.max(opts.limit ?? config.carina.maxMemoryContext ?? 20, 1),
    40,
  );

  async function withSummary(
    base: {
      episodicCount: number;
      threadCount: number;
      source: 'episodic' | 'employee_thread' | 'worker_recent' | 'none';
      turns: BridgedTurn[];
      continuationHint: string;
    },
  ): Promise<{
    episodicCount: number;
    threadCount: number;
    source: 'episodic' | 'employee_thread' | 'worker_recent' | 'none';
    turns: BridgedTurn[];
    continuationHint: string;
    summaryPrefix: string;
  }> {
    let summaryPrefix = '';
    let turns = base.turns;
    if (opts.conversationId) {
      const totalTurns = await countConversationTurns(opts.conversationId).catch(
        () => Math.max(base.episodicCount, base.turns.length),
      );
      // Non-blocking: compress older turns if the thread crossed the threshold.
      triggerSummarizeThread({
        conversationId: opts.conversationId,
        sessionEpoch,
        totalTurns,
      });
      const summaries = await loadThreadSummaries({
        conversationId: opts.conversationId,
        sessionEpoch,
      }).catch(() => [] as string[]);
      summaryPrefix = formatSummaryPrefix(summaries);
      if (summaryPrefix && turns.length > keepRecent) {
        turns = turns.slice(-keepRecent);
      }
    }
    return { ...base, turns, summaryPrefix };
  }

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
  const linked = (opts.linkedContactIds?.length ?? 0) > 1;
  if (linked) {
    try {
      workerRecent = await listRecentWorkerEpisodicTurns({
        workerId: opts.workerId,
        contactId: opts.contactId,
        linkedContactIds: opts.linkedContactIds,
        excludeSessionId: opts.sessionId,
        conversationId: opts.conversationId,
        limit,
      });
    } catch {
      workerRecent = [];
    }
  }

  if (episodic.length > 0) {
    // Web chat UI is the employee thread. Prefer that when unlinked so the model
    // does not answer from older episodic junk the user cannot see.
    if (opts.channel === 'web' && !linked && thread.length > 0) {
      return withSummary({
        episodicCount: episodic.length,
        threadCount: thread.length,
        source: 'employee_thread',
        turns: thread.slice(-limit),
        continuationHint:
          'Continue this web conversation. Answer from the visible chat history. '
          + 'Do not re-introduce yourself or invent earlier topics that are not in this thread.',
      });
    }

    const turns = linked
      ? mergeTurns(limit, workerRecent, thread, episodic)
      : mergeTurns(limit, thread, episodic);
    return withSummary({
      episodicCount: episodic.length,
      threadCount: thread.length,
      source: linked && workerRecent.length > 0 ? 'worker_recent' : 'episodic',
      turns,
      continuationHint: linked
        ? 'Continuing an existing cross-channel Aiva conversation. Do not re-introduce yourself. '
          + 'Carry prior context forward from linked channels unless the user asks to start fresh (/new).'
        : 'Continue this conversation. Do not re-introduce yourself.',
    });
  }

  if (thread.length > 0) {
    return withSummary({
      episodicCount: 0,
      threadCount: thread.length,
      source: 'employee_thread',
      turns: thread.slice(-limit),
      continuationHint:
        'Conversation history was recovered from the durable employee thread '
        + '(episodic store was empty). Do not re-introduce yourself.',
    });
  }

  if (workerRecent.length > 0) {
    return withSummary({
      episodicCount: 0,
      threadCount: thread.length,
      source: 'worker_recent',
      turns: workerRecent.slice(-limit),
      continuationHint:
        'Recent conversation history was recovered from this Aiva across a linked channel. '
        + 'Treat this as the same ongoing relationship and do not re-introduce yourself.',
    });
  }

  return withSummary({
    episodicCount: 0,
    threadCount: 0,
    source: 'none',
    turns: [],
    continuationHint: '',
  });
}

export function formatBridgeHistoryForPrompt(
  turns: BridgedTurn[],
  maxChars = 12_000,
  options?: { summaryPrefix?: string },
): string {
  const summaryRaw = (options?.summaryPrefix ?? '').trim();
  let summaryBlock = '';
  if (summaryRaw) {
    summaryBlock = summaryRaw.length > SUMMARY_CHAR_BUDGET
      ? `${summaryRaw.slice(0, SUMMARY_CHAR_BUDGET - 3)}...`
      : summaryRaw;
  }

  const historyBudget = summaryBlock
    ? Math.max(maxChars - SUMMARY_CHAR_BUDGET, 1000)
    : maxChars;

  if (turns.length === 0) {
    return summaryBlock;
  }

  const lines = turns.map((t) => `${t.role}: ${t.content}`);
  let joined = lines.join('\n');
  if (joined.length > historyBudget) {
    joined = joined.slice(joined.length - historyBudget);
    const firstNl = joined.indexOf('\n');
    if (firstNl > 0) joined = joined.slice(firstNl + 1);
  }
  const history = `Recent conversation history (${turns.length} turns):\n${joined}`;
  return summaryBlock ? `${summaryBlock}\n\n${history}` : history;
}
