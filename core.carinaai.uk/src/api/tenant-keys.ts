import express, { type NextFunction, type Request, type Response, type Router } from 'express';
import { getUserByApiKey, verifyJwt } from './hosted-auth.js';
import {
  listTenantProviders,
  removeTenantProviderKey,
  setTenantProviderKey,
} from '../brain/tenant-provider-keys.js';

type TenantRequest = Request & { tenantId?: string; hostedUser?: { id: string } };

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

  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) {
    res.status(401).json({ error: 'No tenant context' });
    return;
  }

  const jwtUser = verifyJwt(token);
  if (jwtUser) {
    req.tenantId = jwtUser.userId;
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

  router.get('/api/tenant/providers', async (req: TenantRequest, res: Response) => {
    const tenantId = req.tenantId;
    if (!tenantId) {
      res.status(401).json({ error: 'No tenant context' });
      return;
    }
    try {
      const providers = await listTenantProviders(tenantId);
      res.json({ providers });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  router.post('/api/tenant/providers', express.json(), async (req: TenantRequest, res: Response) => {
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

  router.delete('/api/tenant/providers/:provider', async (req: TenantRequest, res: Response) => {
    const tenantId = req.tenantId;
    if (!tenantId) {
      res.status(401).json({ error: 'No tenant context' });
      return;
    }
    try {
      await removeTenantProviderKey(tenantId, String(req.params.provider));
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  return router;
}
