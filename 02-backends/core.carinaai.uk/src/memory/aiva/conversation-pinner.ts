/**
 * Stable conversation pinning for Aiva channel threads.
 *
 * Episodic session keys are derived from a persisted conversation_id on
 * channel_threads, not from volatile contact identifiers that can change
 * across reconnects (guest vs authenticated, tab resets, token refresh).
 */
import { isDatabaseConfigured } from '../../config/database-url.js';
import { pool } from '../db.js';

const PINNING_SQL = `
ALTER TABLE channel_threads ADD COLUMN IF NOT EXISTS conversation_id UUID DEFAULT gen_random_uuid();
ALTER TABLE channel_threads ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE channel_threads ADD COLUMN IF NOT EXISTS session_epoch INTEGER DEFAULT 1;
CREATE UNIQUE INDEX IF NOT EXISTS idx_channel_threads_conversation
  ON channel_threads (conversation_id);
ALTER TABLE episodic_memories ADD COLUMN IF NOT EXISTS conversation_id UUID;
CREATE INDEX IF NOT EXISTS idx_episodic_memories_conversation
  ON episodic_memories (conversation_id, created_at DESC);
`;

let schemaReady: Promise<void> | null = null;

export function aivaConversationSessionId(workerId: string, conversationId: string): string {
  return `aiva-${workerId}-conv-${conversationId}`;
}

export function parseConversationIdFromSessionId(sessionId: string): string | null {
  const match = /conv-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.exec(
    sessionId.trim(),
  );
  return match?.[1] ?? null;
}

export async function ensureConversationPinningSchema(): Promise<void> {
  if (!isDatabaseConfigured()) return;
  if (!schemaReady) {
    schemaReady = (async () => {
      await pool.query(PINNING_SQL);
      await backfillEpisodicConversationIds().catch(() => undefined);
    })().catch((err) => {
      schemaReady = null;
      throw err;
    });
  }
  await schemaReady;
}

/** Stamp conversation_id on episodic rows whose session_id already embeds it. */
export async function backfillEpisodicConversationIds(): Promise<number> {
  if (!isDatabaseConfigured()) return 0;
  const result = await pool.query(
    `UPDATE episodic_memories
     SET conversation_id = (
       substring(session_id from 'conv-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$')
     )::uuid
     WHERE conversation_id IS NULL
       AND session_id ~ 'conv-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'`,
  );
  return result.rowCount ?? 0;
}

/** Bump session_epoch so prior summaries stay archived under the old epoch. */
export async function bumpConversationEpoch(params: {
  workspaceId: string;
  workerId: string;
  channel: string;
  contactId: string;
}): Promise<number> {
  await ensureConversationPinningSchema();
  const workerId = params.workerId.trim();
  const channel = params.channel.trim();
  const contactId = params.contactId.trim();
  if (!workerId || !channel || !contactId) return 1;

  const result = await pool.query<{ session_epoch: number }>(
    `UPDATE channel_threads
     SET session_epoch = COALESCE(session_epoch, 1) + 1
     WHERE worker_id = $1 AND channel = $2 AND contact_id = $3
     RETURNING session_epoch`,
    [workerId, channel, contactId],
  );
  return Number(result.rows[0]?.session_epoch ?? 1);
}

export async function resolveOrCreateConversation(params: {
  workspaceId: string;
  workerId: string;
  channel: string;
  contactId: string;
}): Promise<{ conversationId: string; sessionEpoch: number; isNew: boolean }> {
  await ensureConversationPinningSchema();

  const workerId = params.workerId.trim();
  const channel = params.channel.trim();
  const contactId = params.contactId.trim();
  const workspaceId = params.workspaceId.trim();
  if (!workerId || !channel || !contactId || !workspaceId) {
    throw new Error('resolveOrCreateConversation requires workspaceId, workerId, channel, contactId');
  }

  const existing = await pool.query<{
    conversation_id: string | null;
    session_epoch: number | null;
  }>(
    `SELECT conversation_id::text AS conversation_id, session_epoch
     FROM channel_threads
     WHERE worker_id = $1 AND channel = $2 AND contact_id = $3
     LIMIT 1`,
    [workerId, channel, contactId],
  );

  if (existing.rows[0]?.conversation_id) {
    return {
      conversationId: String(existing.rows[0].conversation_id),
      sessionEpoch: Number(existing.rows[0].session_epoch ?? 1),
      isNew: false,
    };
  }

  if (existing.rows[0]) {
    const backfilled = await pool.query<{
      conversation_id: string;
      session_epoch: number;
    }>(
      `UPDATE channel_threads
       SET conversation_id = COALESCE(conversation_id, gen_random_uuid()),
           pinned_at = COALESCE(pinned_at, NOW()),
           session_epoch = COALESCE(session_epoch, 1)
       WHERE worker_id = $1 AND channel = $2 AND contact_id = $3
       RETURNING conversation_id::text AS conversation_id, session_epoch`,
      [workerId, channel, contactId],
    );
    const row = backfilled.rows[0];
    if (!row?.conversation_id) {
      throw new Error('Failed to backfill conversation_id on channel_threads');
    }
    return {
      conversationId: String(row.conversation_id),
      sessionEpoch: Number(row.session_epoch ?? 1),
      isNew: false,
    };
  }

  const inserted = await pool.query<{
    conversation_id: string;
    session_epoch: number;
  }>(
    `INSERT INTO channel_threads
       (worker_id, workspace_id, channel, contact_id, conversation_id, pinned_at, session_epoch,
        thread_metadata, last_message_at, message_count)
     VALUES ($1, $2, $3, $4, gen_random_uuid(), NOW(), 1, '{}'::jsonb, NOW(), 0)
     ON CONFLICT (worker_id, channel, contact_id)
     DO UPDATE SET
       conversation_id = COALESCE(channel_threads.conversation_id, EXCLUDED.conversation_id),
       pinned_at = COALESCE(channel_threads.pinned_at, EXCLUDED.pinned_at),
       session_epoch = COALESCE(channel_threads.session_epoch, EXCLUDED.session_epoch)
     RETURNING conversation_id::text AS conversation_id, session_epoch`,
    [workerId, workspaceId, channel, contactId],
  );
  const row = inserted.rows[0];
  if (!row?.conversation_id) {
    throw new Error('Failed to create conversation pin on channel_threads');
  }
  return {
    conversationId: String(row.conversation_id),
    sessionEpoch: Number(row.session_epoch ?? 1),
    isNew: true,
  };
}

