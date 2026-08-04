import { Router, type NextFunction, type Request, type Response, type Router as ExpressRouter } from 'express';
import rateLimit from 'express-rate-limit';
import { isControlAuthorized } from '#core/infrastructure/control-auth.js';
import { StudioHandoffError } from '../agent-studio-playbook-bridge.js';
import {
  fetchConnectorCatalog,
  fetchConnectorDetail,
  getInstallHandoffUrl,
  getStudioDeepLink,
  integrationsConfigured,
} from '../integrations-hub.js';
import { KeprixProxyError } from '../keprix-proxy-client.js';

export const integrationsHubRouter: ExpressRouter = Router();

type IntegrationsRequest = Request & {
  integrationsActor?: {
    subject: string;
    tenantId: string;
    carinaUserId: string;
  };
};

function integrationsAuth(req: IntegrationsRequest, res: Response, next: NextFunction): void {
  if (isControlAuthorized(req)) {
    req.integrationsActor = {
      subject: 'operator',
      tenantId: '__operator__',
      carinaUserId: 'operator',
    };
    next();
    return;
  }
  if (req.hostedUser?.id) {
    const tenantId = req.session?.hostedOrgId?.trim() || req.hostedUser.id;
    req.integrationsActor = {
      subject: req.hostedUser.email || req.hostedUser.id,
      tenantId,
      carinaUserId: req.hostedUser.id,
    };
    next();
    return;
  }
  if (req.session?.webAuthed) {
    req.integrationsActor = {
      subject: 'operator',
      tenantId: '__operator__',
      carinaUserId: 'operator',
    };
    next();
    return;
  }
  res.status(401).json({ error: 'Unauthorized' });
}

const handoffLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  // Prefer authenticated actor id. Do not use req.ip here: express-rate-limit v8
  // throws ERR_ERL_KEY_GEN_IPV6 when custom keyGenerators reference IP without
  // ipKeyGenerator, and that crash loops carina-core under supervisor.
  keyGenerator: (req) =>
    (req as IntegrationsRequest).integrationsActor?.carinaUserId ?? 'anonymous',
  message: { error: 'Handoff rate limit exceeded. Try again in a minute.' },
});

integrationsHubRouter.use(integrationsAuth);

integrationsHubRouter.get('/catalog', async (req: IntegrationsRequest, res: Response) => {
  const actor = req.integrationsActor;
  if (!actor) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  if (!integrationsConfigured()) {
    res.json({
      configured: false,
      connectors: [],
      categories: [],
      message: 'Set KEPRIX_API_BASE_URL or INTEGRATIONS_CATALOG_STUB=1 to load the integrations catalog.',
    });
    return;
  }
  try {
    const featured = req.query.featured === '1' || req.query.featured === 'true';
    const result = await fetchConnectorCatalog(actor.tenantId, {
      category: typeof req.query.category === 'string' ? req.query.category : undefined,
      featured,
      q: typeof req.query.q === 'string' ? req.query.q : undefined,
    });
    res.json({
      configured: true,
      stub: result.stub,
      count: result.connectors.length,
      connectors: result.connectors,
      categories: result.categories,
    });
  } catch (err) {
    const status = err instanceof KeprixProxyError ? err.status : 502;
    res.status(status).json({
      configured: true,
      connectors: [],
      categories: [],
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

integrationsHubRouter.get('/catalog/:id', async (req: IntegrationsRequest, res: Response) => {
  const actor = req.integrationsActor;
  if (!actor) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  try {
    const detail = await fetchConnectorDetail(actor.tenantId, String(req.params.id));
    res.json(detail);
  } catch (err) {
    const status = err instanceof KeprixProxyError ? err.status : 502;
    res.status(status).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

integrationsHubRouter.post('/handoff', handoffLimiter, async (req: IntegrationsRequest, res: Response) => {
  const actor = req.integrationsActor;
  if (!actor) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const connectorId = String(req.body?.connector_id ?? '').trim();
  const action = String(req.body?.action ?? 'install').trim();
  if (!connectorId) {
    res.status(400).json({ error: 'connector_id is required' });
    return;
  }
  try {
    const url =
      action === 'studio'
        ? await getStudioDeepLink(connectorId, actor)
        : await getInstallHandoffUrl(connectorId, actor);
    res.json({ url });
  } catch (err) {
    if (err instanceof StudioHandoffError || err instanceof KeprixProxyError) {
      res.status(err instanceof KeprixProxyError ? err.status : 503).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
