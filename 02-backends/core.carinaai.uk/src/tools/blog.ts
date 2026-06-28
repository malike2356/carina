import type { Tool } from '../types/index.js';
import {
  approveIncident,
  createIncident,
  deleteIncident,
  getIncident,
  getLastResearchRun,
  getPublishedIncidents,
  getUnsentNewsletterIncidents,
  listIncidents,
  listResearchRuns,
  listSubscribers,
  markNewsletterSent,
  publishIncident,
  rejectIncident,
  updateIncident,
} from '../blog/store.js';
import { generateIncidentPage } from '../blog/page-generator.js';
import { sendIncidentNewsletter } from '../blog/newsletter-send.js';
import { buildResearchPrompt, runResearchDiscovery } from '../blog/research-runner.js';
import { runWebSearch } from './web-search-provider.js';

type BlogAction =
  | 'create'
  | 'list'
  | 'show'
  | 'edit'
  | 'delete'
  | 'approve'
  | 'publish'
  | 'reject'
  | 'review'
  | 'subscriber-list'
  | 'subscriber-stats'
  | 'research-run'
  | 'research-status'
  | 'research-log'
  | 'generate-page'
  | 'newsletter-send'
  | 'search-source';

async function runAction(action: BlogAction, params: Record<string, unknown>): Promise<unknown> {
  const idOrSlug = String(params.id_or_slug ?? params.id ?? params.slug ?? '').trim();

  if (action === 'create') {
    const incident = await createIncident({
      title: String(params.title ?? ''),
      slug: String(params.slug ?? '') || undefined,
      company: String(params.company ?? ''),
      damage: String(params.damage ?? ''),
      category: String(params.category ?? 'security') as never,
      dateOccurred: String(params.date_occurred ?? params.dateOccurred ?? ''),
      bodyHtml: String(params.body_html ?? params.bodyHtml ?? ''),
      sources: Array.isArray(params.sources) ? (params.sources as Array<{ label: string; url: string }>) : [],
      scoutFixHtml: String(params.scout_fix_html ?? params.scoutFixHtml ?? ''),
      status: (params.status ? String(params.status) : 'draft') as never,
    });
    return incident;
  }

  if (action === 'list') {
    return listIncidents({
      status: params.status ? String(params.status) as never : undefined,
      category: params.category ? String(params.category) as never : undefined,
      limit: params.limit ? Number(params.limit) : undefined,
      offset: params.offset ? Number(params.offset) : undefined,
    });
  }

  if (action === 'show') {
    return idOrSlug ? getIncident(idOrSlug) : null;
  }

  if (action === 'edit') {
    if (!idOrSlug) return { error: 'id_or_slug required' };
    return updateIncident(idOrSlug, {
      title: params.title ? String(params.title) : undefined,
      slug: params.slug ? String(params.slug) : undefined,
      company: params.company ? String(params.company) : undefined,
      damage: params.damage ? String(params.damage) : undefined,
      category: params.category ? String(params.category) as never : undefined,
      dateOccurred: params.date_occurred ? String(params.date_occurred) : undefined,
      bodyHtml: params.body_html ? String(params.body_html) : undefined,
      sources: Array.isArray(params.sources) ? (params.sources as Array<{ label: string; url: string }>) : undefined,
      scoutFixHtml: params.scout_fix_html ? String(params.scout_fix_html) : undefined,
      status: params.status ? String(params.status) as never : undefined,
    });
  }

  if (action === 'delete') {
    if (!idOrSlug) return { error: 'id_or_slug required' };
    return deleteIncident(idOrSlug);
  }

  if (action === 'approve') {
    if (!idOrSlug) return { error: 'id_or_slug required' };
    return approveIncident(idOrSlug, String(params.approved_by ?? 'carina'));
  }

  if (action === 'publish') {
    if (!idOrSlug) return { error: 'id_or_slug required' };
    return publishIncident(idOrSlug);
  }

  if (action === 'reject') {
    if (!idOrSlug) return { error: 'id_or_slug required' };
    return rejectIncident(idOrSlug, params.reason ? String(params.reason) : undefined);
  }

  if (action === 'review') {
    return listIncidents({ status: 'draft', limit: 100 });
  }

  if (action === 'subscriber-list') {
    return listSubscribers();
  }

  if (action === 'subscriber-stats') {
    const subscribers = await listSubscribers();
    return {
      total: subscribers.length,
      confirmed: subscribers.filter((s) => s.confirmed && !s.unsubscribedAt).length,
      unsubscribed: subscribers.filter((s) => Boolean(s.unsubscribedAt)).length,
    };
  }

  if (action === 'research-run') {
    return runResearchDiscovery({
      query: String(params.query ?? '').trim() || undefined,
      triggeredBy: 'carina-conversation',
    });
  }

  if (action === 'research-status') {
    return getLastResearchRun();
  }

  if (action === 'research-log') {
    const limit = Math.min(100, Math.max(1, Number(params.limit ?? 20) || 20));
    return listResearchRuns(limit);
  }

  if (action === 'generate-page') {
    return generateIncidentPage();
  }

  if (action === 'newsletter-send') {
    return sendIncidentNewsletter();
  }

  if (action === 'search-source') {
    const query = String(params.query ?? '').trim();
    if (!query) return { error: 'query required' };
    return runWebSearch(query, Number(params.limit ?? 5));
  }

  return { error: `Unknown blog action: ${action}` };
}

