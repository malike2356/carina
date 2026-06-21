import { Router, type NextFunction, type Request, type Response, type Router as ExpressRouter } from 'express';
import { initDb } from '../memory/db.js';
import {
  createJob,
  executeJob,
  getJob,
  listJobs,
  parseSchedule,
  removeJob,
  updateJob,
  type ScheduledJob,
} from '../agents/cron-scheduler.js';
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
import { listCronJobHistory } from '../agents/job-history.js';
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
    scriptPath: job.scriptPath,
    noAgent: job.noAgent,
    contextFrom: job.contextFrom,
    chainAfter: job.chainAfter,
    enabledToolsets: job.enabledToolsets,
    workdir: job.workdir,
    deliverChannels: job.deliverChannels,
    modelProvider: job.modelProvider,
    modelName: job.modelName,
    repeatCount: job.repeatCount,
    runsRemaining: job.runsRemaining,
    failureLimit: job.failureLimit,
    failureCount: job.failureCount,
    createdAt: job.createdAt.toISOString(),
  };
}

function parseStringArray(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map((value) => String(value).trim()).filter(Boolean);
  if (typeof raw === 'string') {
    return raw.split(',').map((value) => value.trim()).filter(Boolean);
  }
  return [];
}

function parseNullableString(raw: unknown): string | null {
  if (raw == null) return null;
  const value = String(raw).trim();
  return value ? value : null;
}

function parseNullableNumber(raw: unknown): number | undefined {
  if (raw == null || raw === '') return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

function parseNullableBoolean(raw: unknown): boolean | undefined {
  if (raw == null || raw === '') return undefined;
  if (typeof raw === 'boolean') return raw;
  if (typeof raw === 'string') {
    const lowered = raw.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(lowered)) return true;
    if (['false', '0', 'no', 'off'].includes(lowered)) return false;
  }
  return Boolean(raw);
}

function parseCronJobBody(raw: unknown): Partial<ScheduledJob> & { schedule?: string; name?: string | null } {
  const body = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const schedule = parseNullableString(body.schedule) ?? undefined;
  if (schedule) parseSchedule(schedule);
  return {
    name: parseNullableString(body.name),
    schedule,
    prompt: parseNullableString(body.prompt),
    scriptPath: parseNullableString(body.scriptPath),
    noAgent: parseNullableBoolean(body.noAgent),
    deliver: parseNullableString(body.deliver) ?? undefined,
    repeatCount: parseNullableNumber(body.repeatCount),
    runsRemaining: parseNullableNumber(body.runsRemaining),
    contextFrom: body.contextFrom == null ? undefined : parseStringArray(body.contextFrom),
    chainAfter: body.chainAfter == null ? undefined : parseStringArray(body.chainAfter),
    enabledToolsets: body.enabledToolsets == null ? undefined : parseStringArray(body.enabledToolsets),
    workdir: parseNullableString(body.workdir),
    deliverChannels: body.deliverChannels == null ? undefined : parseStringArray(body.deliverChannels),
    profileName: parseNullableString(body.profileName) ?? undefined,
    modelProvider: parseNullableString(body.modelProvider),
    modelName: parseNullableString(body.modelName),
    failureLimit: parseNullableNumber(body.failureLimit),
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

scheduledApiRouter.post('/cron', async (req: Request, res: Response) => {
  await initDb();
  try {
    const body = parseCronJobBody(req.body);
    if (!body.schedule) {
      res.status(400).json({ error: 'Schedule is required' });
      return;
    }
    const job = await createJob({
      name: body.name ?? null,
      schedule: body.schedule,
      prompt: body.prompt ?? null,
      scriptPath: body.scriptPath ?? null,
      scriptConfig: null,
      noAgent: body.noAgent ?? false,
      deliver: body.deliver ?? 'origin',
      repeatCount: body.repeatCount ?? null,
      runsRemaining: body.runsRemaining ?? null,
      contextFrom: body.contextFrom ?? [],
      chainAfter: body.chainAfter ?? [],
      enabledToolsets: body.enabledToolsets ?? [],
      workdir: body.workdir ?? null,
      originSessionId: null,
      originChannel: null,
      originConversationId: null,
      originThreadId: null,
      deliverChannels: body.deliverChannels ?? [],
      profileName: body.profileName ?? 'default',
      modelProvider: body.modelProvider ?? null,
      modelName: body.modelName ?? null,
      failureLimit: body.failureLimit ?? 3,
      failureCount: 0,
    });
    res.status(201).json({ job: serializeCronJob(job) });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

scheduledApiRouter.put('/cron/:id', async (req: Request, res: Response) => {
  await initDb();
  try {
    const id = String(req.params.id);
    const existing = await getJob(id);
    if (!existing) {
      res.status(404).json({ error: 'Cron job not found' });
      return;
    }
    const body = parseCronJobBody(req.body);
    const job = await updateJob(id, {
      name: body.name ?? existing.name,
      schedule: body.schedule ?? existing.schedule,
      prompt: body.prompt ?? existing.prompt,
      scriptPath: body.scriptPath ?? existing.scriptPath,
      noAgent: body.noAgent ?? existing.noAgent,
      deliver: body.deliver ?? existing.deliver,
      repeatCount: body.repeatCount ?? existing.repeatCount,
      runsRemaining: body.runsRemaining ?? existing.runsRemaining,
      contextFrom: body.contextFrom ?? existing.contextFrom,
      chainAfter: body.chainAfter ?? existing.chainAfter,
      enabledToolsets: body.enabledToolsets ?? existing.enabledToolsets,
      workdir: body.workdir ?? existing.workdir,
      deliverChannels: body.deliverChannels ?? existing.deliverChannels,
      profileName: body.profileName ?? existing.profileName,
      modelProvider: body.modelProvider ?? existing.modelProvider,
      modelName: body.modelName ?? existing.modelName,
      failureLimit: body.failureLimit ?? existing.failureLimit,
      failureCount: existing.failureCount,
    });
    if (!job) {
      res.status(404).json({ error: 'Cron job not found' });
      return;
    }
    res.json({ job: serializeCronJob(job) });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

scheduledApiRouter.delete('/cron/:id', async (req: Request, res: Response) => {
  await initDb();
  const removed = await removeJob(String(req.params.id));
  if (!removed) {
    res.status(404).json({ error: 'Cron job not found' });
    return;
  }
  res.json({ ok: true });
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

scheduledApiRouter.post('/cron/:id/run', async (req: Request, res: Response) => {
  await initDb();
  const id = String(req.params.id);
  const job = await getJob(id);
  if (!job || job.status === 'removed') {
    res.status(404).json({ error: 'Cron job not found' });
    return;
  }
  const output = await executeJob(id);
  const updated = await getJob(id);
  res.status(202).json({
    job: updated ? serializeCronJob(updated) : serializeCronJob(job),
    output,
  });
});

scheduledApiRouter.get('/cron/:id/history', async (req: Request, res: Response) => {
  await initDb();
  const id = String(req.params.id);
  const job = await getJob(id);
  if (!job || job.status === 'removed') {
    res.status(404).json({ error: 'Cron job not found' });
    return;
  }
  const limit = Number(req.query.limit ?? 20);
  const history = await listCronJobHistory(id, { limit: Number.isFinite(limit) ? limit : 20 });
  res.json({ history });
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
