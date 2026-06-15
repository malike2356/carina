import { Router, type NextFunction, type Request, type Response, type Router as ExpressRouter } from 'express';
import { pool } from '../memory/db.js';
import { isControlAuthorized } from '../infrastructure/control-auth.js';
import { browseRecentSessions, searchSessions } from '../memory/session-index.js';
import { scrollSessionMessages } from '../memory/session-scroll.js';
import { searchSessionsAdvanced, tenantScopeFromId } from '../memory/session-search-service.js';
import { getSessionChain, getLineageRoot } from '../memory/session-lineage.js';
import { operatorMemoryScope } from '../profiles/isolation.js';

export const memoryApiRouter: ExpressRouter = Router();

interface MemoryRow {
  id: string;
  session_id: string;
  role: string;
  content: string;
  priority: number;
  category: string;
  created_at: Date;
  updated_at: Date;
}

type MemoryRequest = Request & { tenantId?: string };

function memoryAuth(req: MemoryRequest, res: Response, next: NextFunction): void {
  if (isControlAuthorized(req)) {
    req.tenantId = '__operator__';
    next();
    return;
  }
  if (req.session?.webAuthed) {
    req.tenantId = '__operator__';
    next();
    return;
  }
  if (req.session?.hostedAccountId) {
    req.tenantId = req.session.hostedAccountId;
    next();
    return;
  }
  res.status(401).json({ error: 'Unauthorized' });
}

function scopeClause(tenantId: string): { sql: string; params: unknown[] } {
  if (tenantId === '__operator__') {
    return operatorMemoryScope();
  }
  if (tenantId === 'default') {
    return operatorMemoryScope('default');
  }
  return { sql: 'session_id LIKE $1', params: [`${tenantId}:%`] };
}

memoryApiRouter.use(memoryAuth);

