import { Router, type Router as ExpressRouter } from 'express';
import { pool } from '../memory/db.js';

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

// ── List memories (scoped to tenant via session_id prefix) ──
memoryApiRouter.get('/', async (req, res) => {
  const tenantId = (req as any).tenantId ?? 'default';
  const category = String(req.query.category ?? '').trim();
  const search = String(req.query.q ?? '').trim();
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = 20;

  const conditions: string[] = ['session_id LIKE $1'];
  const params: unknown[] = [`${tenantId}:%`];
  let idx = 2;

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
       ORDER BY priority DESC, updated_at DESC
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
    res.status(500).json({ error: 'Failed to load memories' });
  }
});

// ── Stats ──
memoryApiRouter.get('/stats', async (req, res) => {
  const tenantId = (req as any).tenantId ?? 'default';
  try {
    const result = await pool.query<{ category: string; count: string; chars: string }>(
      `SELECT category, COUNT(*)::text AS count, COALESCE(SUM(LENGTH(content)), 0)::text AS chars
       FROM episodic_memories
       WHERE session_id LIKE $1
       GROUP BY category
       ORDER BY chars DESC`,
      [`${tenantId}:%`],
    );

    res.json({ categories: result.rows });
  } catch {
    res.status(500).json({ error: 'Failed to load stats' });
  }
});

// ── Create ──
memoryApiRouter.post('/', async (req, res) => {
  const tenantId = (req as any).tenantId ?? 'default';
  const { category, content, priority } = req.body ?? {};
  if (!content) return res.status(400).json({ error: 'Content is required' });

  try {
    const result = await pool.query<MemoryRow>(
      `INSERT INTO episodic_memories (session_id, role, content, priority, category, created_at, updated_at)
       VALUES ($1, 'system', $2, $3, $4, NOW(), NOW()) RETURNING *`,
      [`${tenantId}:memory`, content, priority ?? 0, category ?? 'general'],
    );
    res.status(201).json(result.rows[0]);
  } catch {
    res.status(500).json({ error: 'Failed to create memory' });
  }
});

// ── Update ──
memoryApiRouter.put('/:id', async (req, res) => {
  const tenantId = (req as any).tenantId ?? 'default';
  const { content, category, priority } = req.body ?? {};

  try {
    const result = await pool.query<MemoryRow>(
      `UPDATE episodic_memories
       SET content = COALESCE($1, content),
           category = COALESCE($2, category),
           priority = COALESCE($3, priority),
           updated_at = NOW()
       WHERE id = $4 AND session_id LIKE $5
       RETURNING *`,
      [content ?? null, category ?? null, priority ?? null, req.params.id, `${tenantId}:%`],
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch {
    res.status(500).json({ error: 'Failed to update memory' });
  }
});

// ── Delete ──
memoryApiRouter.delete('/:id', async (req, res) => {
  const tenantId = (req as any).tenantId ?? 'default';
  try {
    const result = await pool.query(
      `DELETE FROM episodic_memories WHERE id = $1 AND session_id LIKE $2`,
      [req.params.id, `${tenantId}:%`],
    );
    if ((result.rowCount ?? 0) === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ deleted: true });
  } catch {
    res.status(500).json({ error: 'Failed to delete memory' });
  }
});

// ── Search ──
memoryApiRouter.get('/search', async (req, res) => {
  const tenantId = (req as any).tenantId ?? 'default';
  const q = String(req.query.q ?? '').trim();
  if (!q) return res.json({ results: [] });

  try {
    const result = await pool.query<MemoryRow>(
      `SELECT id, category, content, priority, created_at
       FROM episodic_memories
       WHERE session_id LIKE $1 AND content ILIKE $2
       ORDER BY priority DESC
       LIMIT 50`,
      [`${tenantId}:%`, `%${q}%`],
    );
    res.json({ results: result.rows });
  } catch {
    res.status(500).json({ error: 'Search failed' });
  }
});
