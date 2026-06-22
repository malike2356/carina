import { Router } from 'express';
import {
  archiveDraftSkill,
  getCapabilitiesAudit,
  getLearningImprovements,
  getLearningPending,
  getOperatorStatus,
  getSecurityPosture,
  promoteDraftSkill,
} from '../lib/operator-data.js';

export const operatorRouter = Router();
export const operatorApiRouter = Router();

operatorRouter.use((req, res, next) => {
  res.locals.activePath = req.path === '/' ? '/operator' : `/operator${req.path}`;
  next();
});

function renderError(res: import('express').Response, err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  res.status(500).render('error', { message });
}

function jsonError(res: import('express').Response, err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  res.status(500).json({ ok: false, error: message });
}

operatorRouter.get('/', async (_req, res) => {
  try {
    const [status, pending] = await Promise.all([
      getOperatorStatus(),
      getLearningPending(),
    ]);
    res.render('operator/index', {
      title: 'Operator Tools',
      status,
      drafts: pending.drafts,
    });
  } catch (err) {
    renderError(res, err);
  }
});

operatorRouter.get('/status', async (_req, res) => {
  try {
    const status = await getOperatorStatus();
    res.render('operator/status', { title: 'Operator status', status });
  } catch (err) {
    renderError(res, err);
  }
});

operatorRouter.get('/learning/pending', async (req, res) => {
  try {
    const data = await getLearningPending();
    res.render('operator/pending', {
      title: 'Learning pending review',
      drafts: data.drafts,
      recent_corrections: data.recent_corrections,
      flash: typeof req.query.flash === 'string' ? req.query.flash : null,
    });
  } catch (err) {
    renderError(res, err);
  }
});

operatorRouter.post('/learning/pending/:id/promote', async (req, res) => {
  try {
    const ok = await promoteDraftSkill(req.params.id);
    res.redirect(`/operator/learning/pending?flash=${ok ? 'promoted' : 'missing'}`);
  } catch (err) {
    renderError(res, err);
  }
});

operatorRouter.post('/learning/pending/:id/archive', async (req, res) => {
  try {
    const ok = await archiveDraftSkill(req.params.id);
    res.redirect(`/operator/learning/pending?flash=${ok ? 'archived' : 'missing'}`);
  } catch (err) {
    renderError(res, err);
  }
});

operatorRouter.get('/learning/improvements', async (_req, res) => {
  try {
    const data = await getLearningImprovements();
    res.render('operator/improvements', {
      title: 'Learning improvements',
      improvements: data.improvements,
    });
  } catch (err) {
    renderError(res, err);
  }
});

operatorRouter.get('/capabilities', async (_req, res) => {
  try {
    const payload = await getCapabilitiesAudit();
    res.render('operator/capabilities', { title: 'Capabilities audit', payload });
  } catch (err) {
    renderError(res, err);
  }
});

operatorRouter.get('/security', async (_req, res) => {
  try {
    const payload = await getSecurityPosture();
    res.render('operator/security', { title: 'Operator security', payload });
  } catch (err) {
    renderError(res, err);
  }
});

operatorApiRouter.get('/status', async (_req, res) => {
  try {
    res.json(await getOperatorStatus());
  } catch (err) {
    jsonError(res, err);
  }
});

operatorApiRouter.get('/learning/pending', async (_req, res) => {
  try {
    res.json(await getLearningPending());
  } catch (err) {
    jsonError(res, err);
  }
});

operatorApiRouter.get('/learning/improvements', async (_req, res) => {
  try {
    res.json(await getLearningImprovements());
  } catch (err) {
    jsonError(res, err);
  }
});

operatorApiRouter.get('/learning/events', async (req, res) => {
  try {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 30)));
    const { query } = await import('../lib/db.js');
    const events = await query<{
      id: string;
      event_type: string;
      skill_name: string | null;
      created_at: string;
      input_summary: Record<string, unknown> | null;
      output_summary: Record<string, unknown> | null;
    }>(
      `SELECT id, event_type, skill_name, created_at, input_summary, output_summary
       FROM learning_events
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit],
    );
    res.json({ ok: true, events: events.rows });
  } catch (err) {
    jsonError(res, err);
  }
});

operatorApiRouter.get('/capabilities', async (_req, res) => {
  try {
    res.json(await getCapabilitiesAudit());
  } catch (err) {
    jsonError(res, err);
  }
});

operatorApiRouter.get('/security', async (_req, res) => {
  try {
    res.json(await getSecurityPosture());
  } catch (err) {
    jsonError(res, err);
  }
});
