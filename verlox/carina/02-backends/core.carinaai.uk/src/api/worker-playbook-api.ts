import { Router, type NextFunction, type Request, type Response, type Router as ExpressRouter } from 'express';
import { getWorker } from '../workers/worker-store.js';
import { listAivaPlaybookTemplates } from '../workers/aiva-playbook-templates.js';
import { readWorkerPlaybook } from '../workers/provision-worker-playbook.js';
import {
  buildKeprixRunUrl,
  listPlaybookRuns,
  startWorkerPlaybookRun,
} from '../workers/playbook-run-client.js';
import { updateWorkerConfig } from '../workers/worker-bridge-store.js';
import {
  loadAndRegisterAllWorkerPlaybookSchedules,
  registerWorkerPlaybookSchedule,
  unregisterWorkerPlaybookSchedule,
} from '../workers/worker-playbook-scheduler.js';
import { KeprixApiError } from '../integrations/keprix-api.js';

export const workerPlaybookRouter: ExpressRouter = Router({ mergeParams: true });

type WorkerPlaybookRequest = Request & { workspaceId?: string };

function resolvePlaybookWorkspaceId(req: WorkerPlaybookRequest): string | null {
  if (req.workspaceId?.trim()) return req.workspaceId.trim();
  const header = req.headers['x-workspace-id'];
  const fromHeader = Array.isArray(header) ? header[0] : header;
  return fromHeader?.trim() || null;
}

function attachWorkspace(req: WorkerPlaybookRequest, res: Response, next: NextFunction): void {
  const workspaceId = resolvePlaybookWorkspaceId(req);
  if (!workspaceId) {
    res.status(400).json({ error: 'workspaceId is required (X-Workspace-Id header or body)' });
    return;
  }
  req.workspaceId = workspaceId;
  next();
}

workerPlaybookRouter.use(attachWorkspace);

workerPlaybookRouter.get('/templates', (_req, res) => {
  res.json({ templates: listAivaPlaybookTemplates() });
});

workerPlaybookRouter.post('/playbook-runs', async (req: WorkerPlaybookRequest, res: Response) => {
  const workspaceId = req.workspaceId!;
  const workerId = String(req.params.id ?? '').trim();
  const worker = await getWorker(workspaceId, workerId);
  if (!worker) {
    res.status(404).json({ error: 'Worker not found' });
    return;
  }
  const playbook = readWorkerPlaybook(worker.workerConfig);
  if (!playbook?.playbookId) {
    res.status(400).json({ error: 'Worker has no assigned playbook' });
    return;
  }
  try {
    const run = await startWorkerPlaybookRun({
      workerId,
      workspaceId,
      playbook,
      trigger: 'manual',
      initialState: req.body?.initial_state && typeof req.body.initial_state === 'object'
        ? req.body.initial_state
        : undefined,
    });
    await updateWorkerConfig(workspaceId, workerId, {
      playbook: {
        ...playbook,
        lastRunId: run.runId,
        lastRunAt: new Date().toISOString(),
      },
    });
    res.status(201).json({
      run_id: run.runId,
      status: run.status,
      keprix_run_url: buildKeprixRunUrl(run.runId),
    });
  } catch (err) {
    const status = err instanceof KeprixApiError ? err.status : 500;
    res.status(status).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

workerPlaybookRouter.get('/playbook-runs', async (req: WorkerPlaybookRequest, res: Response) => {
  const workspaceId = req.workspaceId!;
  const workerId = String(req.params.id ?? '').trim();
  const worker = await getWorker(workspaceId, workerId);
  if (!worker) {
    res.status(404).json({ error: 'Worker not found' });
    return;
  }
  const playbook = readWorkerPlaybook(worker.workerConfig);
  try {
    const runs = await listPlaybookRuns(workspaceId, Number(req.query.limit ?? 20));
    const filtered = playbook?.playbookId
      ? runs.filter((run) => run.graphId === (playbook.keprixGraphId ?? playbook.playbookId))
      : runs;
    res.json({
      runs: filtered.slice(0, 5).map((run) => ({
        ...run,
        keprix_run_url: buildKeprixRunUrl(run.runId),
      })),
    });
  } catch (err) {
    const status = err instanceof KeprixApiError ? err.status : 500;
    res.status(status).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

workerPlaybookRouter.get('/playbook-schedule', async (req: WorkerPlaybookRequest, res: Response) => {
  const workspaceId = req.workspaceId!;
  const workerId = String(req.params.id ?? '').trim();
  const worker = await getWorker(workspaceId, workerId);
  if (!worker) {
    res.status(404).json({ error: 'Worker not found' });
    return;
  }
  const playbook = readWorkerPlaybook(worker.workerConfig);
  res.json({
    schedule: {
      cron: playbook?.scheduleCron ?? null,
      enabled: Boolean(playbook?.scheduleEnabled),
      last_run_id: playbook?.lastRunId ?? null,
      last_run_at: playbook?.lastRunAt ?? null,
    },
    playbook: playbook
      ? {
          id: playbook.playbookId,
          variables: playbook.playbookVariables ?? {},
        }
      : null,
  });
});

workerPlaybookRouter.patch('/playbook-schedule', async (req: WorkerPlaybookRequest, res: Response) => {
  const workspaceId = req.workspaceId!;
  const workerId = String(req.params.id ?? '').trim();
  const worker = await getWorker(workspaceId, workerId);
  if (!worker) {
    res.status(404).json({ error: 'Worker not found' });
    return;
  }
  const playbook = readWorkerPlaybook(worker.workerConfig);
  if (!playbook?.playbookId) {
    res.status(400).json({ error: 'Worker has no assigned playbook' });
    return;
  }
  const cron = req.body?.cron != null ? String(req.body.cron).trim() : playbook.scheduleCron;
  const enabled = req.body?.enabled != null ? Boolean(req.body.enabled) : playbook.scheduleEnabled;
  const nextPlaybook = {
    ...playbook,
    scheduleCron: cron || undefined,
    scheduleEnabled: enabled && Boolean(cron),
  };
  await updateWorkerConfig(workspaceId, workerId, { playbook: nextPlaybook });
  unregisterWorkerPlaybookSchedule(workerId);
  if (nextPlaybook.scheduleEnabled && nextPlaybook.scheduleCron) {
    registerWorkerPlaybookSchedule(workerId, nextPlaybook.scheduleCron);
  }
  res.json({
    schedule: {
      cron: nextPlaybook.scheduleCron ?? null,
      enabled: Boolean(nextPlaybook.scheduleEnabled),
    },
  });
});

export async function registerWorkerPlaybookSchedulesOnStartup(): Promise<number> {
  return loadAndRegisterAllWorkerPlaybookSchedules();
}
