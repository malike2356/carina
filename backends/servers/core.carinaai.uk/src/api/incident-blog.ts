import { Router, type IRouter, type Request, type Response } from 'express';
import {
  approveIncident,
  createIncident,
  confirmSubscriber,
  deleteIncident,
  getIncident,
  getLastResearchRun,
  listIncidents,
  listSubscribers,
  subscribe,
  unsubscribe,
  publishIncident,
  rejectIncident,
  updateIncident,
} from '../blog/store.js';
import { generateIncidentPage } from '../blog/page-generator.js';
import { sendIncidentNewsletter } from '../blog/newsletter-send.js';
import { authorizeOps } from '../ops/ops-auth.js';
import { runResearchDiscovery } from '../blog/research-runner.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const incidentBlogRouter: IRouter = Router();

function requireOps(req: Request, res: Response): boolean {
  if (authorizeOps(req)) return true;
  res.status(401).json({ error: 'Unauthorized' });
  return false;
}

incidentBlogRouter.post('/subscribe', async (req: Request, res: Response) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    res.status(400).json({ error: 'Invalid email address' });
    return;
  }
  try {
    const subscriber = await subscribe(email, String(req.body?.source ?? 'incidents-page'));
    res.json({
      ok: true,
      email: subscriber.email,
      message: 'Check your email to confirm your subscription.',
      confirmToken: process.env.NODE_ENV === 'production' ? undefined : subscriber.confirmToken,
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

incidentBlogRouter.get('/confirm', async (req: Request, res: Response) => {
  const token = String(req.query.token ?? '').trim();
  if (!token) {
    res.redirect('https://labyrinthscout.com/incidents/?error=invalid-token');
    return;
  }
  const ok = await confirmSubscriber(token);
  res.redirect(ok
    ? 'https://labyrinthscout.com/incidents/?subscribed=true'
    : 'https://labyrinthscout.com/incidents/?error=invalid-token');
});

incidentBlogRouter.get('/unsubscribe', async (req: Request, res: Response) => {
  const email = String(req.query.email ?? '').trim().toLowerCase();
  const ok = EMAIL_RE.test(email) ? await unsubscribe(email) : false;
  res.redirect(ok
    ? 'https://labyrinthscout.com/incidents/?unsubscribed=true'
    : 'https://labyrinthscout.com/incidents/?error=invalid-token');
});

incidentBlogRouter.get('/subscribers', async (req: Request, res: Response) => {
  if (!requireOps(req, res)) return;
  const subscribers = await listSubscribers();
  res.json({
    subscribers: subscribers.map((subscriber) => ({
      id: subscriber.id,
      email: subscriber.email,
      confirmed: subscriber.confirmed,
      subscribedAt: subscriber.subscribedAt,
      unsubscribedAt: subscriber.unsubscribedAt,
      lastSentAt: subscriber.lastSentAt,
      source: subscriber.source,
    })),
  });
});

incidentBlogRouter.post('/newsletter/send', async (req: Request, res: Response) => {
  if (!requireOps(req, res)) return;
  try {
    const result = await sendIncidentNewsletter();
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

incidentBlogRouter.get('/admin/incidents', async (req: Request, res: Response) => {
  if (!requireOps(req, res)) return;
  const status = req.query.status ? String(req.query.status) as never : undefined;
  const category = req.query.category ? String(req.query.category) as never : undefined;
  const incidents = await listIncidents({ status, category, limit: 200 });
  res.json({ incidents });
});

incidentBlogRouter.get('/admin/incidents/:id', async (req: Request, res: Response) => {
  if (!requireOps(req, res)) return;
  const incident = await getIncident(String(req.params.id));
  if (!incident) {
    res.status(404).json({ error: 'Incident not found' });
    return;
  }
  res.json({ incident });
});

incidentBlogRouter.post('/admin/incidents', async (req: Request, res: Response) => {
  if (!requireOps(req, res)) return;
  try {
    const incident = await createIncident({
      title: String(req.body?.title ?? ''),
      slug: req.body?.slug ? String(req.body.slug) : undefined,
      company: String(req.body?.company ?? ''),
      damage: String(req.body?.damage ?? ''),
      category: String(req.body?.category ?? 'security') as never,
      dateOccurred: String(req.body?.dateOccurred ?? req.body?.date_occurred ?? ''),
      bodyHtml: String(req.body?.bodyHtml ?? req.body?.body_html ?? ''),
      sources: Array.isArray(req.body?.sources) ? req.body.sources : [],
      scoutFixHtml: String(req.body?.scoutFixHtml ?? req.body?.scout_fix_html ?? ''),
      status: req.body?.status ? String(req.body.status) as never : 'draft',
    });
    res.status(201).json({ incident });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

async function handleUpdateIncident(req: Request, res: Response): Promise<void> {
  if (!requireOps(req, res)) return;
  const incident = await updateIncident(String(req.params.id), {
    title: req.body?.title ? String(req.body.title) : undefined,
    slug: req.body?.slug ? String(req.body.slug) : undefined,
    company: req.body?.company ? String(req.body.company) : undefined,
    damage: req.body?.damage ? String(req.body.damage) : undefined,
    category: req.body?.category ? String(req.body.category) as never : undefined,
    dateOccurred: req.body?.dateOccurred ? String(req.body.dateOccurred) : req.body?.date_occurred ? String(req.body.date_occurred) : undefined,
    bodyHtml: req.body?.bodyHtml ? String(req.body.bodyHtml) : req.body?.body_html ? String(req.body.body_html) : undefined,
    sources: Array.isArray(req.body?.sources) ? req.body.sources : undefined,
    scoutFixHtml: req.body?.scoutFixHtml ? String(req.body.scoutFixHtml) : req.body?.scout_fix_html ? String(req.body.scout_fix_html) : undefined,
    status: req.body?.status ? String(req.body.status) as never : undefined,
  });
  if (!incident) {
    res.status(404).json({ error: 'Incident not found' });
    return;
  }
  res.json({ incident });
}

incidentBlogRouter.patch('/admin/incidents/:id', handleUpdateIncident);
incidentBlogRouter.put('/admin/incidents/:id', handleUpdateIncident);

incidentBlogRouter.post('/admin/incidents/:id/approve', async (req: Request, res: Response) => {
  if (!requireOps(req, res)) return;
  const incident = await approveIncident(String(req.params.id), String(req.body?.approvedBy ?? 'ops'));
  res.json({ incident });
});

incidentBlogRouter.post('/admin/incidents/:id/publish', async (req: Request, res: Response) => {
  if (!requireOps(req, res)) return;
  const incident = await publishIncident(String(req.params.id));
  res.json({ incident });
});

incidentBlogRouter.post('/admin/incidents/:id/reject', async (req: Request, res: Response) => {
  if (!requireOps(req, res)) return;
  const incident = await rejectIncident(String(req.params.id), String(req.body?.reason ?? ''));
  res.json({ incident });
});

incidentBlogRouter.delete('/admin/incidents/:id', async (req: Request, res: Response) => {
  if (!requireOps(req, res)) return;
  res.json({ deleted: await deleteIncident(String(req.params.id)) });
});

incidentBlogRouter.post('/admin/incidents/:id/delete', async (req: Request, res: Response) => {
  if (!requireOps(req, res)) return;
  res.json({ deleted: await deleteIncident(String(req.params.id)) });
});

incidentBlogRouter.get('/admin/subscribers', async (req: Request, res: Response) => {
  if (!requireOps(req, res)) return;
  const subscribers = await listSubscribers();
  res.json({ subscribers });
});

incidentBlogRouter.post('/admin/newsletter/send', async (req: Request, res: Response) => {
  if (!requireOps(req, res)) return;
  const result = await sendIncidentNewsletter();
  res.json({ ok: true, ...result });
});

incidentBlogRouter.post('/admin/generate-page', async (req: Request, res: Response) => {
  if (!requireOps(req, res)) return;
  const result = await generateIncidentPage();
  res.json({ ok: true, ...result });
});

incidentBlogRouter.post('/admin/research-run', async (req: Request, res: Response) => {
  if (!requireOps(req, res)) return;
  const result = await runResearchDiscovery(String(req.body?.query ?? 'AI agent incident 2026'));
  res.json({ ok: true, ...result });
});

incidentBlogRouter.get('/admin/research-status', async (req: Request, res: Response) => {
  if (!requireOps(req, res)) return;
  res.json({ run: await getLastResearchRun() });
});
