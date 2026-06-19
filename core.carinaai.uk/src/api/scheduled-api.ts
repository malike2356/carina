import { Router, type NextFunction, type Request, type Response, type Router as ExpressRouter } from 'express';
import { initDb } from '../memory/db.js';
import { listJobs, updateJob, type ScheduledJob } from '../agents/cron-scheduler.js';
import { isControlAuthorized } from '../infrastructure/control-auth.js';
import {
  cancelTaskFlowRun,
  executeTaskFlowRun,
  listTaskFlowRuns,
  listTaskFlows,
  pauseTaskFlow,
  resumeTaskFlow,
  summarizeTaskFlowRuns,
  taskFlowsEnabled,
  taskFlowWorkerEnabled,
  triggerTaskFlow,
} from '../ops/taskflows/index.js';
import type { TaskFlow, TaskFlowRun } from '../ops/taskflows/types.js';

export const scheduledApiRouter: ExpressRouter = Router();

function scheduledAuth(req: Request, res: Response, next: NextFunction): void {
  if (isControlAuthorized(req)) {
    next();
    return;
  }
  if (req.session?.webAuthed) {
    next();
    return;
  }
  if (req.session?.hostedAccountId) {
    next();
    return;
  }
  res.status(401).json({ error: 'Unauthorized' });
}

scheduledApiRouter.use(scheduledAuth);

function serializeCronJob(job: ScheduledJob) {
  return {
    id: job.id,
    name: job.name,
    schedule: job.schedule,
    prompt: job.prompt,
    status: job.status,
    lastRun: job.lastRun?.toISOString() ?? null,
    nextRun: job.nextRun?.toISOString() ?? null,
    deliver: job.deliver,
    profileName: job.profileName,
    createdAt: job.createdAt.toISOString(),
  };
}

function serializeFlow(flow: TaskFlow) {
  const triggers = (flow.triggers ?? []).map((t) => {
    if (t.type === 'cron') return `cron:${t.jobId}`;
    if (t.type === 'webhook') return `webhook:${t.event}`;
    if (t.type === 'kanban') return 'kanban';
    return t.type;
  });
  return {
    id: flow.id,
    name: flow.name,
    label: flow.label,
    status: flow.status,
    profileName: flow.profileName ?? 'default',
    stepCount: flow.steps.length,
    triggers,
  };
}

function serializeRun(run: TaskFlowRun) {
  return {
    id: run.id,
    flowId: run.flowId,
    flowName: run.flowName,
    status: run.status,
    stepIndex: run.stepIndex,
    profileName: run.profileName ?? null,
    startedAt: run.startedAt ?? null,
    finishedAt: run.finishedAt ?? null,
    error: run.error ? run.error.slice(0, 240) : null,
    outputPreview: run.output ? run.output.slice(0, 240) : null,
  };
}

scheduledApiRouter.get('/status', async (_req: Request, res: Response) => {
  await initDb();
  const counts = summarizeTaskFlowRuns();
  res.json({
    taskflowsEnabled: taskFlowsEnabled(),
    workerEnabled: taskFlowWorkerEnabled(),
    flows: listTaskFlows().length,
    cronJobs: (await listJobs()).filter((j) => j.status === 'active').length,
    runs: counts,
  });
});

scheduledApiRouter.get('/cron', async (_req: Request, res: Response) => {
  await initDb();
  const jobs = await listJobs();
  res.json({ jobs: jobs.map(serializeCronJob) });
});

scheduledApiRouter.post('/cron/:id/pause', async (req: Request, res: Response) => {
  await initDb();
  const job = await updateJob(String(req.params.id), { status: 'paused' });
  if (!job) {
    res.status(404).json({ error: 'Cron job not found' });
    return;
  }
  res.json({ job: serializeCronJob(job) });
});

scheduledApiRouter.post('/cron/:id/resume', async (req: Request, res: Response) => {
  await initDb();
  const job = await updateJob(String(req.params.id), { status: 'active' });
  if (!job) {
    res.status(404).json({ error: 'Cron job not found' });
    return;
  }
  res.json({ job: serializeCronJob(job) });
});

scheduledApiRouter.get('/flows', (_req: Request, res: Response) => {
  res.json({ flows: listTaskFlows().map(serializeFlow) });
});

scheduledApiRouter.get('/runs', (req: Request, res: Response) => {
  const limit = Number(req.query.limit ?? 30);
  const status = req.query.status ? String(req.query.status) : undefined;
  let runs = listTaskFlowRuns(Number.isFinite(limit) ? limit : 30);
  if (status) runs = runs.filter((r) => r.status === status);
  res.json({ runs: runs.map(serializeRun) });
});

scheduledApiRouter.post('/flows/:id/trigger', (req: Request, res: Response) => {
  const run = triggerTaskFlow(String(req.params.id));
  if (!run) {
    res.status(404).json({ error: 'TaskFlow not found or could not enqueue' });
    return;
  }
  void executeTaskFlowRun(run.id);
  res.status(202).json({ run: serializeRun(run) });
});

scheduledApiRouter.post('/flows/:id/pause', (req: Request, res: Response) => {
  const flow = pauseTaskFlow(String(req.params.id));
  if (!flow) {
    res.status(404).json({ error: 'TaskFlow not found' });
    return;
  }
  res.json({ flow: serializeFlow(flow) });
});

scheduledApiRouter.post('/flows/:id/resume', (req: Request, res: Response) => {
  const flow = resumeTaskFlow(String(req.params.id));
  if (!flow) {
    res.status(404).json({ error: 'TaskFlow not found' });
    return;
  }
  res.json({ flow: serializeFlow(flow) });
});

scheduledApiRouter.post('/runs/:id/cancel', (req: Request, res: Response) => {
  const run = cancelTaskFlowRun(String(req.params.id));
  if (!run) {
    res.status(404).json({ error: 'Run not found or not cancellable' });
    return;
  }
  res.json({ run: serializeRun(run) });
});
