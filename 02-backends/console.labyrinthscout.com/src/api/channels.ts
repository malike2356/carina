import { Router, type IRouter, type Request, type Response } from 'express';
import { scopedAccountId } from '../lib/scope.js';
import { requestScoutEngineJson, proxyScoutEngineJson } from '../lib/scout-engine-client.js';

function parseString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function getOrganizationId(req: Request): string {
  const scoped = scopedAccountId(req as never);
  if (scoped) return scoped;
  const sessionId = typeof req.session?.accountId === 'string' ? req.session.accountId.trim() : '';
  if (sessionId) return sessionId;
  const body = (req.body ?? {}) as Record<string, unknown>;
  const fromBody = parseString(body.organization_id || body.organizationId);
  if (fromBody) return fromBody;
  return parseString(req.query.organization_id);
}

export const dashboardChannelsRouter: IRouter = Router();

dashboardChannelsRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  const organizationId = getOrganizationId(req);
  if (!organizationId) {
    res.status(400).json({ error: 'organization_id is required' });
    return;
  }

  const result = await requestScoutEngineJson(req, {
    method: 'GET',
    path: '/api/internal/control/channels',
    query: `organization_id=${encodeURIComponent(organizationId)}`,
  });
  if (!result) {
    res.status(502).json({ error: 'Scout engine unavailable' });
    return;
  }

  res.status(result.status);
  if (result.contentType) res.setHeader('content-type', result.contentType);
  res.send(result.text);
});

dashboardChannelsRouter.post('/:channel/link-code', async (req: Request, res: Response): Promise<void> => {
  const organizationId = getOrganizationId(req);
  if (!organizationId) {
    res.status(400).json({ error: 'organization_id is required' });
    return;
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const dashboardUserId = parseString(body.dashboard_user_id || body.dashboardUserId) || organizationId;
  const ok = await proxyScoutEngineJson(req, res, {
    method: 'POST',
    path: `/api/internal/control/channels/${encodeURIComponent(String(req.params.channel ?? ''))}/link-code`,
    body: {
      ...body,
      organization_id: organizationId,
      dashboard_user_id: dashboardUserId,
    },
  });
  if (!ok) {
    res.status(502).json({ error: 'Scout engine unavailable' });
  }
});

dashboardChannelsRouter.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  const organizationId = getOrganizationId(req);
  if (!organizationId) {
    res.status(400).json({ error: 'organization_id is required' });
    return;
  }

  const ok = await proxyScoutEngineJson(req, res, {
    method: 'DELETE',
    path: `/api/internal/control/channels/${encodeURIComponent(String(req.params.id ?? ''))}`,
    body: {
      organization_id: organizationId,
      action: 'revoke',
    },
  });
  if (!ok) {
    res.status(502).json({ error: 'Scout engine unavailable' });
  }
});

dashboardChannelsRouter.patch('/org-settings', async (req: Request, res: Response): Promise<void> => {
  const organizationId = getOrganizationId(req);
  if (!organizationId) {
    res.status(400).json({ error: 'organization_id is required' });
    return;
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const ok = await proxyScoutEngineJson(req, res, {
    method: 'PATCH',
    path: '/api/internal/control/channels/org-settings',
    body: {
      ...body,
      organization_id: organizationId,
      panic_mode: body.panic_mode ?? body.panicMode,
    },
  });
  if (!ok) {
    res.status(502).json({ error: 'Scout engine unavailable' });
  }
});
