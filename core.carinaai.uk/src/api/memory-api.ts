import { Router, type NextFunction, type Request, type Response, type Router as ExpressRouter } from 'express';
import { pool } from '../memory/db.js';
import { isControlAuthorized } from '../infrastructure/control-auth.js';

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
  if (tenantId === '__operator__' || tenantId === 'default') {
    return { sql: 'TRUE', params: [] };
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

memoryApiRouter.get('/sessions', async (_req: MemoryRequest, res: Response) => {
  try {
    const result = await pool.query<{
      session_id: string;
      turn_count: string;
      last_active: string;
    }>(
      `SELECT session_id,
              COUNT(*)::text         AS turn_count,
              MAX(created_at)::text  AS last_active
       FROM episodic_memories
       GROUP BY session_id
       ORDER BY MAX(created_at) DESC
       LIMIT 50`,
    );

    res.json({
      sessions: result.rows.map((r) => ({
        session_id: r.session_id,
        turn_count: parseInt(r.turn_count, 10),
        last_active: r.last_active,
      })),
    });
  } catch (err) {
    console.error('[memory-api] sessions failed:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Failed to load sessions' });
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
