import express, { type NextFunction, type Request, type Response, type Router } from 'express';
import { getUserByApiKey, verifyJwt } from './hosted-auth.js';
import {
  listTenantProviders,
  removeTenantProviderKey,
  setTenantProviderKey,
} from '../brain/tenant-provider-keys.js';
import { isOperatorHost } from '../gateway/hosted-domain.js';
import { isControlAuthorized } from '../infrastructure/control-auth.js';
import { resolveOrgIdFromUser } from '../hosted/scoped-query.js';

type TenantRequest = Request & {
  tenantId?: string;
  orgId?: string;
  hostedUser?: { id: string };
};

const OPERATOR_TENANT_ID = '__operator__';

async function resolveRequestOrgId(req: TenantRequest): Promise<string | null> {
  if (req.orgId) return req.orgId;
  if (req.session?.hostedOrgId) return req.session.hostedOrgId;
  if (req.tenantId && req.tenantId !== OPERATOR_TENANT_ID) {
    return resolveOrgIdFromUser(req.tenantId);
  }
  return null;
}

async function tenantAuthMiddleware(
  req: TenantRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (req.hostedUser?.id) {
    req.tenantId = req.hostedUser.id;
    next();
    return;
  }
  if (req.session?.hostedAccountId) {
    req.tenantId = req.session.hostedAccountId;
    next();
    return;
  }
  if (req.session?.webAuthed && isOperatorHost(req.hostname)) {
    req.tenantId = OPERATOR_TENANT_ID;
    next();
    return;
  }
  if (isControlAuthorized(req)) {
    req.tenantId = OPERATOR_TENANT_ID;
    next();
    return;
  }

  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) {
    res.status(401).json({ error: 'No tenant context' });
    return;
  }

  const jwtUser = verifyJwt(token);
  if (jwtUser) {
    req.tenantId = jwtUser.userId;
    if (jwtUser.orgId) req.orgId = jwtUser.orgId;
    next();
    return;
  }

  const apiUser = await getUserByApiKey(token);
  if (apiUser) {
    req.tenantId = apiUser.id;
    next();
    return;
  }

  res.status(401).json({ error: 'No tenant context' });
}

export function tenantKeysRouter(): Router {
  const router = express.Router();
  router.use(tenantAuthMiddleware);

  router.get('/providers', async (req: TenantRequest, res: Response) => {
    const tenantId = req.tenantId;
    if (!tenantId || tenantId === OPERATOR_TENANT_ID) {
      res.status(401).json({ error: 'No tenant context' });
      return;
    }
    const orgId = await resolveRequestOrgId(req);
    if (!orgId) {
      res.status(400).json({ error: 'Organization missing. Run: carina hosted backfill-orgs' });
      return;
    }
    try {
      const providers = await listTenantProviders(orgId, tenantId);
      res.json({ providers });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  router.post('/providers', express.json(), async (req: TenantRequest, res: Response) => {
    const tenantId = req.tenantId;
    if (!tenantId) {
      res.status(401).json({ error: 'No tenant context' });
      return;
    }
    const { provider, apiKey, baseUrl, model } = req.body as {
      provider?: string;
      apiKey?: string;
      baseUrl?: string;
      model?: string;
    };
    if (!provider || !apiKey) {
      res.status(400).json({ error: 'provider and apiKey required' });
      return;
    }
    try {
      await setTenantProviderKey(tenantId, provider, apiKey, baseUrl, model);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  router.delete('/providers/:provider', async (req: TenantRequest, res: Response) => {
    const tenantId = req.tenantId;
    if (!tenantId) {
      res.status(401).json({ error: 'No tenant context' });
      return;
    }
    try {
      await removeTenantProviderKey(tenantId, String(req.params.provider), req.orgId);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  return router;
}
