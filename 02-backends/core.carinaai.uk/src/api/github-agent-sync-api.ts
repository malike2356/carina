import { Router, type Request, type Response, type Router as ExpressRouter } from 'express';
import {
  getStatus,
  pullNow,
  pushApprovedDurableUpdates,
  rebuildIndex,
  searchSharedKnowledge,
  updateSettings,
  writeDurableNote,
  type GithubBridgeProduct,
} from '../sync/github-bridge/index.js';
import { resolveGithubBridgeScope } from '../sync/github-bridge/config.js';
import type { GithubBridgeScopeKind } from '../sync/github-bridge/types.js';
import { startGithubBridgeSchedule } from '../sync/github-bridge/scheduler.js';
import { requireCloudProxy, isCloudProxyAuthorized } from '../gateway/cloud-proxy-auth.js';
import { isInternalResearchAuthorized } from './internal-research-api.js';

export const githubAgentSyncRouter: ExpressRouter = Router();

githubAgentSyncRouter.use(requireCloudProxy);

function guard(req: Request, res: Response): boolean {
  if (isCloudProxyAuthorized(req) || isInternalResearchAuthorized(req)) return true;
  const workspaceId = req.headers['x-workspace-id'];
  const userId = req.headers['x-user-id'];
  if (typeof workspaceId === 'string' && workspaceId.trim() && process.env.NODE_ENV !== 'production') {
    return true;
  }
  if (typeof userId === 'string' && userId.trim() && process.env.NODE_ENV !== 'production') {
    return true;
  }
  res.status(401).json({ error: 'Unauthorized' });
  return false;
}

function resolveScope(req: Request, body?: Record<string, unknown>) {
  const scopeKindRaw =
    typeof body?.scopeKind === 'string'
      ? body.scopeKind
      : typeof req.query.scopeKind === 'string'
        ? req.query.scopeKind
        : undefined;
  const scopeKind =
    scopeKindRaw === 'user' || scopeKindRaw === 'shared' ? (scopeKindRaw as GithubBridgeScopeKind) : 'workspace';
  const workspaceId = typeof req.headers['x-workspace-id'] === 'string' ? req.headers['x-workspace-id'] : undefined;
  const userId = typeof req.headers['x-user-id'] === 'string' ? req.headers['x-user-id'] : undefined;
  const sharedScopeId =
    typeof body?.scopeId === 'string'
      ? body.scopeId
      : typeof req.query.scopeId === 'string'
        ? req.query.scopeId
        : undefined;
  return resolveGithubBridgeScope({
    scopeKind,
    scopeId: scopeKind === 'user' ? null : scopeKind === 'workspace' ? null : sharedScopeId ?? null,
    workspaceId,
    userId,
  });
}

githubAgentSyncRouter.get('/status', async (req: Request, res: Response) => {
  if (!guard(req, res)) return;
  try {
    res.json(await getStatus(resolveScope(req)));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

githubAgentSyncRouter.put('/settings', async (req: Request, res: Response) => {
  if (!guard(req, res)) return;
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const product = body.product;
    const scope = resolveScope(req, body);
    const status = await updateSettings({
      scopeKind: scope.scopeKind,
      scopeId: scope.scopeId,
      enabled: typeof body.enabled === 'boolean' ? body.enabled : undefined,
      owner: typeof body.owner === 'string' ? body.owner : undefined,
      repo: typeof body.repo === 'string' ? body.repo : undefined,
      branch: typeof body.branch === 'string' ? body.branch : undefined,
      pullIntervalMinutes:
        typeof body.pullIntervalMinutes === 'number' ? body.pullIntervalMinutes : undefined,
      pushIntervalMinutes:
        typeof body.pushIntervalMinutes === 'number' ? body.pushIntervalMinutes : undefined,
      allowedFolders: Array.isArray(body.allowedFolders)
        ? body.allowedFolders.map(String)
        : undefined,
      humanEditsWin: typeof body.humanEditsWin === 'boolean' ? body.humanEditsWin : undefined,
      product:
        product === 'carina' || product === 'aiva' || product === 'shared'
          ? (product as GithubBridgeProduct)
          : undefined,
      localPath: typeof body.localPath === 'string' ? body.localPath : undefined,
      token: typeof body.token === 'string' ? body.token : body.token === null ? null : undefined,
    }, scope);
    void startGithubBridgeSchedule();
    res.json(status);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

githubAgentSyncRouter.post('/pull', async (req: Request, res: Response) => {
  if (!guard(req, res)) return;
  res.json(await pullNow(resolveScope(req)));
});

githubAgentSyncRouter.post('/push', async (req: Request, res: Response) => {
  if (!guard(req, res)) return;
  const body = (req.body ?? {}) as Record<string, unknown>;
  res.json(
    await pushApprovedDurableUpdates(
      {
        message: typeof body.message === 'string' ? body.message : undefined,
        paths: Array.isArray(body.paths) ? body.paths.map(String) : undefined,
      },
      resolveScope(req, body),
    ),
  );
});

githubAgentSyncRouter.post('/index', async (req: Request, res: Response) => {
  if (!guard(req, res)) return;
  try {
    const indexed = await rebuildIndex(undefined, resolveScope(req, req.body as Record<string, unknown> | undefined));
    res.json({ ok: true, indexed });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

githubAgentSyncRouter.get('/search', async (req: Request, res: Response) => {
  if (!guard(req, res)) return;
  const q = typeof req.query.q === 'string' ? req.query.q : '';
  if (!q.trim()) {
    res.status(400).json({ error: 'q is required' });
    return;
  }
  const limit = typeof req.query.limit === 'string' ? Number(req.query.limit) : 8;
  const hits = await searchSharedKnowledge(
    q,
    Number.isFinite(limit) ? limit : 8,
    {
      product: typeof req.query.product === 'string' ? req.query.product : undefined,
      agent: typeof req.query.agent === 'string' ? req.query.agent : undefined,
      pathPrefix: typeof req.query.pathPrefix === 'string' ? req.query.pathPrefix : undefined,
    },
    resolveScope(req),
  );
  res.json({ hits });
});

githubAgentSyncRouter.post('/note', async (req: Request, res: Response) => {
  if (!guard(req, res)) return;
  const body = (req.body ?? {}) as Record<string, unknown>;
  const relativePath = typeof body.path === 'string' ? body.path : '';
  const content = typeof body.content === 'string' ? body.content : '';
  if (!relativePath || !content) {
    res.status(400).json({ error: 'path and content are required' });
    return;
  }
  res.json(
    await writeDurableNote(
      {
        relativePath,
        content,
        push: body.push !== false,
      },
      resolveScope(req, body),
    ),
  );
});