function blogTool(
  name: string,
  description: string,
  action: BlogAction,
  parameters: Record<string, unknown>,
  dangerous = false,
  requiresConfirmation = dangerous,
): Tool {
  return {
    name,
    description,
    parameters,
    dangerous,
    requiresConfirmation,
    execute: async (params) => runAction(action, params),
  };
}

export const blogTools: Tool[] = [
  blogTool('blog-create', 'Create a blog incident draft.', 'create', {
    type: 'object',
    properties: {
      title: { type: 'string' },
      slug: { type: 'string' },
      company: { type: 'string' },
      damage: { type: 'string' },
      category: { type: 'string', enum: ['financial', 'security', 'brand', 'legal'] },
      date_occurred: { type: 'string' },
      body_html: { type: 'string' },
      sources: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            label: { type: 'string' },
            url: { type: 'string' },
          },
          required: ['label', 'url'],
        },
      },
      scout_fix_html: { type: 'string' },
      status: { type: 'string', enum: ['draft', 'approved', 'published', 'rejected'] },
    },
    required: ['title', 'company', 'damage', 'category', 'date_occurred', 'body_html', 'sources', 'scout_fix_html'],
  }, true),
  blogTool('blog-list', 'List incident blog entries.', 'list', {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['draft', 'approved', 'published', 'rejected'] },
      category: { type: 'string', enum: ['financial', 'security', 'brand', 'legal'] },
      limit: { type: 'number' },
      offset: { type: 'number' },
    },
  }),
  blogTool('blog-show', 'Show one incident blog entry.', 'show', {
    type: 'object',
    properties: {
      id_or_slug: { type: 'string' },
    },
    required: ['id_or_slug'],
  }),
  blogTool('blog-edit', 'Edit an incident blog entry.', 'edit', {
    type: 'object',
    properties: {
      id_or_slug: { type: 'string' },
      title: { type: 'string' },
      slug: { type: 'string' },
      company: { type: 'string' },
      damage: { type: 'string' },
      category: { type: 'string', enum: ['financial', 'security', 'brand', 'legal'] },
      date_occurred: { type: 'string' },
      body_html: { type: 'string' },
      sources: { type: 'array' },
      scout_fix_html: { type: 'string' },
      status: { type: 'string', enum: ['draft', 'approved', 'published', 'rejected'] },
    },
    required: ['id_or_slug'],
  }, true),
  blogTool('blog-delete', 'Delete an incident blog entry.', 'delete', {
    type: 'object',
    properties: { id_or_slug: { type: 'string' } },
    required: ['id_or_slug'],
  }, true),
  blogTool('blog-approve', 'Approve an incident draft.', 'approve', {
    type: 'object',
    properties: {
      id_or_slug: { type: 'string' },
      approved_by: { type: 'string' },
    },
    required: ['id_or_slug'],
  }, true),
  blogTool('blog-publish', 'Publish an approved incident.', 'publish', {
    type: 'object',
    properties: {
      id_or_slug: { type: 'string' },
    },
    required: ['id_or_slug'],
  }, true),
  blogTool('blog-reject', 'Reject an incident draft.', 'reject', {
    type: 'object',
    properties: {
      id_or_slug: { type: 'string' },
      reason: { type: 'string' },
    },
    required: ['id_or_slug'],
  }, true),
  blogTool('blog-review', 'List draft incidents awaiting approval.', 'review', {
    type: 'object',
    properties: {},
  }),
  blogTool('blog-subscriber-list', 'List incident blog subscribers.', 'subscriber-list', {
    type: 'object',
    properties: {},
  }),
  blogTool('blog-subscriber-stats', 'Summarize subscriber counts.', 'subscriber-stats', {
    type: 'object',
    properties: {},
  }),
  blogTool('blog-research-run', 'Run incident research and draft new entries.', 'research-run', {
    type: 'object',
    properties: {
      query: { type: 'string' },
    },
  }, true),
  blogTool('blog-research-status', 'Show the latest incident research run.', 'research-status', {
    type: 'object',
    properties: {},
  }),
  blogTool('blog-research-log', 'Show incident research run history.', 'research-log', {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Maximum runs to return (1-100, default 20).' },
    },
  }),
  blogTool('blog-generate-page', 'Regenerate the public incidents page.', 'generate-page', {
    type: 'object',
    properties: {},
  }, true),
  blogTool('blog-newsletter-send', 'Send the incident newsletter to active subscribers.', 'newsletter-send', {
    type: 'object',
    properties: {},
  }, true),
  blogTool('blog-search-source', 'Search the web for a possible incident source.', 'search-source', {
    type: 'object',
    properties: {
      query: { type: 'string' },
      limit: { type: 'number' },
    },
    required: ['query'],
  }),
];
