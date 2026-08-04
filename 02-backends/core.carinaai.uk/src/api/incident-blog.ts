import { Router, type IRouter, type Request, type Response } from 'express';
import {
  approveIncident,
  createIncident,
  confirmSubscriber,
  deleteIncident,
  countIncidents,
  getIncidentBlogAutomationSettings,
  getIncident,
  getIncidentStatusStats,
  getLastResearchRun,
  listIncidents,
  listResearchRuns,
  listSubscribers,
  parseIncidentListSort,
  subscribe,
  unsubscribe,
  publishIncident,
  rejectIncident,
  rejectAllDrafts,
  updateIncidentBlogAutomationSettings,
  updateIncident,
} from '../blog/store.js';
import { generateIncidentPage } from '../blog/page-generator.js';
import { sendIncidentNewsletter } from '../blog/newsletter-send.js';
import { sendSubscribeConfirmationEmail } from '../blog/subscribe-email.js';
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
    const result = await subscribe(email, String(req.body?.source ?? 'incidents-page'));
    if (result.outcome === 'already_confirmed') {
      res.json({
        ok: true,
        subscribed: true,
        email: result.subscriber.email,
        message: 'Already subscribed.',
      });
      return;
    }
    if (result.outcome === 'pending') {
      const token = result.subscriber.confirmToken;
      if (!token) {
        res.status(500).json({ error: 'Subscription token missing' });
        return;
      }
      await sendSubscribeConfirmationEmail(result.subscriber.email, token);
      res.json({
        ok: true,
        subscribed: true,
        email: result.subscriber.email,
        message: 'Check your email to confirm your subscription.',
        confirmToken: process.env.NODE_ENV === 'production' ? undefined : token,
      });
      return;
    }
    const token = result.subscriber.confirmToken;
    if (!token) {
      res.status(500).json({ error: 'Subscription token missing' });
      return;
    }
    await sendSubscribeConfirmationEmail(result.subscriber.email, token);
    res.json({
      ok: true,
      subscribed: true,
      email: result.subscriber.email,
      message: 'Check your email to confirm your subscription.',
      confirmToken: process.env.NODE_ENV === 'production' ? undefined : token,
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
  const sort = parseIncidentListSort(req.query.sort);
  const pageParam = req.query.page;
  const limitParam = req.query.limit;
  const page = pageParam ? Math.max(1, Number(pageParam) || 1) : undefined;
  const limit = limitParam
    ? Math.min(100, Math.max(1, Number(limitParam) || 20))
    : (page ? 20 : 200);
  const offset = page ? (page - 1) * limit : 0;
  const [incidents, total, stats] = await Promise.all([
    listIncidents({ status, category, limit, offset, sort }),
    countIncidents({ status, category }),
    getIncidentStatusStats(),
  ]);
  const effectivePage = page ?? 1;
  res.json({
    incidents,
    stats,
    pagination: page
      ? {
          page: effectivePage,
          limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / limit)),
        }
      : undefined,
  });
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
  try {
    const incident = await approveIncident(String(req.params.id), String(req.body?.approvedBy ?? 'ops'));
    if (!incident) {
      res.status(404).json({ error: 'Incident not found' });
      return;
    }
    res.json({ incident });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

incidentBlogRouter.post('/admin/incidents/:id/publish', async (req: Request, res: Response) => {
  if (!requireOps(req, res)) return;
  try {
    const incident = await publishIncident(String(req.params.id));
    if (!incident) {
      res.status(404).json({ error: 'Incident not found' });
      return;
    }
    const settings = await getIncidentBlogAutomationSettings();
    if (settings.newsletterEnabled && settings.newsletterMode === 'on_publish') {
      await sendIncidentNewsletter();
    }
    res.json({ incident });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

incidentBlogRouter.post('/admin/incidents/:id/reject', async (req: Request, res: Response) => {
  if (!requireOps(req, res)) return;
  try {
    const incident = await rejectIncident(String(req.params.id), String(req.body?.reason ?? ''));
    if (!incident) {
      res.status(404).json({ error: 'Incident not found' });
      return;
    }
    res.json({ incident });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

incidentBlogRouter.delete('/admin/incidents/:id', async (req: Request, res: Response) => {
  if (!requireOps(req, res)) return;
  try {
    const deleted = await deleteIncident(String(req.params.id));
    if (!deleted) {
      res.status(404).json({ error: 'Incident not found' });
      return;
    }
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

incidentBlogRouter.post('/admin/incidents/:id/delete', async (req: Request, res: Response) => {
  if (!requireOps(req, res)) return;
  try {
    const deleted = await deleteIncident(String(req.params.id));
    if (!deleted) {
      res.status(404).json({ error: 'Incident not found' });
      return;
    }
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
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
  const query = String(req.body?.query ?? '').trim();
  const result = await runResearchDiscovery({
    query: query || undefined,
    triggeredBy: 'admin-ui',
  });
  res.json({ ok: true, ...result });
});

incidentBlogRouter.post('/admin/reject-drafts', async (req: Request, res: Response) => {
  if (!requireOps(req, res)) return;
  const count = await rejectAllDrafts(String(req.body?.reason ?? 'Cleared from draft queue'));
  res.json({ ok: true, rejected: count });
});

incidentBlogRouter.get('/admin/settings', async (req: Request, res: Response) => {
  if (!requireOps(req, res)) return;
  res.json({ settings: await getIncidentBlogAutomationSettings() });
});

incidentBlogRouter.patch('/admin/settings', async (req: Request, res: Response) => {
  if (!requireOps(req, res)) return;
  try {
    const newsletterMode =
      req.body?.newsletterMode === 'manual' ||
      req.body?.newsletterMode === 'on_publish' ||
      req.body?.newsletterMode === 'digest'
        ? req.body.newsletterMode
        : undefined;
    const settings = await updateIncidentBlogAutomationSettings({
      researchEnabled: typeof req.body?.researchEnabled === 'boolean' ? req.body.researchEnabled : undefined,
      autoApproveEnabled: typeof req.body?.autoApproveEnabled === 'boolean' ? req.body.autoApproveEnabled : undefined,
      autoPublishEnabled: typeof req.body?.autoPublishEnabled === 'boolean' ? req.body.autoPublishEnabled : undefined,
      newsletterEnabled: typeof req.body?.newsletterEnabled === 'boolean' ? req.body.newsletterEnabled : undefined,
      newsletterMode,
      minSourcesForAutoApprove: req.body?.minSourcesForAutoApprove != null
        ? Math.max(1, Number(req.body.minSourcesForAutoApprove) || 1)
        : undefined,
      minSourcesForAutoPublish: req.body?.minSourcesForAutoPublish != null
        ? Math.max(1, Number(req.body.minSourcesForAutoPublish) || 1)
        : undefined,
      updatedBy: String(req.body?.updatedBy ?? 'ops'),
    });
    res.json({ settings });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

incidentBlogRouter.get('/admin/research-status', async (req: Request, res: Response) => {
  if (!requireOps(req, res)) return;
  res.json({ run: await getLastResearchRun() });
});

incidentBlogRouter.get('/admin/research-log', async (req: Request, res: Response) => {
  if (!requireOps(req, res)) return;
  const limitParam = req.query.limit;
  const limit = limitParam ? Math.min(100, Math.max(1, Number(limitParam) || 20)) : 20;
  const runs = await listResearchRuns(limit);
  res.json({
    runs: runs.map((run) => ({
      id: run.id,
      runAt: run.runAt,
      triggeredBy: run.triggeredBy,
      foundCount: run.foundCount,
      draftedCount: run.draftedCount,
      skippedCount: run.skippedCount,
      errorLog: run.errorLog,
    })),
  });
});
