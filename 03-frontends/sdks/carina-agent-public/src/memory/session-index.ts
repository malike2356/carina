import { pool } from './db.js';

export interface SessionSearchHit {
  sessionId: string;
  title: string;
  timestamp: Date;
  snippet: string;
  bookendStart: string[];
  bookendEnd: string[];
  contextWindow: string[];
}

export interface SessionMessage {
  id: string;
  sessionId: string;
  role: string;
  content: string;
  createdAt: Date;
}

export async function searchSessions(
  query: string,
  options: { limit?: number; roleFilter?: string } = {},
): Promise<SessionSearchHit[]> {
  const limit = options.limit ?? 5;
  const tsQuery = query.trim();
  if (!tsQuery) return [];

  const roleClause = options.roleFilter
    ? `AND role = $3`
    : '';
  const params: unknown[] = [tsQuery, limit];
  if (options.roleFilter) params.push(options.roleFilter);

  const result = await pool.query(
    `SELECT DISTINCT ON (session_id)
       session_id,
       id AS message_id,
       role,
       content,
       created_at,
       ts_headline('english', content, websearch_to_tsquery('english', $1)) AS snippet,
       ts_rank(content_tsv, websearch_to_tsquery('english', $1)) AS rank
     FROM episodic_memories
     WHERE content_tsv @@ websearch_to_tsquery('english', $1)
     ${roleClause}
     ORDER BY session_id, rank DESC`,
    params,
  );

  const hits: SessionSearchHit[] = [];
  for (const row of result.rows) {
    const sessionId = String(row.session_id);
    const messageId = String(row.message_id);
    const [bookendStart, bookendEnd, contextWindow, title] = await Promise.all([
      fetchBookend(sessionId, 'start'),
      fetchBookend(sessionId, 'end'),
      fetchContextWindow(sessionId, messageId, 5),
      deriveSessionTitle(sessionId),
    ]);
    hits.push({
      sessionId,
      title,
      timestamp: new Date(String(row.created_at)),
      snippet: String(row.snippet ?? row.content).slice(0, 300),
      bookendStart,
      bookendEnd,
      contextWindow,
    });
    if (hits.length >= limit) break;
  }
  return hits;
}

export async function getSessionWindow(
  sessionId: string,
  aroundMessageId: string,
  window = 5,
): Promise<SessionMessage[]> {
  const anchor = await pool.query(
    `SELECT created_at FROM episodic_memories WHERE id = $1 AND session_id = $2`,
    [aroundMessageId, sessionId],
  );
  if (anchor.rows.length === 0) {
    throw new Error(`Message ${aroundMessageId} not found in session ${sessionId}.`);
  }
  const anchorTime = anchor.rows[0].created_at;

  const result = await pool.query(
    `SELECT id, session_id, role, content, created_at
     FROM episodic_memories
     WHERE session_id = $1
       AND created_at BETWEEN ($2::timestamptz - interval '1 second' * $3)
                          AND ($2::timestamptz + interval '1 second' * $3)
     ORDER BY created_at ASC`,
    [sessionId, anchorTime, window * 60],
  );
  return result.rows.map(rowToMessage);
}

export async function browseRecentSessions(limit = 10): Promise<SessionSearchHit[]> {
  const result = await pool.query(
    `SELECT session_id, MAX(created_at) AS last_at
     FROM episodic_memories
     GROUP BY session_id
     ORDER BY last_at DESC
     LIMIT $1`,
    [limit],
  );

  const hits: SessionSearchHit[] = [];
  for (const row of result.rows) {
    const sessionId = String(row.session_id);
    const [bookendStart, bookendEnd, title] = await Promise.all([
      fetchBookend(sessionId, 'start'),
      fetchBookend(sessionId, 'end'),
      deriveSessionTitle(sessionId),
    ]);
    hits.push({
      sessionId,
      title,
      timestamp: new Date(String(row.last_at)),
      snippet: bookendStart[0]?.slice(0, 200) ?? '',
      bookendStart,
      bookendEnd,
      contextWindow: [],
    });
  }
  return hits;
}

async function fetchBookend(sessionId: string, which: 'start' | 'end'): Promise<string[]> {
  const order = which === 'start' ? 'ASC' : 'DESC';
  const result = await pool.query(
    `SELECT role, content FROM episodic_memories
     WHERE session_id = $1
     ORDER BY created_at ${order}
     LIMIT 3`,
    [sessionId],
  );
  const lines = result.rows.map((r) => `${r.role}: ${r.content}`);
  return which === 'end' ? lines.reverse() : lines;
}

async function fetchContextWindow(
  sessionId: string,
  messageId: string,
  window: number,
): Promise<string[]> {
  const messages = await getSessionWindow(sessionId, messageId, window);
  return messages.map((m) => `${m.role}: ${m.content}`);
}

async function deriveSessionTitle(sessionId: string): Promise<string> {
  const result = await pool.query(
    `SELECT content FROM episodic_memories
     WHERE session_id = $1 AND role = 'user'
     ORDER BY created_at ASC LIMIT 1`,
    [sessionId],
  );
  const first = String(result.rows[0]?.content ?? sessionId);
  return first.length > 60 ? `${first.slice(0, 57)}...` : first;
}

function rowToMessage(row: Record<string, unknown>): SessionMessage {
  return {
    id: String(row.id),
    sessionId: String(row.session_id),
    role: String(row.role),
    content: String(row.content),
    createdAt: new Date(String(row.created_at)),
  };
}
