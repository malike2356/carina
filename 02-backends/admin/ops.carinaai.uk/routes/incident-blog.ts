import { Router } from 'express';
import { carinaGet, carinaJson, carinaPost, carinaPut } from '../lib/carina.js';

export const incidentBlogRouter = Router();

const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;
const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest added' },
  { value: 'incident_date', label: 'Incident date' },
  { value: 'updated', label: 'Last updated' },
] as const;

function parseSort(value: unknown): string {
  const raw = String(value ?? '').trim();
  return SORT_OPTIONS.some((option) => option.value === raw) ? raw : 'newest';
}

function parseQuery(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function parsePage(value: unknown): number {
  const page = Number(value);
  return Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;
}

function parseLimit(value: unknown): number {
  const limit = Number(value);
  return PAGE_SIZE_OPTIONS.includes(limit as typeof PAGE_SIZE_OPTIONS[number])
    ? limit
    : DEFAULT_PAGE_SIZE;
}

function buildIncidentBlogQuery(opts: {
  page?: number;
  limit?: number;
  status?: string;
  category?: string;
  sort?: string;
}): string {
  const params = new URLSearchParams();
  if (opts.page && opts.page > 1) params.set('page', String(opts.page));
  if (opts.limit) params.set('limit', String(opts.limit));
  if (opts.status) params.set('status', opts.status);
  if (opts.category) params.set('category', opts.category);
  if (opts.sort && opts.sort !== 'newest') params.set('sort', opts.sort);
  const query = params.toString();
  return query ? `?${query}` : '';
}

function paginateIncidents(
  incidents: Array<Record<string, unknown>>,
  page: number,
  limit: number,
  apiPagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  },
): {
  incidents: Array<Record<string, unknown>>;
  pagination: { page: number; limit: number; total: number; totalPages: number };
} {
  if (apiPagination) {
    return { incidents, pagination: apiPagination };
  }
  const total = incidents.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const offset = (safePage - 1) * limit;
  return {
    incidents: incidents.slice(offset, offset + limit),
    pagination: { page: safePage, limit, total, totalPages },
  };
}

function flashQueryString(query: Record<string, unknown>): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (typeof value === 'string' && value) params.set(key, value);
    else if (Array.isArray(value)) {
      const first = value.find((entry) => typeof entry === 'string' && entry);
      if (typeof first === 'string') params.set(key, first);
    }
  }
  return params;
}

incidentBlogRouter.get('/', async (req, res) => {
  try {
    const status = parseQuery(req.query.status);
    const category = parseQuery(req.query.category);
    const sort = parseSort(req.query.sort);
    const page = parsePage(req.query.page);
    const limit = parseLimit(req.query.limit);
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', String(limit));
    params.set('sort', sort);
    if (status) params.set('status', status);
    if (category) params.set('category', category);
    const response = await carinaGet(`/api/incident-blog/admin/incidents?${params}`, 15000);
    const incidents = await carinaJson<{
      incidents: Array<Record<string, unknown>>;
      stats?: {
        draftCount: number;
        approvedCount: number;
        publishedCount: number;
        rejectedCount: number;
      };
      pagination?: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      };
    }>(response);
    const subscribersResponse = await carinaGet('/api/incident-blog/admin/subscribers');
    const subscribers = await carinaJson<{ subscribers: Array<Record<string, unknown>> }>(subscribersResponse);
    const researchResponse = await carinaGet('/api/incident-blog/admin/research-status');
    const researchPayload = await carinaJson<{ run: Record<string, unknown> | null }>(researchResponse);
    if (!incidents.ok || !subscribers.ok) {
      throw new Error(incidents.error ?? subscribers.error ?? 'Failed to load incident blog data');
    }
    const apiStats = incidents.data?.stats;
    const listed = paginateIncidents(
      incidents.data!.incidents,
      page,
      limit,
      incidents.data?.pagination,
    );
    res.render('incident-blog/list', {
      title: 'Incident Blog',
      incidents: listed.incidents,
      subscribers: subscribers.data!.subscribers,
      stats: {
        draftCount: apiStats?.draftCount ?? 0,
        approvedCount: apiStats?.approvedCount ?? 0,
        publishedCount: apiStats?.publishedCount ?? 0,
        rejectedCount: apiStats?.rejectedCount ?? 0,
        subscriberCount: subscribers.data!.subscribers.length,
      },
      filters: { status: status ?? '', category: category ?? '', sort },
      page: listed.pagination.page,
      totalPages: listed.pagination.totalPages,
      total: listed.pagination.total,
      limit: listed.pagination.limit,
      pageSizeOptions: PAGE_SIZE_OPTIONS,
      sortOptions: SORT_OPTIONS,
      pageLink: (targetPage: number) => buildIncidentBlogQuery({
        page: targetPage,
        limit,
        status: status ?? '',
        category: category ?? '',
        sort,
      }),
      flashQuery: flashQueryString(req.query as Record<string, unknown>),
      query: req.query,
      lastResearchRun: researchPayload.ok ? researchPayload.data?.run ?? null : null,
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
      query: req.query,
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
    const id = String(payload.data.incident.id ?? '');
    res.redirect(`/admin/incident-blog/${encodeURIComponent(id)}?ok=create`);
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
    query: req.body.query ?? '',
  }, 120000);
  const payload = await carinaJson<{
    ok?: boolean;
    drafted?: number;
    skipped?: number;
    candidates?: number;
    errors?: string[];
    error?: string;
  }>(response);
  if (!payload.ok) {
    res.redirect('/admin/incident-blog?err=' + encodeURIComponent(payload.error ?? 'Research failed'));
    return;
  }
  const params = new URLSearchParams({
    ok: 'research',
    drafted: String(payload.data?.drafted ?? 0),
    skipped: String(payload.data?.skipped ?? 0),
    candidates: String(payload.data?.candidates ?? 0),
  });
  if (payload.data?.errors?.length) {
    params.set('err', payload.data.errors[0] ?? '');
  }
  res.redirect('/admin/incident-blog?' + params.toString());
});

incidentBlogRouter.post('/reject-drafts', async (_req, res) => {
  const response = await carinaPost('/api/incident-blog/admin/reject-drafts', {
    reason: 'Cleared from draft queue',
  });
  const payload = await carinaJson<{ ok?: boolean; rejected?: number; error?: string }>(response);
  if (!payload.ok) {
    res.redirect('/admin/incident-blog?err=' + encodeURIComponent(payload.error ?? 'Unable to clear drafts'));
    return;
  }
  res.redirect('/admin/incident-blog?ok=reject-drafts&count=' + String(payload.data?.rejected ?? 0));
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
