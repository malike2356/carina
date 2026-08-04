/**
 * Keep unlinked web chat episodic memory aligned with the visible employee thread.
 * Prevents the model from answering from older hydrated sessions the UI does not show.
 */
import { clearSession, getSessionHistory, saveMemory } from '../store.js';
import { listEmployeeThreadMessages } from '../../aiva/employee-comms.js';
import type { AivaChannelName } from '../../channels/types.js';
import { forceImmediateInvalidation } from '../../brain/prompt-cache.js';

function normalize(content: string): string {
  return content.trim().replace(/\s+/g, ' ').toLowerCase();
}

export async function realignWebEpisodicToEmployeeThread(opts: {
  sessionId: string;
  workspaceId: string;
  workerId: string;
  contactId: string;
  channel: AivaChannelName;
}): Promise<{ realigned: boolean; reason: string }> {
  if (opts.channel !== 'web') {
    return { realigned: false, reason: 'not_web' };
  }

  let threadTurns: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  try {
    const listed = await listEmployeeThreadMessages(opts.workspaceId, opts.workerId, {
      contactId: opts.contactId,
      channel: opts.channel,
      limit: 80,
    });
    threadTurns = listed.messages
      .filter((msg) => msg.sender === 'user' || msg.sender === 'employee')
      .map((msg) => ({
        role: (msg.sender === 'employee' ? 'assistant' : 'user') as 'user' | 'assistant',
        content: String(msg.content ?? '').trim(),
      }))
      .filter((turn) => turn.content.length > 0);
  } catch {
    return { realigned: false, reason: 'thread_unavailable' };
  }

  if (threadTurns.length === 0) {
    return { realigned: false, reason: 'empty_thread' };
  }

  let episodic: Array<{ role: string; content: string }> = [];
  try {
    const history = await getSessionHistory(opts.sessionId, 80);
    episodic = history
      .map((row) => ({
        role: String(row.role ?? ''),
        content: String(row.content ?? ''),
      }))
      .filter((row) => row.role.length > 0);
  } catch {
    episodic = [];
  }

  const threadKeys = new Set(
    threadTurns.map((turn) => `${turn.role}:${normalize(turn.content)}`),
  );
  const episodicUserAssistant = episodic.filter(
    (row) => row.role === 'user' || row.role === 'assistant',
  );
  const orphanCount = episodicUserAssistant.filter((row) => {
    const key = `${row.role}:${normalize(String(row.content ?? ''))}`;
    return !threadKeys.has(key);
  }).length;

  const diverged =
    orphanCount >= 2
    || episodicUserAssistant.length >= threadTurns.length + 4;

  if (!diverged && episodicUserAssistant.length > 0) {
    return { realigned: false, reason: 'aligned' };
  }

  await clearSession(opts.sessionId);
  forceImmediateInvalidation(opts.sessionId);
  for (const turn of threadTurns) {
    await saveMemory(opts.sessionId, turn.role, turn.content);
  }
  return { realigned: true, reason: 'rewrote_from_employee_thread' };
}
