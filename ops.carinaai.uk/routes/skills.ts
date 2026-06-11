import { Router } from 'express';
import { query } from '../lib/db.js';
import { TOOL_NAMES } from '../lib/constants.js';
import { ORDER_BY_RECENT_ACTIVITY } from '../lib/list-sort.js';

export const skillsRouter = Router();

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

skillsRouter.get('/', async (_req, res) => {
  try {
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
       ORDER BY ${ORDER_BY_RECENT_ACTIVITY}`,
    );
    res.render('skills/index', { skills: rows.rows });
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
