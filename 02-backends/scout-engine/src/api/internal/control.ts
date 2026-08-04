import { Router, type Request, type Response } from 'express';
import type { ControlMetadata } from '../../messaging/control.js';
import { internalChannelLinksRouter } from './channel-links.js';

export interface InternalControlRouterOptions {
  internalKey?: string;
}

export interface ControlRouterService {
  killOrg(organizationId: string, meta?: ControlMetadata): Promise<{ ok: true; audit_code: string } | { ok: false; status: number; error: string; code?: string }>;
  freezeOrg(organizationId: string, meta?: ControlMetadata): Promise<{ ok: true; audit_code: string } | { ok: false; status: number; error: string; code?: string }>;
  pauseAgent(organizationId: string, agentId: string, meta?: ControlMetadata): Promise<{ ok: true; audit_code: string } | { ok: false; status: number; error: string; code?: string }>;
  suspendChannel(organizationId: string, channel: string, meta?: ControlMetadata): Promise<{ ok: true; audit_code: string } | { ok: false; status: number; error: string; code?: string }>;
  quarantineTool(organizationId: string, agentId: string | 'all', toolName: string, meta?: ControlMetadata): Promise<{ ok: true; audit_code: string } | { ok: false; status: number; error: string; code?: string }>;
  restrictOrg(organizationId: string, meta?: ControlMetadata): Promise<{ ok: true; audit_code: string } | { ok: false; status: number; error: string; code?: string }>;
  resumeOrg(organizationId: string, meta?: ControlMetadata): Promise<{ ok: true; audit_code: string } | { ok: false; status: number; error: string; code?: string }>;
  resumeAgent(organizationId: string, agentId: string, meta?: ControlMetadata): Promise<{ ok: true; audit_code: string } | { ok: false; status: number; error: string; code?: string }>;
  getStatus(organizationId: string): Promise<Record<string, unknown>>;
}

function parseString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function parseBoolean(value: unknown): boolean {
  return value === true || value === 'true';
}

function parseMetadata(req: Request): ControlMetadata {
  const body = (req.body ?? {}) as Record<string, unknown>;
  return {
    organizationId: parseString(body.organization_id || body.organizationId),
    dashboardUserId: parseString(body.dashboard_user_id || body.dashboardUserId) || undefined,
    channel: parseString(body.channel) || undefined,
    channelUserRef: parseString(body.channel_user_ref || body.channelUserRef) || undefined,
    chatRef: parseString(body.chat_ref || body.chatRef) || undefined,
    command: parseString(body.command) || undefined,
    reason: parseString(body.reason) || undefined,
    plan: parseString(body.plan || req.header('X-Scout-Plan')) || undefined,
    source: parseString(body.source) || undefined,
    actor: parseString(body.actor) || undefined,
    confirmed: parseBoolean(body.confirmed),
  };
}

function rejectMissingOrganization(res: Response): boolean {
  res.status(400).json({ error: 'organization_id is required' });
  return true;
}

function rejectMissing(res: Response, field: string): boolean {
  res.status(400).json({ error: `${field} is required` });
  return true;
}

function sendOutcome(
  res: Response,
  outcome: { ok: true; audit_code: string } | { ok: false; status: number; error: string; code?: string },
): void {
  if (!outcome.ok) {
    res.status(outcome.status).json({ error: outcome.error, code: outcome.code });
    return;
  }
  res.json({ ok: true, audit_code: outcome.audit_code });
}

function authHeaderExpected(options: InternalControlRouterOptions): string | null {
  return options.internalKey?.trim()
    || process.env.SCOUT_INTERNAL_CONTROL_KEY?.trim()
    || process.env.SCOUT_API_KEY?.trim()
    || null;
}

function requireInternalKey(req: Request, res: Response, options: InternalControlRouterOptions): boolean {
  const expected = authHeaderExpected(options);
  if (!expected) {
    res.status(503).json({ error: 'Internal control key not configured' });
    return false;
  }

  const provided = req.header('X-Scout-Internal-Key')?.trim() || '';
  if (provided !== expected) {
    res.status(401).json({ error: 'Invalid internal control key' });
    return false;
  }

  return true;
}

