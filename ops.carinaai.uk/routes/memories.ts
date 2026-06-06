import { Router } from 'express';
import { query } from '../lib/db.js';

export const memoriesRouter = Router();

const PAGE_SIZE = 50;

memoriesRouter.get('/', async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const search = String(req.query.q ?? '').trim();
  const role = String(req.query.role ?? 'all');
  const sessionFilter = String(req.query.session ?? '').trim();

  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  if (search) {
    conditions.push(`content ILIKE $${paramIndex++}`);
    params.push(`%${search}%`);
  }
  if (role === 'user' || role === 'assistant') {
    conditions.push(`role = $${paramIndex++}`);
    params.push(role);
  }
  if (sessionFilter) {
    conditions.push(`session_id ILIKE $${paramIndex++}`);
    params.push(`%${sessionFilter}%`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM episodic_memories ${where}`,
      params,
    );
    const total = Number(countResult.rows[0]?.count ?? 0);
    const offset = (page - 1) * PAGE_SIZE;

    const listParams = [...params, PAGE_SIZE, offset];
    const rows = await query<{
      id: string;
      session_id: string;
      role: string;
      content: string;
      created_at: Date;
    }>(
      `SELECT id, session_id, role, content, created_at
       FROM episodic_memories
       ${where}
       ORDER BY created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      listParams,
    );

    res.render('memories/index', {
      memories: rows.rows,
      page,
      totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      total,
      search,
      role,
      sessionFilter,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).render('error', { message });
  }
});

memoriesRouter.get('/session/:sessionId', async (req, res) => {
  const sessionId = req.params.sessionId;
  try {
    const rows = await query<{
      id: string;
      role: string;
      content: string;
      created_at: Date;
    }>(
      `SELECT id, role, content, created_at
       FROM episodic_memories
       WHERE session_id = $1
       ORDER BY created_at ASC`,
      [sessionId],
    );
    res.render('memories/session', { sessionId, messages: rows.rows });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).render('error', { message });
  }
});

memoriesRouter.get('/:id', async (req, res) => {
  try {
    const rows = await query<{
      id: string;
      session_id: string;
      role: string;
      content: string;
      embedding: unknown;
      created_at: Date;
    }>(
      `SELECT id, session_id, role, content, embedding, created_at
       FROM episodic_memories WHERE id = $1`,
      [req.params.id],
    );
    const memory = rows.rows[0];
    if (!memory) {
      res.status(404).render('error', { message: 'Memory not found' });
      return;
    }
    res.render('memories/view', {
      memory,
      hasEmbedding: memory.embedding != null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).render('error', { message });
  }
});

memoriesRouter.post('/:id/delete', async (req, res) => {
  await query('DELETE FROM episodic_memories WHERE id = $1', [req.params.id]);
  res.redirect('/memories');
});

memoriesRouter.post('/session/:sessionId/delete', async (req, res) => {
  await query('DELETE FROM episodic_memories WHERE session_id = $1', [
    req.params.sessionId,
  ]);
  res.redirect('/memories');
});
