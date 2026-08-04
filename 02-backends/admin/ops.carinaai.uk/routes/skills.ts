import { Router } from 'express';
import { query } from '../lib/db.js';
import { TOOL_NAMES } from '../lib/constants.js';
import {
  ORDER_BY_RECENT_ACTIVITY,
  buildPageWindow,
  parsePageSize,
} from '../lib/list-sort.js';

export const skillsRouter = Router();

const DEFAULT_PAGE_SIZE = 25;

function buildSkillsQuery(params: {
  page?: number;
  q?: string;
  limit?: number;
}): string {
  const search = new URLSearchParams();
  if (params.q) search.set('q', params.q);
  if (params.limit && params.limit !== DEFAULT_PAGE_SIZE) search.set('limit', String(params.limit));
  if (params.page && params.page > 1) search.set('page', String(params.page));
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

function parseKeywords(raw: string): string[] {
  return raw
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);
}

function parseTools(body: Record<string, unknown>): string[] {
  const selected = body.tools;
  if (Array.isArray(selected)) {
    return selected.map(String);
  }
  if (typeof selected === 'string') {
    return [selected];
  }
  return [];
}

skillsRouter.get('/', async (req, res) => {
  try {
    const search = String(req.query.q ?? '').trim();
    const pageSize = parsePageSize(req.query.limit, DEFAULT_PAGE_SIZE);
    let page = Math.max(1, Number(req.query.page) || 1);

    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;
    if (search) {
      conditions.push(
        `(name ILIKE $${paramIndex} OR description ILIKE $${paramIndex} OR steps ILIKE $${paramIndex})`,
      );
      params.push(`%${search}%`);
      paramIndex += 1;
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM skill_documents ${where}`,
      params,
    );
    const total = Number(countResult.rows[0]?.count ?? 0);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    page = Math.min(page, totalPages);
    const offset = (page - 1) * pageSize;

    const rows = await query<{
      id: string;
      name: string;
      description: string;
      trigger_keywords: string[];
      usage_count: number;
      created_at: Date;
      updated_at: Date;
    }>(
      `SELECT id, name, description, trigger_keywords, usage_count, created_at, updated_at
       FROM skill_documents
       ${where}
       ORDER BY ${ORDER_BY_RECENT_ACTIVITY}
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      [...params, pageSize, offset],
    );

    const queryState = { page, q: search, limit: pageSize };
    res.render('skills/index', {
      skills: rows.rows,
      page,
      pageSize,
      total,
      totalPages,
      search,
      pageWindow: buildPageWindow(page, totalPages),
      pageLink: (targetPage: number) => buildSkillsQuery({ ...queryState, page: targetPage }),
      limitLink: (limit: number) => buildSkillsQuery({ q: search, page: 1, limit }),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).render('error', { message });
  }
});

skillsRouter.get('/new', (_req, res) => {
  res.render('skills/new', {
    skill: null,
    toolNames: TOOL_NAMES,
    error: null,
  });
});

skillsRouter.post('/new', async (req, res) => {
  const name = String(req.body.name ?? '').trim();
  const description = String(req.body.description ?? '').trim();
  const steps = String(req.body.steps ?? '').trim();
  const trigger = parseKeywords(String(req.body.trigger_keywords ?? ''));
  const toolsUsed = parseTools(req.body);

  if (!name || !description || !steps) {
    res.status(400).render('skills/new', {
      skill: req.body,
      toolNames: TOOL_NAMES,
      error: 'Name, description, and steps are required',
    });
    return;
  }

  await query(
    `INSERT INTO skill_documents (name, description, trigger_keywords, steps, tools_used)
     VALUES ($1, $2, $3, $4, $5)`,
    [name, description, trigger, steps, toolsUsed],
  );
  res.redirect('/skills');
});

skillsRouter.get('/:id', async (req, res) => {
  try {
    const rows = await query<{
      id: string;
      name: string;
      description: string;
      trigger_keywords: string[];
      steps: string;
      tools_used: string[];
      usage_count: number;
      created_at: Date;
      updated_at: Date;
    }>('SELECT * FROM skill_documents WHERE id = $1', [req.params.id]);
    const skill = rows.rows[0];
    if (!skill) {
      res.status(404).render('error', { message: 'Skill not found' });
      return;
    }
    res.render('skills/view', { skill, toolNames: TOOL_NAMES, error: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).render('error', { message });
  }
});

skillsRouter.post('/:id', async (req, res) => {
  const name = String(req.body.name ?? '').trim();
  const description = String(req.body.description ?? '').trim();
  const steps = String(req.body.steps ?? '').trim();
  const trigger = parseKeywords(String(req.body.trigger_keywords ?? ''));
  const toolsUsed = parseTools(req.body);

  await query(
    `UPDATE skill_documents
     SET name = $1, description = $2, trigger_keywords = $3,
         steps = $4, tools_used = $5, updated_at = NOW()
     WHERE id = $6`,
    [name, description, trigger, steps, toolsUsed, req.params.id],
  );
  res.redirect(`/skills/${req.params.id}`);
});

skillsRouter.post('/:id/delete', async (req, res) => {
  await query('DELETE FROM skill_documents WHERE id = $1', [req.params.id]);
  res.redirect('/skills');
});

skillsRouter.post('/:id/use', async (req, res) => {
  await query(
    `UPDATE skill_documents
     SET usage_count = usage_count + 1, updated_at = NOW()
     WHERE id = $1`,
    [req.params.id],
  );
  res.redirect(`/skills/${req.params.id}`);
});
