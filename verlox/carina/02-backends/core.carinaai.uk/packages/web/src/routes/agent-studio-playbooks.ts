import { Router, type NextFunction, type Request, type Response, type Router as ExpressRouter } from 'express';
import rateLimit from 'express-rate-limit';
import { isControlAuthorized } from '#core/infrastructure/control-auth.js';
import { StudioHandoffError } from '../agent-studio-playbook-bridge.js';
import {
  getPlaybookRunUrl,
  getPlaybookStudioUrl,
  KeprixProxyError,
  listPlaybooks,
} from '../keprix-proxy-client.js';
import { isKeprixHandoffConfigured, isKeprixStudioConfigured, readKeprixConfig } from '../keprix-config.js';

export const agentStudioPlaybooksRouter: ExpressRouter = Router();

type PlaybooksRequest = Request & {
  playbooksActor?: {
    subject: string;
    tenantId: string;
    carinaUserId: string;
  };
};

function playbooksAuth(req: PlaybooksRequest, res: Response, next: NextFunction): void {
  if (isControlAuthorized(req)) {
    req.playbooksActor = {
      subject: 'operator',
      tenantId: '__operator__',
      carinaUserId: 'operator',
    };
    next();
    return;
  }

  if (req.hostedUser?.id) {
    const tenantId = req.session?.hostedOrgId?.trim() || req.hostedUser.id;
    req.playbooksActor = {
      subject: req.hostedUser.email || req.hostedUser.id,
      tenantId,
      carinaUserId: req.hostedUser.id,
    };
    next();
    return;
  }

  if (req.session?.webAuthed) {
    req.playbooksActor = {
      subject: 'operator',
      tenantId: '__operator__',
      carinaUserId: 'operator',
    };
    next();
    return;
  }

  res.status(401).json({ error: 'Unauthorized' });
}

function actorKey(req: PlaybooksRequest): string {
  return req.playbooksActor?.carinaUserId ?? req.ip ?? 'unknown';
}

const handoffLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => actorKey(req as PlaybooksRequest),
  message: { error: 'Handoff rate limit exceeded. Try again in a minute.' },
});

agentStudioPlaybooksRouter.use(playbooksAuth);

agentStudioPlaybooksRouter.get('/', async (_req: PlaybooksRequest, res: Response) => {
  const config = readKeprixConfig();
  const configured = isKeprixStudioConfigured(config);
  if (!configured) {
    res.json({
      configured: false,
      playbooks: [],
      message: 'Set KEPRIX_STUDIO_BASE_URL and KEPRIX_API_BASE_URL to connect Keprix Visual Playbook Studio.',
    });
    return;
  }

  try {
    const playbooks = await listPlaybooks();
    res.json({
      configured: true,
      handoffReady: isKeprixHandoffConfigured(config),
      playbooks,
    });
  } catch (err) {
    const status = err instanceof KeprixProxyError ? err.status : 502;
    const message = err instanceof Error ? err.message : String(err);
    res.status(status).json({
      configured: true,
      handoffReady: isKeprixHandoffConfigured(config),
      playbooks: [],
      error: message,
    });
  }
});

agentStudioPlaybooksRouter.post('/handoff', handoffLimiter, async (req: PlaybooksRequest, res: Response) => {
  const actor = req.playbooksActor;
  if (!actor) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const path = String(req.body?.path ?? '').trim();
  const playbookId = req.body?.playbook_id != null ? String(req.body.playbook_id).trim() : '';
  const runId = req.body?.run_id != null ? String(req.body.run_id).trim() : '';

  try {
    let url: string;
    if (runId) {
      url = await getPlaybookRunUrl(runId, actor);
    } else if (playbookId) {
      url = await getPlaybookStudioUrl(playbookId === 'new' ? 'new' : playbookId, actor);
    } else if (path) {
      const { getStudioHandoffUrl } = await import('../agent-studio-playbook-bridge.js');
      url = await getStudioHandoffUrl(path, actor);
    } else {
      url = await getPlaybookStudioUrl('new', actor);
    }
    res.json({ url });
  } catch (err) {
    if (err instanceof StudioHandoffError || err instanceof KeprixProxyError) {
      res.status(err instanceof KeprixProxyError ? err.status : 503).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