export type ConversationHealthRow = {
  conversationId: string;
  channel: string;
  contactId: string;
  sessionEpoch: number;
  lastActive: string | null;
  turnCount: number;
  sessionIds: string[];
  fragmented: boolean;
};

/**
 * Ops health view: pinned conversations for a worker, with fragmentation flags
 * when more than one episodic session_id maps to the same channel+contact.
 */
export async function getConversationHealthForWorker(
  workerId: string,
): Promise<{ conversations: ConversationHealthRow[]; fragmentedCount: number }> {
  await ensureConversationPinningSchema();

  const threads = await pool.query<{
    conversation_id: string;
    channel: string;
    contact_id: string;
    session_epoch: number;
    last_message_at: string | null;
  }>(
    `SELECT conversation_id::text AS conversation_id,
            channel,
            contact_id,
            COALESCE(session_epoch, 1) AS session_epoch,
            last_message_at
     FROM channel_threads
     WHERE worker_id = $1
       AND conversation_id IS NOT NULL
     ORDER BY last_message_at DESC NULLS LAST`,
    [workerId],
  );

  const conversations: ConversationHealthRow[] = [];
  let fragmentedCount = 0;

  for (const thread of threads.rows) {
    const conversationId = String(thread.conversation_id);
    const pinnedSessionId = aivaConversationSessionId(workerId, conversationId);
    const contactId = String(thread.contact_id);
    const channel = String(thread.channel);

    const legacyIds = [
      pinnedSessionId,
      `aiva-${workerId}-contact-${contactId}`,
      `aiva-${workerId}-${channel}-${contactId}`,
    ];

    const turns = await pool.query<{
      session_id: string;
      turn_count: string;
      last_active: string | null;
    }>(
      `SELECT session_id,
              COUNT(*)::text AS turn_count,
              MAX(created_at)::text AS last_active
       FROM episodic_memories
       WHERE (
           session_id = ANY($1::text[])
           OR conversation_id = $2::uuid
         )
         AND created_at > NOW() - INTERVAL '4 hours'
       GROUP BY session_id
       ORDER BY MAX(created_at) DESC NULLS LAST`,
      [legacyIds, conversationId],
    );

    const allTime = await pool.query<{ turn_count: string; last_active: string | null }>(
      `SELECT COUNT(*)::text AS turn_count, MAX(created_at)::text AS last_active
       FROM episodic_memories
       WHERE session_id = ANY($1::text[])
          OR conversation_id = $2::uuid`,
      [legacyIds, conversationId],
    );

    const sessionIds = turns.rows.map((row) => String(row.session_id));
    const turnCount = Number(allTime.rows[0]?.turn_count ?? 0);
    const lastActive = allTime.rows[0]?.last_active ?? thread.last_message_at;
    // Fragmentation: more than one session id still receiving recent turns for this pin.
    const fragmented = sessionIds.length > 1;

    if (fragmented) fragmentedCount += 1;

    conversations.push({
      conversationId,
      channel,
      contactId,
      sessionEpoch: Number(thread.session_epoch ?? 1),
      lastActive,
      turnCount,
      sessionIds: sessionIds.length > 0 ? sessionIds : [pinnedSessionId],
      fragmented,
    });
  }

  return { conversations, fragmentedCount };
}