memoryApiRouter.get('/', async (req: MemoryRequest, res: Response) => {
  const tenantId = req.tenantId ?? 'default';
  const category = String(req.query.category ?? '').trim();
  const search = String(req.query.q ?? '').trim();
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = 20;

  const scope = scopeClause(tenantId);
  const conditions: string[] = [scope.sql];
  const params: unknown[] = [...scope.params];
  let idx = params.length + 1;

  if (category) {
    conditions.push(`category = $${idx++}`);
    params.push(category);
  }
  if (search) {
    conditions.push(`content ILIKE $${idx++}`);
    params.push(`%${search}%`);
  }

  const where = conditions.join(' AND ');
  const offset = (page - 1) * pageSize;

  try {
    const countResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text FROM episodic_memories WHERE ${where}`,
      params,
    );
    const total = Number(countResult.rows[0]?.count ?? 0);

    const rows = await pool.query<MemoryRow>(
      `SELECT id, session_id, role, content, priority, category, created_at, updated_at
       FROM episodic_memories WHERE ${where}
       ORDER BY COALESCE(updated_at, created_at) DESC NULLS LAST, priority DESC, id DESC
       LIMIT $${idx++} OFFSET $${idx}`,
      [...params, pageSize, offset],
    );

    res.json({
      entries: rows.rows.map((r) => ({
        id: r.id,
        category: r.category ?? 'general',
        content: r.content,
        priority: r.priority ?? 0,
        created_at: r.created_at,
        updated_at: r.updated_at,
      })),
      page,
      total_pages: Math.max(1, Math.ceil(total / pageSize)),
      total,
    });
  } catch (err) {
    console.error('[memory-api] list failed:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Failed to load memories' });
  }
});

memoryApiRouter.get('/sessions', async (req: MemoryRequest, res: Response) => {
  const tenantId = req.tenantId ?? 'default';
  const scope = scopeClause(tenantId);
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
  try {
    const hits = await browseRecentSessions(limit, scope);
    res.json({
      sessions: hits.map((h) => ({
        session_id: h.sessionId,
        title: h.title,
        last_active: h.timestamp.toISOString(),
        preview: h.snippet,
      })),
    });
  } catch (err) {
    console.error('[memory-api] sessions failed:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Failed to load sessions' });
  }
});

memoryApiRouter.get('/sessions/search', async (req: MemoryRequest, res: Response) => {
  const tenantId = req.tenantId ?? 'default';
  const q = String(req.query.q ?? '').trim();
  if (!q) {
    return res.json({
      results: [],
      total: 0,
      page: 1,
      pageSize: 20,
      totalPages: 0,
      query: '',
      sort: 'relevance',
      strategy: 'fts',
      fallbackUsed: false,
      indexHealthy: false,
    });
  }

  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);
  const page = Math.max(Number(req.query.page) || 1, 1);
  const offset = (page - 1) * limit;
  const sort = String(req.query.sort ?? 'relevance');
  const safeSort = sort === 'newest' || sort === 'oldest' ? sort : 'relevance';
  const roleFilter = String(req.query.role ?? '').trim() || undefined;
  const semantic = String(req.query.semantic ?? 'true') !== 'false';

  try {
    const payload = await searchSessionsAdvanced({
      query: q,
      limit,
      offset,
      sort: safeSort,
      roleFilter,
      tenantScope: tenantScopeFromId(tenantId),
      enableSemantic: semantic,
    });
    res.json(payload);
  } catch (err) {
    console.error('[memory-api] session search failed:', err instanceof Error ? err.message : err);
    try {
      const fallback = await searchSessions(q, {
        limit,
        roleFilter,
        tenantScope: tenantScopeFromId(tenantId),
        enableSemantic: false,
      });
      res.json({
        results: fallback.map((hit) => ({ ...hit, messageId: '', rank: 0, matchStrategy: 'fallback_ilike' })),
        total: fallback.length,
        page,
        pageSize: limit,
        totalPages: fallback.length > 0 ? 1 : 0,
        query: q,
        sort: safeSort,
        strategy: 'fallback_ilike',
        fallbackUsed: true,
        indexHealthy: false,
      });
    } catch {
      res.status(500).json({ error: 'Session search failed' });
    }
  }
});

memoryApiRouter.get('/sessions/:sessionId/lineage', (req: MemoryRequest, res: Response) => {
  const sessionId = String(req.params.sessionId);
  const chain = getSessionChain(sessionId);
  res.json({
    sessionId,
    rootSessionId: getLineageRoot(sessionId),
    chain,
  });
});

memoryApiRouter.get('/sessions/:sessionId/scroll', async (req: MemoryRequest, res: Response) => {
  const sessionId = String(req.params.sessionId);
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
  const direction = String(req.query.direction ?? 'older') === 'newer' ? 'newer' : 'older';
  const includeLineage = String(req.query.include_lineage ?? 'false') === 'true';
  const around = typeof req.query.around === 'string' ? req.query.around : undefined;
  const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;

  try {
    const page = await scrollSessionMessages(sessionId, {
      around,
      cursor,
      direction,
      limit,
      includeLineage,
    });
    res.json(page);
  } catch (err) {
    console.error('[memory-api] scroll failed:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Session scroll failed' });
  }
});

memoryApiRouter.get('/stats', async (req: MemoryRequest, res: Response) => {
  const tenantId = req.tenantId ?? 'default';
  const scope = scopeClause(tenantId);
  try {
    const result = await pool.query<{ category: string; count: string; chars: string }>(
      `SELECT COALESCE(category, 'general') AS category, COUNT(*)::text AS count,
              COALESCE(SUM(LENGTH(content)), 0)::text AS chars
       FROM episodic_memories
       WHERE ${scope.sql}
       GROUP BY category
       ORDER BY chars DESC`,
      scope.params,
    );

    res.json({ categories: result.rows });
  } catch (err) {
    console.error('[memory-api] stats failed:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Failed to load stats' });
  }
});

memoryApiRouter.post('/', async (req: MemoryRequest, res: Response) => {
  const tenantId = req.tenantId ?? 'default';
  const { category, content, priority } = req.body ?? {};
  if (!content) return res.status(400).json({ error: 'Content is required' });

  const sessionKey = tenantId === '__operator__' ? 'operator:memory' : `${tenantId}:memory`;

  try {
    const result = await pool.query<MemoryRow>(
      `INSERT INTO episodic_memories (session_id, role, content, priority, category, created_at, updated_at)
       VALUES ($1, 'system', $2, $3, $4, NOW(), NOW()) RETURNING *`,
      [sessionKey, content, priority ?? 0, category ?? 'general'],
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[memory-api] create failed:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Failed to create memory' });
  }
});

memoryApiRouter.put('/:id', async (req: MemoryRequest, res: Response) => {
  const tenantId = req.tenantId ?? 'default';
  const { content, category, priority } = req.body ?? {};
  const scope = scopeClause(tenantId);

  try {
    const result = await pool.query<MemoryRow>(
      `UPDATE episodic_memories
       SET content = COALESCE($1, content),
           category = COALESCE($2, category),
           priority = COALESCE($3, priority),
           updated_at = NOW()
       WHERE id = $4 AND ${scope.sql}
       RETURNING *`,
      [content ?? null, category ?? null, priority ?? null, req.params.id, ...scope.params],
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[memory-api] update failed:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Failed to update memory' });
  }
});

memoryApiRouter.delete('/:id', async (req: MemoryRequest, res: Response) => {
  const tenantId = req.tenantId ?? 'default';
  const scope = scopeClause(tenantId);
  try {
    const result = await pool.query(
      `DELETE FROM episodic_memories WHERE id = $1 AND ${scope.sql}`,
      [req.params.id, ...scope.params],
    );
    if ((result.rowCount ?? 0) === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ deleted: true });
  } catch (err) {
    console.error('[memory-api] delete failed:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Failed to delete memory' });
  }
});

memoryApiRouter.get('/search', async (req: MemoryRequest, res: Response) => {
  const tenantId = req.tenantId ?? 'default';
  const q = String(req.query.q ?? '').trim();
  if (!q) return res.json({ results: [] });
  const scope = scopeClause(tenantId);

  try {
    const result = await pool.query<MemoryRow>(
      `SELECT id, category, content, priority, created_at
       FROM episodic_memories
       WHERE ${scope.sql} AND content ILIKE $${scope.params.length + 1}
       ORDER BY COALESCE(updated_at, created_at) DESC NULLS LAST, priority DESC, id DESC
       LIMIT 50`,
      [...scope.params, `%${q}%`],
    );
    res.json({ results: result.rows });
  } catch (err) {
    console.error('[memory-api] search failed:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Search failed' });
  }
});
