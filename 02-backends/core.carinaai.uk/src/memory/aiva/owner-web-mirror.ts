/**
 * Mirror shared owner episodic history into the web employee thread so the
 * dashboard shows the same conversation the model continues across channels.
 */
import { getSessionHistory } from '../store.js';
import { pool } from '../db.js';
import {
  getOrCreateEmployeeThread,
  listEmployeeThreadMessages,
  type EmployeeThreadMessage,
} from '../../aiva/employee-comms.js';
import { OWNER_CANONICAL_CONTACT_ID } from './owner-auto-sync.js';

async function appendMirroredMessage(input: {
  workspaceId: string;
  workerId: string;
  threadId: string;
  sender: 'user' | 'employee';
  content: string;
  contactId: string;
}): Promise<void> {
  await pool.query(
    `INSERT INTO aiva_employee_messages
       (thread_id, workspace_id, worker_id, sender, content, channel, contact_id, metadata_json)
     VALUES ($1,$2,$3,$4,$5,'web',$6,$7::jsonb)`,
    [
      input.threadId,
      input.workspaceId,
      input.workerId,
      input.sender,
      input.content,
      input.contactId,
      JSON.stringify({ mirroredFrom: OWNER_CANONICAL_CONTACT_ID }),
    ],
  );
}

export async function mirrorOwnerSharedHistoryIntoWebThread(opts: {
  workspaceId: string;
  workerId: string;
  contactId: string;
  sessionId: string;
  limit?: number;
}): Promise<{ mirrored: number; messages: EmployeeThreadMessage[]; threadId: string }> {
  const limit = Math.min(Math.max(opts.limit ?? 40, 1), 80);
  const listed = await listEmployeeThreadMessages(opts.workspaceId, opts.workerId, {
    contactId: opts.contactId,
    channel: 'web',
    limit,
  });

  let episodic: Array<{ role: string; content: string }> = [];
  try {
    const history = await getSessionHistory(opts.sessionId, limit);
    episodic = history
      .filter((row) => row.role === 'user' || row.role === 'assistant')
      .map((row) => ({
        role: String(row.role),
        content: String(row.content ?? '').trim(),
      }))
      .filter((row) => row.content.length > 0);
  } catch {
    episodic = [];
  }

  if (episodic.length === 0) {
    return { mirrored: 0, messages: listed.messages, threadId: listed.threadId };
  }

  const existingKeys = new Set(
    listed.messages.map((msg) => {
      const role = msg.sender === 'employee' ? 'assistant' : 'user';
      return `${role}:${msg.content.trim()}`;
    }),
  );

  const missing = episodic.filter((turn) => !existingKeys.has(`${turn.role}:${turn.content}`));
  if (missing.length === 0) {
    return { mirrored: 0, messages: listed.messages, threadId: listed.threadId };
  }

  // Only seed when the web thread is empty or clearly behind the shared session.
  if (listed.messages.length > 0 && missing.length < Math.max(2, Math.floor(episodic.length / 3))) {
    return { mirrored: 0, messages: listed.messages, threadId: listed.threadId };
  }

  const threadId = listed.threadId
    || await getOrCreateEmployeeThread(opts.workspaceId, opts.workerId, opts.contactId, 'web');

  let mirrored = 0;
  for (const turn of missing) {
    await appendMirroredMessage({
      workspaceId: opts.workspaceId,
      workerId: opts.workerId,
      threadId,
      sender: turn.role === 'assistant' ? 'employee' : 'user',
      content: turn.content,
      contactId: opts.contactId,
    });
    mirrored += 1;
  }

  const refreshed = await listEmployeeThreadMessages(opts.workspaceId, opts.workerId, {
    contactId: opts.contactId,
    channel: 'web',
    limit,
  });
  return { mirrored, messages: refreshed.messages, threadId: refreshed.threadId };
}
