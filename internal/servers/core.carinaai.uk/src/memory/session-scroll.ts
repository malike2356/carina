import { pool } from './db.js';
import type { SessionMessage } from './session-search-service.js';
import {
  getLineageRoot,
  getSessionChain,
  getSessionParent,
} from './session-lineage.js';

export type SessionScrollDirection = 'older' | 'newer';

export type SessionScrollOptions = {
  /** Paginate relative to this message id */
  cursor?: string;
  /** Center a symmetric window on this message id */
  around?: string;
  direction?: SessionScrollDirection;
  limit?: number;
  /** When at the start of a child session, include tail of parent session */
  includeLineage?: boolean;
};

export type SessionScrollPage = {
  sessionId: string;
  messages: SessionMessage[];
  hasOlder: boolean;
  hasNewer: boolean;
  oldestMessageId: string | null;
  newestMessageId: string | null;
  lineage?: {
    rootSessionId: string;
    chain: Array<{ sessionId: string; timestamp?: string }>;
    crossedFromParent: boolean;
    parentSessionId?: string;
  };
};

function mapRow(row: Record<string, unknown>): SessionMessage {
  return {
    id: String(row.id),
    sessionId: String(row.session_id),
    role: String(row.role),
    content: String(row.content),
    createdAt: new Date(String(row.created_at)),
  };
}

async function fetchAnchorTime(sessionId: string, messageId: string): Promise<Date | null> {
  const result = await pool.query(
    `SELECT created_at FROM episodic_memories WHERE id = $1 AND session_id = $2`,
    [messageId, sessionId],
  );
  if (result.rows.length === 0) return null;
  return new Date(String(result.rows[0].created_at));
}

async function fetchOlderMessages(
  sessionId: string,
  beforeTime: Date | null,
  limit: number,
): Promise<SessionMessage[]> {
  const result = beforeTime
    ? await pool.query(
      `SELECT id, session_id, role, content, created_at
       FROM episodic_memories
       WHERE session_id = $1 AND created_at < $2
       ORDER BY created_at DESC
       LIMIT $3`,
      [sessionId, beforeTime, limit + 1],
    )
    : await pool.query(
      `SELECT id, session_id, role, content, created_at
       FROM episodic_memories
       WHERE session_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [sessionId, limit + 1],
    );
  const rows = result.rows.map(mapRow).reverse();
  return rows;
}

async function fetchNewerMessages(
  sessionId: string,
  afterTime: Date,
  limit: number,
): Promise<SessionMessage[]> {
  const result = await pool.query(
    `SELECT id, session_id, role, content, created_at
     FROM episodic_memories
     WHERE session_id = $1 AND created_at > $2
     ORDER BY created_at ASC
     LIMIT $3`,
    [sessionId, afterTime, limit + 1],
  );
  return result.rows.map(mapRow);
}

async function fetchAroundMessages(
  sessionId: string,
  aroundId: string,
  halfWindow: number,
): Promise<SessionMessage[]> {
  const anchorTime = await fetchAnchorTime(sessionId, aroundId);
  if (!anchorTime) return [];

  const [before, after] = await Promise.all([
    pool.query(
      `SELECT id, session_id, role, content, created_at
       FROM episodic_memories
       WHERE session_id = $1 AND created_at <= $2
       ORDER BY created_at DESC
       LIMIT $3`,
      [sessionId, anchorTime, halfWindow + 1],
    ),
    pool.query(
      `SELECT id, session_id, role, content, created_at
       FROM episodic_memories
       WHERE session_id = $1 AND created_at > $2
       ORDER BY created_at ASC
       LIMIT $3`,
      [sessionId, anchorTime, halfWindow],
    ),
  ]);

  const merged = [...before.rows.reverse(), ...after.rows].map(mapRow);
  const seen = new Set<string>();
  return merged.filter((m) => {
    if (seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });
}

async function fetchParentTail(parentSessionId: string, limit: number): Promise<SessionMessage[]> {
  const result = await pool.query(
    `SELECT id, session_id, role, content, created_at
     FROM episodic_memories
     WHERE session_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [parentSessionId, limit],
  );
  return result.rows.reverse().map(mapRow);
}

