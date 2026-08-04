import { Router, type NextFunction, type Request, type Response, type Router as ExpressRouter } from 'express';
import { requireCloudProxy } from '../gateway/cloud-proxy-auth.js';
import { isAiWorkersEnabled } from '../workers/workspace-message-handler.js';
import { getWorker } from '../workers/worker-store.js';
import { credentialsConfigured } from '../channels/credential-store.js';
import {
  deleteGoogleRecorderConnection,
  getGoogleRecorderConnection,
  setGoogleRecorderEnabled,
  upsertGoogleRecorderConnection,
} from '../ingestion/google-recorder/recorder-connection-store.js';
import {
  isGoogleRecorderEnabledForWorkspace,
  isGoogleRecorderActive,
} from '../ingestion/google-recorder/recorder-config.js';
import { pollGoogleRecorderWorker } from '../ingestion/google-recorder/recorder-poller.js';

export const aivaGoogleRecorderRouter: ExpressRouter = Router();
aivaGoogleRecorderRouter.use(requireCloudProxy);

type RecorderRequest = Request & { workspaceId?: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function routeParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

function resolveWorkspaceId(req: RecorderRequest): string | null {
  const header = req.headers['x-workspace-id'];
  const fromHeader = Array.isArray(header) ? header[0] : header;
  const fromQuery = typeof req.query.workspaceId === 'string' ? req.query.workspaceId : '';
  const fromBody = typeof req.body?.workspaceId === 'string' ? req.body.workspaceId : '';
  return (fromHeader ?? fromBody ?? fromQuery)?.trim() || null;
}

function requireRecorderFeature(req: RecorderRequest, res: Response, next: NextFunction): void {
  if (!isAiWorkersEnabled()) {
    res.status(503).json({ error: 'AI workers are disabled' });
    return;
  }
  if (!isGoogleRecorderActive()) {
    res.status(503).json({ error: 'Google Recorder ingestion is disabled' });
    return;
  }
  const workspaceId = resolveWorkspaceId(req);
  if (!workspaceId || !UUID_RE.test(workspaceId)) {
    res.status(400).json({ error: 'Valid workspaceId is required' });
    return;
  }
  if (!isGoogleRecorderEnabledForWorkspace(workspaceId)) {
    res.status(503).json({ error: 'Google Recorder ingestion is disabled for this workspace' });
    return;
  }
  req.workspaceId = workspaceId;
  next();
}

aivaGoogleRecorderRouter.use(requireRecorderFeature);

aivaGoogleRecorderRouter.get('/status', async (req: RecorderRequest, res: Response) => {
  const workerId = typeof req.query.workerId === 'string' ? req.query.workerId : '';
  if (!workerId || !UUID_RE.test(workerId)) {
    res.status(400).json({ error: 'Valid workerId is required' });
    return;
  }
  const worker = await getWorker(req.workspaceId!, workerId);
  if (!worker || worker.workspaceId !== req.workspaceId) {
    res.status(404).json({ error: 'Worker not found in workspace' });
    return;
  }
  const connection = await getGoogleRecorderConnection(workerId);
  res.json({
    configured: Boolean(connection),
    credentialsReady: credentialsConfigured(),
    connection: connection
      ? {
          workerId: connection.workerId,
          workspaceId: connection.workspaceId,
          status: connection.status,
          enabled: connection.enabled,
          lastPollAt: connection.lastPollAt,
          lastError: connection.lastError,
          seenCount: connection.seenRecordingIds.length,
        }
      : null,
  });
});

aivaGoogleRecorderRouter.post('/connect', async (req: RecorderRequest, res: Response) => {
  if (!credentialsConfigured()) {
    res.status(503).json({ error: 'CHANNEL_CREDENTIAL_KEY is not configured' });
    return;
  }
  const workerId = typeof req.body?.workerId === 'string' ? req.body.workerId : '';
  const storageState = req.body?.storageState;
  if (!workerId || !UUID_RE.test(workerId)) {
    res.status(400).json({ error: 'Valid workerId is required' });
    return;
  }
  if (!storageState || (typeof storageState !== 'object' && typeof storageState !== 'string')) {
    res.status(400).json({
      error: 'storageState is required (Playwright storageState JSON object or string)',
    });
    return;
  }

  const worker = await getWorker(req.workspaceId!, workerId);
  if (!worker || worker.workspaceId !== req.workspaceId) {
    res.status(404).json({ error: 'Worker not found in workspace' });
    return;
  }

  let storageStateJson: string;
  try {
    storageStateJson =
      typeof storageState === 'string' ? storageState : JSON.stringify(storageState);
    JSON.parse(storageStateJson);
  } catch {
    res.status(400).json({ error: 'storageState must be valid JSON' });
    return;
  }

  const connection = await upsertGoogleRecorderConnection({
    workerId,
    workspaceId: req.workspaceId!,
    storageStateJson,
    status: 'connected',
    enabled: true,
  });

  res.json({
    ok: true,
    workerId: connection.workerId,
    status: connection.status,
    enabled: connection.enabled,
  });
});

aivaGoogleRecorderRouter.post('/poll', async (req: RecorderRequest, res: Response) => {
  const workerId = typeof req.body?.workerId === 'string' ? req.body.workerId : '';
  if (!workerId || !UUID_RE.test(workerId)) {
    res.status(400).json({ error: 'Valid workerId is required' });
    return;
  }
  const worker = await getWorker(req.workspaceId!, workerId);
  if (!worker || worker.workspaceId !== req.workspaceId) {
    res.status(404).json({ error: 'Worker not found in workspace' });
    return;
  }
  const processed = await pollGoogleRecorderWorker(workerId);
  const connection = await getGoogleRecorderConnection(workerId);
  res.json({
    ok: true,
    processed,
    status: connection?.status ?? null,
    lastError: connection?.lastError ?? null,
  });
});

aivaGoogleRecorderRouter.post('/enable', async (req: RecorderRequest, res: Response) => {
  const workerId = typeof req.body?.workerId === 'string' ? req.body.workerId : '';
  const enabled = Boolean(req.body?.enabled);
  if (!workerId || !UUID_RE.test(workerId)) {
    res.status(400).json({ error: 'Valid workerId is required' });
    return;
  }
  await setGoogleRecorderEnabled(workerId, enabled);
  res.json({ ok: true, workerId, enabled });
});

aivaGoogleRecorderRouter.delete('/connect/:workerId', async (req: RecorderRequest, res: Response) => {
  const workerId = routeParam(req.params.workerId);
  if (!workerId || !UUID_RE.test(workerId)) {
    res.status(400).json({ error: 'Valid workerId is required' });
    return;
  }
  const worker = await getWorker(req.workspaceId!, workerId);
  if (!worker || worker.workspaceId !== req.workspaceId) {
    res.status(404).json({ error: 'Worker not found in workspace' });
    return;
  }
  const deleted = await deleteGoogleRecorderConnection(workerId);
  res.json({ ok: deleted });
});