function createServiceRouter(service: ControlRouterService) {
  const router = Router();

  router.get('/status', async (req: Request, res: Response): Promise<void> => {
    const organizationId = parseString(req.query.organization_id);
    if (!organizationId) {
      rejectMissingOrganization(res);
      return;
    }
    res.json(await service.getStatus(organizationId));
  });

  router.post('/kill', async (req: Request, res: Response): Promise<void> => {
    const meta = parseMetadata(req);
    if (!meta.organizationId) {
      rejectMissingOrganization(res);
      return;
    }
    const reason = meta.reason ?? 'kill switch activated';
    sendOutcome(res, await service.killOrg(meta.organizationId, { ...meta, reason, command: meta.command ?? 'kill' }));
  });

  router.post('/freeze', async (req: Request, res: Response): Promise<void> => {
    const meta = parseMetadata(req);
    if (!meta.organizationId) {
      rejectMissingOrganization(res);
      return;
    }
    sendOutcome(res, await service.freezeOrg(meta.organizationId, meta));
  });

  router.post('/pause', async (req: Request, res: Response): Promise<void> => {
    const meta = parseMetadata(req);
    const body = (req.body ?? {}) as Record<string, unknown>;
    const agentId = parseString(body.agent_id || body.agentId);
    if (!meta.organizationId) {
      rejectMissingOrganization(res);
      return;
    }
    if (!agentId) {
      rejectMissing(res, 'agent_id');
      return;
    }
    sendOutcome(res, await service.pauseAgent(meta.organizationId, agentId, meta));
  });

  router.post('/suspend-channel', async (req: Request, res: Response): Promise<void> => {
    const meta = parseMetadata(req);
    const body = (req.body ?? {}) as Record<string, unknown>;
    const channel = parseString(body.channel);
    if (!meta.organizationId) {
      rejectMissingOrganization(res);
      return;
    }
    if (!channel) {
      rejectMissing(res, 'channel');
      return;
    }
    sendOutcome(res, await service.suspendChannel(meta.organizationId, channel, meta));
  });

  router.post('/quarantine-tool', async (req: Request, res: Response): Promise<void> => {
    const meta = parseMetadata(req);
    const body = (req.body ?? {}) as Record<string, unknown>;
    const toolName = parseString(body.tool_name || body.toolName);
    const agentId = parseString(body.agent_id || body.agentId) || 'all';
    if (!meta.organizationId) {
      rejectMissingOrganization(res);
      return;
    }
    if (!toolName) {
      rejectMissing(res, 'tool_name');
      return;
    }
    sendOutcome(res, await service.quarantineTool(meta.organizationId, agentId, toolName, meta));
  });

  router.post('/restrict', async (req: Request, res: Response): Promise<void> => {
    const meta = parseMetadata(req);
    if (!meta.organizationId) {
      rejectMissingOrganization(res);
      return;
    }
    sendOutcome(res, await service.restrictOrg(meta.organizationId, meta));
  });

  router.post('/resume', async (req: Request, res: Response): Promise<void> => {
    const meta = parseMetadata(req);
    const body = (req.body ?? {}) as Record<string, unknown>;
    const agentId = parseString(body.agent_id || body.agentId);
    if (!meta.organizationId) {
      rejectMissingOrganization(res);
      return;
    }
    if (agentId) {
      sendOutcome(res, await service.resumeAgent(meta.organizationId, agentId, meta));
      return;
    }
    sendOutcome(res, await service.resumeOrg(meta.organizationId, meta));
  });

  return router;
}

export function createInternalControlRouter(
  service: ControlRouterService,
  options: InternalControlRouterOptions = {},
) {
  const router = Router();

  router.use((req, res, next) => {
    if (!requireInternalKey(req, res, options)) return;
    next();
  });

  router.use(createServiceRouter(service));
  router.use('/channels', internalChannelLinksRouter);
  return router;
}