export async function scrollSessionMessages(
  sessionId: string,
  options: SessionScrollOptions = {},
): Promise<SessionScrollPage> {
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 100);
  let messages: SessionMessage[] = [];
  let hasOlder = false;
  let hasNewer = false;
  let crossedFromParent = false;
  const parentSessionId = getSessionParent(sessionId);

  if (options.around) {
    messages = await fetchAroundMessages(sessionId, options.around, Math.floor(limit / 2));
    if (messages.length > 0) {
      const oldest = messages[0]!;
      const newest = messages[messages.length - 1]!;
      const olderProbe = await fetchOlderMessages(sessionId, oldest.createdAt, 1);
      hasOlder = olderProbe.length > 0 || Boolean(options.includeLineage && parentSessionId);
      const newerProbe = await fetchNewerMessages(sessionId, newest.createdAt, 1);
      hasNewer = newerProbe.length > 0;
    }
  } else if (options.cursor) {
    const anchorTime = await fetchAnchorTime(sessionId, options.cursor);
    if (!anchorTime) {
      return emptyPage(sessionId);
    }
    const direction = options.direction ?? 'older';
    if (direction === 'older') {
      const batch = await fetchOlderMessages(sessionId, anchorTime, limit);
      hasOlder = batch.length > limit;
      messages = batch.slice(-limit);
      hasNewer = true;
      if (messages.length === 0 && options.includeLineage && parentSessionId) {
        const parentTail = await fetchParentTail(parentSessionId, limit);
        if (parentTail.length > 0) {
          messages = parentTail;
          crossedFromParent = true;
          hasOlder = parentTail.length >= limit;
        }
      }
    } else {
      const batch = await fetchNewerMessages(sessionId, anchorTime, limit + 1);
      hasNewer = batch.length > limit;
      messages = batch.slice(0, limit);
      hasOlder = true;
    }
  } else {
    const batch = await fetchOlderMessages(sessionId, null, limit + 1);
    hasOlder = batch.length > limit || Boolean(options.includeLineage && parentSessionId);
    messages = batch.slice(-limit);
    if (messages.length < limit && options.includeLineage && parentSessionId) {
      const need = limit - messages.length;
      const parentTail = await fetchParentTail(parentSessionId, need);
      if (parentTail.length > 0) {
        messages = [...parentTail, ...messages];
        crossedFromParent = true;
      }
    }
    if (messages.length > 0) {
      const newest = messages[messages.length - 1]!;
      const newerProbe = await fetchNewerMessages(sessionId, newest.createdAt, 1);
      hasNewer = newerProbe.length > 0;
    }
  }

  const chain = getSessionChain(sessionId);
  return {
    sessionId,
    messages,
    hasOlder,
    hasNewer,
    oldestMessageId: messages[0]?.id ?? null,
    newestMessageId: messages[messages.length - 1]?.id ?? null,
    lineage: options.includeLineage
      ? {
          rootSessionId: getLineageRoot(sessionId),
          chain,
          crossedFromParent,
          parentSessionId: parentSessionId ?? undefined,
        }
      : undefined,
  };
}

function emptyPage(sessionId: string): SessionScrollPage {
  return {
    sessionId,
    messages: [],
    hasOlder: false,
    hasNewer: false,
    oldestMessageId: null,
    newestMessageId: null,
  };
}

/** Backward-compatible window around a single message id. */
export async function getSessionMessageWindow(
  sessionId: string,
  aroundMessageId: string,
  window = 5,
): Promise<SessionMessage[]> {
  const page = await scrollSessionMessages(sessionId, {
    around: aroundMessageId,
    limit: window * 2 + 1,
  });
  return page.messages;
}
