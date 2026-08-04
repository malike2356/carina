import { pool } from '../db.js';
import { searchSessionsAdvanced } from '../session-search-service.js';

export type WorkerConversationHit = {
  source: 'episodic' | 'employee_thread';
  sessionId?: string;
  role?: string;
  content: string;
  createdAt?: string;
};

/**
 * Full conversation search across episodic sessions for this worker
 * plus the durable employee thread table.
 * Always scoped to workspace_id + worker_id; never uses host FTS5.
 */
export async function searchWorkerConversations(opts: {
  workspaceId: string;
  workerId: string;
  query: string;
  limit?: number;
}): Promise<WorkerConversationHit[]> {
  const limit = Math.min(Math.max(opts.limit ?? 10, 1), 25);
  const query = opts.query.trim();
  if (!query) return [];

  const ownership = await pool.query(
    `SELECT 1 FROM ai_workers WHERE id = $1 AND workspace_id = $2 LIMIT 1`,
    [opts.workerId, opts.workspaceId],
  ).catch(() => ({ rows: [] as unknown[] }));
  if (!ownership.rows.length) return [];

  const hits: WorkerConversationHit[] = [];
  const sessionPrefix = `aiva-${opts.workerId}-`;

  try {
    const episodic = await searchSessionsAdvanced({
      query,
      limit: limit * 3,
      tenantScope: {
        sql: 'session_id LIKE $1',
        params: [`${sessionPrefix}%`],
      },
    });
    for (const hit of episodic.results ?? []) {
      const sessionId = String(hit.sessionId ?? '');
      if (!sessionId.startsWith(sessionPrefix)) continue;
      hits.push({
        source: 'episodic',
        sessionId,
        content: String(hit.snippet ?? hit.title ?? '').slice(0, 500),
        createdAt: hit.timestamp ? new Date(hit.timestamp).toISOString() : undefined,
      });
    }
  } catch {
    /* episodic search optional */
  }

  try {
    const result = await pool.query(
      `SELECT sender, content, created_at, contact_id, channel
       FROM aiva_employee_messages
       WHERE workspace_id = $1 AND worker_id = $2
         AND content ILIKE '%' || $3 || '%'
       ORDER BY created_at DESC
       LIMIT $4`,
      [opts.workspaceId, opts.workerId, query, limit],
    );
    for (const row of result.rows) {
      hits.push({
        source: 'employee_thread',
        role: row.sender === 'employee' ? 'assistant' : 'user',
        content: String(row.content ?? '').slice(0, 500),
        createdAt: row.created_at ? new Date(String(row.created_at)).toISOString() : undefined,
      });
    }
  } catch {
    /* employee thread search optional */
  }

  return hits.slice(0, limit);
}
