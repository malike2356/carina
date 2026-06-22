import { Router } from 'express';
import { carinaGet, carinaJson, carinaPost, carinaPut } from '../lib/carina.js';

export const incidentBlogRouter = Router();

function parseQuery(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

incidentBlogRouter.get('/', async (req, res) => {
  try {
    const params = new URLSearchParams();
    const status = parseQuery(req.query.status);
    const category = parseQuery(req.query.category);
    if (status) params.set('status', status);
    if (category) params.set('category', category);
    const response = await carinaGet(`/api/incident-blog/admin/incidents${params.toString() ? `?${params}` : ''}`);
    const incidents = await carinaJson<{ incidents: Array<Record<string, unknown>> }>(response);
    const subscribersResponse = await carinaGet('/api/incident-blog/admin/subscribers');
    const subscribers = await carinaJson<{ subscribers: Array<Record<string, unknown>> }>(subscribersResponse);
    if (!incidents.ok || !subscribers.ok) {
      throw new Error(incidents.error ?? subscribers.error ?? 'Failed to load incident blog data');
    }
    const draftCount = incidents.data!.incidents.filter((item) => item.status === 'draft').length;
    const approvedCount = incidents.data!.incidents.filter((item) => item.status === 'approved').length;
    const publishedCount = incidents.data!.incidents.filter((item) => item.status === 'published').length;
    const rejectedCount = incidents.data!.incidents.filter((item) => item.status === 'rejected').length;
    res.render('incident-blog/list', {
      title: 'Incident Blog',
      incidents: incidents.data!.incidents,
      subscribers: subscribers.data!.subscribers,
      stats: {
        draftCount,
        approvedCount,
        publishedCount,
        rejectedCount,
        subscriberCount: subscribers.data!.subscribers.length,
      },
      filters: { status: status ?? '', category: category ?? '' },
      query: req.query,
    });
  } catch (err) {
    res.status(500).render('error', { message: err instanceof Error ? err.message : String(err) });
  }
});

incidentBlogRouter.get('/new', async (_req, res) => {
  res.render('incident-blog/edit', {
    title: 'Create Incident',
    incident: null,
    action: '/admin/incident-blog/create',
  });
});

incidentBlogRouter.get('/subscribers/list', async (_req, res) => {
  const response = await carinaGet('/api/incident-blog/admin/subscribers');
  const payload = await carinaJson<{ subscribers: Array<Record<string, unknown>> }>(response);
  if (!payload.ok || !payload.data) {
    res.status(payload.status).render('error', { message: payload.error ?? 'Unable to load subscribers' });
    return;
  }
  res.render('incident-blog/subscribers', {
    title: 'Incident Subscribers',
    subscribers: payload.data.subscribers,
  });
});

incidentBlogRouter.get('/:id([0-9a-fA-F-]{36})', async (req, res) => {
  try {
    const response = await carinaGet(`/api/incident-blog/admin/incidents/${encodeURIComponent(req.params.id)}`);
    const payload = await carinaJson<{ incident: Record<string, unknown> }>(response);
    if (!payload.ok || !payload.data) {
      res.status(payload.status).render('error', { message: payload.error ?? 'Incident not found' });
      return;
    }
    res.render('incident-blog/view', {
      title: String(payload.data.incident.title ?? 'Incident'),
      incident: payload.data.incident,
      query: req.query,
    });
  } catch (err) {
    res.status(500).render('error', { message: err instanceof Error ? err.message : String(err) });
  }
});

incidentBlogRouter.get('/:id([0-9a-fA-F-]{36})/edit', async (req, res) => {
  try {
    const response = await carinaGet(`/api/incident-blog/admin/incidents/${encodeURIComponent(req.params.id)}`);
    const payload = await carinaJson<{ incident: Record<string, unknown> }>(response);
    if (!payload.ok || !payload.data) {
      res.status(payload.status).render('error', { message: payload.error ?? 'Incident not found' });
      return;
    }
    res.render('incident-blog/edit', {
      title: 'Edit Incident',
      incident: payload.data.incident,
      action: `/admin/incident-blog/${encodeURIComponent(req.params.id)}/edit`,
    });
  } catch (err) {
    res.status(500).render('error', { message: err instanceof Error ? err.message : String(err) });
  }
});

incidentBlogRouter.post('/create', async (req, res) => {
  try {
    const response = await carinaPost('/api/incident-blog/admin/incidents', {
      title: req.body.title,
      slug: req.body.slug,
      company: req.body.company,
      damage: req.body.damage,
      category: req.body.category,
      status: req.body.status,
      dateOccurred: req.body.dateOccurred ?? req.body.date_occurred,
      bodyHtml: req.body.bodyHtml ?? req.body.body_html,
      scoutFixHtml: req.body.scoutFixHtml ?? req.body.scout_fix_html,
      sources: parseSources(req.body),
    });
    const payload = await carinaJson<{ incident: Record<string, unknown> }>(response);
    if (!payload.ok || !payload.data) throw new Error(payload.error ?? 'Create failed');
    res.redirect('/admin/incident-blog?ok=create');
  } catch (err) {
    res.redirect('/admin/incident-blog?err=' + encodeURIComponent(err instanceof Error ? err.message : String(err)));
  }
});

incidentBlogRouter.post('/:id([0-9a-fA-F-]{36})/edit', async (req, res) => {
  try {
    const response = await carinaPut(`/api/incident-blog/admin/incidents/${encodeURIComponent(req.params.id)}`, {
      title: req.body.title,
      slug: req.body.slug,
      company: req.body.company,
      damage: req.body.damage,
      category: req.body.category,
      status: req.body.status,
      dateOccurred: req.body.dateOccurred ?? req.body.date_occurred,
      bodyHtml: req.body.bodyHtml ?? req.body.body_html,
      scoutFixHtml: req.body.scoutFixHtml ?? req.body.scout_fix_html,
      sources: parseSources(req.body),
    });
    const payload = await carinaJson<{ incident: Record<string, unknown> }>(response);
    if (!payload.ok || !payload.data) throw new Error(payload.error ?? 'Save failed');
    res.redirect(`/admin/incident-blog/${encodeURIComponent(req.params.id)}?ok=edit`);
  } catch (err) {
    res.redirect(`/admin/incident-blog/${encodeURIComponent(req.params.id)}/edit?err=` + encodeURIComponent(err instanceof Error ? err.message : String(err)));
  }
});

incidentBlogRouter.post('/:id([0-9a-fA-F-]{36})/approve', async (req, res) => {
  const result = await carinaPost(`/api/incident-blog/admin/incidents/${encodeURIComponent(req.params.id)}/approve`, {
    approvedBy: req.body.approvedBy ?? 'ops',
  });
  const payload = await carinaJson(result);
  if (!payload.ok) {
    res.redirect(`/admin/incident-blog/${encodeURIComponent(req.params.id)}?err=` + encodeURIComponent(payload.error ?? 'Approve failed'));
    return;
  }
  res.redirect(`/admin/incident-blog/${encodeURIComponent(req.params.id)}?ok=approve`);
});

incidentBlogRouter.post('/:id([0-9a-fA-F-]{36})/publish', async (req, res) => {
  const result = await carinaPost(`/api/incident-blog/admin/incidents/${encodeURIComponent(req.params.id)}/publish`, {});
  const payload = await carinaJson(result);
  if (!payload.ok) {
    res.redirect(`/admin/incident-blog/${encodeURIComponent(req.params.id)}?err=` + encodeURIComponent(payload.error ?? 'Publish failed'));
    return;
  }
  res.redirect(`/admin/incident-blog/${encodeURIComponent(req.params.id)}?ok=publish`);
});

incidentBlogRouter.post('/:id([0-9a-fA-F-]{36})/reject', async (req, res) => {
  const result = await carinaPost(`/api/incident-blog/admin/incidents/${encodeURIComponent(req.params.id)}/reject`, {
    reason: req.body.reason ?? '',
  });
  const payload = await carinaJson(result);
  if (!payload.ok) {
    res.redirect(`/admin/incident-blog/${encodeURIComponent(req.params.id)}?err=` + encodeURIComponent(payload.error ?? 'Reject failed'));
    return;
  }
  res.redirect(`/admin/incident-blog/${encodeURIComponent(req.params.id)}?ok=reject`);
});

incidentBlogRouter.post('/:id([0-9a-fA-F-]{36})/delete', async (req, res) => {
  const result = await carinaPost(`/api/incident-blog/admin/incidents/${encodeURIComponent(req.params.id)}/delete`, {});
  const payload = await carinaJson(result);
  if (!payload.ok) {
    res.redirect(`/admin/incident-blog/${encodeURIComponent(req.params.id)}?err=` + encodeURIComponent(payload.error ?? 'Delete failed'));
    return;
  }
  res.redirect('/admin/incident-blog?ok=delete');
});

incidentBlogRouter.post('/newsletter/send', async (_req, res) => {
  const response = await carinaPost('/api/incident-blog/admin/newsletter/send', {});
  const payload = await carinaJson(response);
  res.redirect('/admin/incident-blog?ok=newsletter' + (payload.ok ? '' : `&err=${encodeURIComponent(payload.error ?? 'Newsletter failed')}`));
});

incidentBlogRouter.post('/generate-page', async (_req, res) => {
  const response = await carinaPost('/api/incident-blog/admin/generate-page', {});
  const payload = await carinaJson(response);
  res.redirect('/admin/incident-blog?ok=page' + (payload.ok ? '' : `&err=${encodeURIComponent(payload.error ?? 'Page generation failed')}`));
});

incidentBlogRouter.post('/research-run', async (req, res) => {
  const response = await carinaPost('/api/incident-blog/admin/research-run', {
    query: req.body.query ?? 'AI agent incident 2026',
  });
  const payload = await carinaJson(response);
  res.redirect('/admin/incident-blog?ok=research' + (payload.ok ? '' : `&err=${encodeURIComponent(payload.error ?? 'Research failed')}`));
});

function parseSources(body: Record<string, unknown>): Array<{ label: string; url: string }> {
  const labels = Array.isArray(body.source_label)
    ? body.source_label
    : body.source_label ? [body.source_label] : [];
  const urls = Array.isArray(body.source_url)
    ? body.source_url
    : body.source_url ? [body.source_url] : [];
  const length = Math.max(labels.length, urls.length);
  const sources: Array<{ label: string; url: string }> = [];
  for (let i = 0; i < length; i += 1) {
    const label = String(labels[i] ?? '').trim();
    const url = String(urls[i] ?? '').trim();
    if (label && url) sources.push({ label, url });
  }
  return sources;
}
