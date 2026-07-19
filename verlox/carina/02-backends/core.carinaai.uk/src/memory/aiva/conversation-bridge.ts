import { getSessionHistory, saveMemory } from '../store.js';
import { listEmployeeThreadMessages } from '../../aiva/employee-comms.js';
import type { AivaChannelName } from '../../channels/types.js';
import { config } from '../../config/index.js';

export type BridgedTurn = {
  role: 'user' | 'assistant';
  content: string;
};

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
}): Promise<{ hydrated: number; source: 'episodic' | 'employee_thread' | 'none' }> {
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

  let messages: Array<{ sender: string; content: string }> = [];
  try {
    const listed = await listEmployeeThreadMessages(opts.workspaceId, opts.workerId, {
      contactId: opts.contactId,
      channel: opts.channel,
      limit: 40,
    });
    messages = listed.messages;
  } catch {
    return { hydrated: 0, source: 'none' };
  }
  if (messages.length === 0) return { hydrated: 0, source: 'none' };

  const current = (opts.currentUserMessage ?? '').trim();
  const prior = [...messages];
  if (current) {
    for (let i = prior.length - 1; i >= 0; i -= 1) {
      const msg = prior[i];
      if (msg?.sender === 'user' && String(msg.content).trim() === current) {
        prior.splice(i, 1);
        break;
      }
    }
  }

  let hydrated = 0;
  for (const msg of prior) {
    const content = String(msg.content ?? '').trim();
    if (!content) continue;
    if (msg.sender === 'user') {
      await saveMemory(opts.sessionId, 'user', content);
      hydrated += 1;
    } else if (msg.sender === 'employee') {
      await saveMemory(opts.sessionId, 'assistant', content);
      hydrated += 1;
    }
  }
  return {
    hydrated,
    source: hydrated > 0 ? 'employee_thread' : 'none',
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
  source: 'episodic' | 'employee_thread' | 'none';
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

  if (episodic.length > 0) {
    return {
      episodicCount: episodic.length,
      threadCount: thread.length,
      source: 'episodic',
      turns: episodic.slice(-limit),
      continuationHint:
        'Continuing an existing conversation. Do not re-introduce yourself. '
        + 'Carry prior context forward unless the user asks to start fresh (/new).',
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
