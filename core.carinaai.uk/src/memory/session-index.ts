import { pool } from './db.js';
import type { SessionSearchSort } from './session-search-ranking.js';
import { generateSessionTitle } from './session-titles.js';
import {
  getSessionWindowInternal,
  searchSessionsAdvanced,
  type SessionMessage,
  type SessionSearchHit,
} from './session-search-service.js';

export type { SessionMessage, SessionSearchHit, SessionSearchSort };
export {
  searchSessionsAdvanced,
  tenantScopeFromId,
  clearSessionSearchCacheForTests,
  type SessionSearchHitResult,
  type SessionSearchOptions,
  type SessionSearchResponse,
} from './session-search-service.js';

export async function searchSessions(
  query: string,
  options: {
    limit?: number;
    offset?: number;
    roleFilter?: string;
    sort?: SessionSearchSort;
    tenantScope?: { sql: string; params: unknown[] };
    enableSemantic?: boolean;
  } = {},
): Promise<SessionSearchHit[]> {
  const response = await searchSessionsAdvanced({
    query,
    limit: options.limit,
    offset: options.offset,
    roleFilter: options.roleFilter,
    sort: options.sort,
    tenantScope: options.tenantScope,
    enableSemantic: options.enableSemantic,
  });
  return response.results.map(({ messageId: _m, rank: _r, matchStrategy: _s, ...hit }) => hit);
}

export async function getSessionWindow(
  sessionId: string,
  aroundMessageId: string,
  window = 5,
): Promise<SessionMessage[]> {
  try {
    const { getSessionMessageWindow } = await import('./session-scroll.js');
    return await getSessionMessageWindow(sessionId, aroundMessageId, window);
  } catch (err) {
    console.error('getSessionWindow query failed:', err);
    return [];
  }
}

export {
  scrollSessionMessages,
  getSessionMessageWindow,
  type SessionScrollPage,
  type SessionScrollOptions,
  type SessionScrollDirection,
} from './session-scroll.js';

export async function browseRecentSessions(
  limit = 10,
  tenantScope?: { sql: string; params: unknown[] },
): Promise<SessionSearchHit[]> {
  const scope = tenantScope ?? { sql: 'TRUE', params: [] };
  const result = await pool.query(
    `SELECT session_id, MAX(created_at) AS last_at
     FROM episodic_memories
     WHERE ${scope.sql}
     GROUP BY session_id
     ORDER BY last_at DESC
     LIMIT $${scope.params.length + 1}`,
    [...scope.params, limit],
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

async function deriveSessionTitle(sessionId: string): Promise<string> {
  const result = await pool.query(
    `SELECT content FROM episodic_memories
     WHERE session_id = $1 AND role = 'user'
     ORDER BY created_at ASC LIMIT 1`,
    [sessionId],
  );
  const first = String(result.rows[0]?.content ?? sessionId);
  if (!result.rows[0]?.content) return sessionId;
  return generateSessionTitle(first);
}
