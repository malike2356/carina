import { Router, type Request, type Response } from 'express';
import { createChannelLinkService, type OperatorChannel } from '../../messaging/channel-links.js';

function parseString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function parseBoolean(value: unknown): boolean {
  return value === true || value === 'true';
}

function parseChannel(value: string): OperatorChannel | null {
  if (value === 'telegram' || value === 'whatsapp' || value === 'slack') return value;
  return null;
}

export const internalChannelLinksRouter = Router();

internalChannelLinksRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  const organizationId = parseString(req.query.organization_id);
  if (!organizationId) {
    res.status(400).json({ error: 'organization_id is required' });
    return;
  }

  try {
    const { pool } = await import('../../event-server/db.js');
    const service = createChannelLinkService({
      pool,
      now: () => new Date(),
    });
    const [links, panicMode] = await Promise.all([
      service.listLinks(organizationId),
      service.getPanicMode(organizationId),
    ]);
    res.json({ ok: true, organization_id: organizationId, links, panic_mode: panicMode });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

internalChannelLinksRouter.post('/:channel/link-code', async (req: Request, res: Response): Promise<void> => {
  const organizationId = parseString((req.body ?? {}).organization_id ?? req.body?.organizationId);
  const dashboardUserId = parseString((req.body ?? {}).dashboard_user_id ?? req.body?.dashboardUserId) || organizationId;
  const channel = parseChannel(String(req.params.channel ?? ''));

  if (!organizationId) {
    res.status(400).json({ error: 'organization_id is required' });
    return;
  }
  if (!channel) {
    res.status(400).json({ error: 'channel must be telegram, whatsapp, or slack' });
    return;
  }

  try {
    const { pool } = await import('../../event-server/db.js');
    const service = createChannelLinkService({
      pool,
      now: () => new Date(),
    });
    const outcome = await service.createLinkCode({
      organizationId,
      dashboardUserId,
      channel,
      role: parseString((req.body ?? {}).role) === 'owner' ? 'owner' : 'operator',
      metadata: typeof (req.body as Record<string, unknown>).metadata === 'object'
        ? ((req.body as Record<string, unknown>).metadata as Record<string, unknown>)
        : {},
    });

    if (!outcome.ok) {
      res.status(outcome.status).json({ error: outcome.error, code: outcome.code });
      return;
    }

    res.json({
      ok: true,
      organization_id: organizationId,
      channel: outcome.channel,
      role: outcome.role,
      code: outcome.code,
      expires_at: outcome.expires_at,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

internalChannelLinksRouter.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  const organizationId = parseString(req.body?.organization_id ?? req.query.organization_id);
  const linkId = parseString(req.params.id);
  if (!organizationId) {
    res.status(400).json({ error: 'organization_id is required' });
    return;
  }
  if (!linkId) {
    res.status(400).json({ error: 'id is required' });
    return;
  }

  try {
    const { pool } = await import('../../event-server/db.js');
    const service = createChannelLinkService({
      pool,
      now: () => new Date(),
    });
    const ok = await service.revokeLink(organizationId, linkId);
    if (!ok) {
      res.status(404).json({ error: 'Link not found' });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

internalChannelLinksRouter.patch('/org-settings', async (req: Request, res: Response): Promise<void> => {
  const organizationId = parseString((req.body ?? {}).organization_id ?? req.body?.organizationId);
  if (!organizationId) {
    res.status(400).json({ error: 'organization_id is required' });
    return;
  }

  try {
    const { pool } = await import('../../event-server/db.js');
    const service = createChannelLinkService({
      pool,
      now: () => new Date(),
    });
    const settings = await service.setPanicMode(organizationId, parseBoolean((req.body ?? {}).panic_mode ?? req.body?.panicMode));
    res.json({ ok: true, settings });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});
