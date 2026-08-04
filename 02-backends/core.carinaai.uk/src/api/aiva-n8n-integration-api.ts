import { Router, type NextFunction, type Request, type Response, type Router as ExpressRouter } from 'express';
import { requireCloudProxy } from '../gateway/cloud-proxy-auth.js';
import { isAiWorkersEnabled } from '../workers/aiva-message-handler.js';
import { buildSocialDigest } from '../integrations/n8n/social-digest.js';
import { createSocialPostDraft } from '../ingestion/social/social-post-draft-handler.js';
import { getWorker } from '../workers/worker-store.js';

export const aivaN8nIntegrationRouter: ExpressRouter = Router();
aivaN8nIntegrationRouter.use(requireCloudProxy);

type IntegrationRequest = Request & { workspaceId?: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function resolveWorkspaceId(req: IntegrationRequest): string | null {
  const header = req.headers['x-workspace-id'];
  const fromHeader = Array.isArray(header) ? header[0] : header;
  const fromQuery = typeof req.query.workspaceId === 'string' ? req.query.workspaceId : '';
  const fromBody = typeof req.body?.workspaceId === 'string' ? req.body.workspaceId : '';
  return (fromHeader ?? fromBody ?? fromQuery)?.trim() || null;
}

function requireWorkspace(req: IntegrationRequest, res: Response, next: NextFunction): void {
  if (!isAiWorkersEnabled()) {
    res.status(503).json({ error: 'Aiva integrations are disabled' });
    return;
  }
  const workspaceId = resolveWorkspaceId(req);
  if (!workspaceId || !UUID_RE.test(workspaceId)) {
    res.status(400).json({ error: 'Valid workspaceId is required' });
    return;
  }
  req.workspaceId = workspaceId;
  next();
}

aivaN8nIntegrationRouter.get('/social-digest', requireWorkspace, async (req: IntegrationRequest, res: Response) => {
  try {
    const workerId = typeof req.query.workerId === 'string' ? req.query.workerId : undefined;
    const digest = await buildSocialDigest(req.workspaceId!, workerId);
    res.json({ digest });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

aivaN8nIntegrationRouter.post('/post-draft', requireWorkspace, async (req: IntegrationRequest, res: Response) => {
  try {
    const workerId = String(req.body?.workerId ?? '').trim();
    const prompt = String(req.body?.prompt ?? req.body?.description ?? '').trim();
    const automationName = String(req.body?.automationName ?? 'n8n-post-draft').trim();
    if (!UUID_RE.test(workerId) || !prompt) {
      res.status(400).json({ error: 'workerId and prompt are required' });
      return;
    }
    const worker = await getWorker(req.workspaceId!, workerId);
    if (!worker) {
      res.status(404).json({ error: 'Worker not found' });
      return;
    }
    const result = await createSocialPostDraft({
      workerId,
      workspaceId: req.workspaceId!,
      automationName,
      prompt,
    });
    res.status(201).json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});
