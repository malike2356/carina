import { Router } from 'express';
import { query, tableExists } from '../lib/db.js';
import {
  buildMemoriesQuery,
  memoriesOrderBy,
  memorySortArrow,
  nextSortDir,
  parseMemorySort,
  parseSortDir,
  type MemorySortColumn,
} from '../lib/list-sort.js';

export const memoriesRouter = Router();

const PAGE_SIZE = 50;

memoriesRouter.get('/', async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const search = String(req.query.q ?? '').trim();
  const role = String(req.query.role ?? 'all');
  const sessionFilter = String(req.query.session ?? '').trim();
  const sortBy = parseMemorySort(req.query.sort);
  const sortDir = parseSortDir(req.query.dir);

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
    const hasMemories = await tableExists('episodic_memories');
    if (!hasMemories) {
      res.render('memories/index', {
        memories: [],
        page,
        totalPages: 1,
        total: 0,
        search,
        role,
        sessionFilter,
        sortBy,
        sortDir,
        sortArrow: memorySortArrow,
        sortLink: (column: MemorySortColumn) =>
          buildMemoriesQuery({
            page: 1,
            q: search,
            role,
            session: sessionFilter,
            sort: column,
            dir: nextSortDir(sortBy, sortDir, column),
          }),
        pageLink: (targetPage: number) =>
          buildMemoriesQuery({
            page: targetPage,
            q: search,
            role,
            session: sessionFilter,
            sort: sortBy,
            dir: sortDir,
          }),
      });
      return;
    }

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
      updated_at: Date | null;
    }>(
      `SELECT id, session_id, role, content, created_at, updated_at
       FROM episodic_memories
       ${where}
       ORDER BY ${memoriesOrderBy(sortBy, sortDir)}
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
      sortBy,
      sortDir,
      sortArrow: memorySortArrow,
      sortLink: (column: MemorySortColumn) =>
        buildMemoriesQuery({
          page: 1,
          q: search,
          role,
          session: sessionFilter,
          sort: column,
          dir: nextSortDir(sortBy, sortDir, column),
        }),
      pageLink: (targetPage: number) =>
        buildMemoriesQuery({
          page: targetPage,
          q: search,
          role,
          session: sessionFilter,
          sort: sortBy,
          dir: sortDir,
        }),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).render('error', { message });
  }
});

memoriesRouter.get('/session/:sessionId', async (req, res) => {
  const sessionId = req.params.sessionId;
  try {
    if (!(await tableExists('episodic_memories'))) {
      res.render('memories/session', { sessionId, messages: [] });
      return;
    }
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
    if (!(await tableExists('episodic_memories'))) {
      res.status(404).render('error', { message: 'Memory store is not available yet' });
      return;
    }
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
  if (await tableExists('episodic_memories')) {
    await query('DELETE FROM episodic_memories WHERE id = $1', [req.params.id]);
  }
  res.redirect('/memories');
});

memoriesRouter.post('/session/:sessionId/delete', async (req, res) => {
  if (await tableExists('episodic_memories')) {
    await query('DELETE FROM episodic_memories WHERE session_id = $1', [
      req.params.sessionId,
    ]);
  }
  res.redirect('/memories');
});
