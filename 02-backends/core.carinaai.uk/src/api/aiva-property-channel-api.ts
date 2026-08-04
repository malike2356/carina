import { Router, type Request, type Response, type Router as ExpressRouter } from 'express';
import { requireCloudProxy } from '../gateway/cloud-proxy-auth.js';
import { listDomains, listNiches, isChannelNicheId, nicheBelongsToDomain, resolveDomainForNiche, isChannelDomainId } from '../content/script-generator/niches.js';
import { getCalendar } from '../content/script-generator/store.js';
import { listRenderJobs, lastRenderError, queueDepth } from '../content/media-pipeline/store.js';
import { listLeads, updateLeadStatus } from '../lead-capture/youtube/store.js';
import { getQuotaUsage } from '../connectors/youtube/quota.js';
import {
  advancePropertyChannelWorkflow,
  cancelWorkflow,
  getWorkflowRun,
  pauseWorkflow,
  resumeWorkflow,
  startPropertyChannelWorkflow,
} from '../workflows/templates/property-channel/template.js';
import { listPropertyChannelRuns } from '../workflows/templates/property-channel/store.js';
import { getChannelCadenceStatus } from '../workflows/templates/property-channel/cadence-scheduler.js';
import { listWeeklyReports } from '../analytics/youtube-channel/weekly-report.js';

export const aivaPropertyChannelRouter: ExpressRouter = Router();
/** Preferred mount path alias; same handlers as property-channel. */
export const aivaYouTubeChannelRouter = aivaPropertyChannelRouter;
aivaPropertyChannelRouter.use(requireCloudProxy);

type PropertyChannelRequest = Request & { workspaceId?: string };

function routeParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return String(value[0] ?? '');
  return String(value ?? '');
}

function resolveWorkspaceId(req: PropertyChannelRequest): string | null {
  const header = req.headers['x-workspace-id'];
  const fromHeader = Array.isArray(header) ? header[0] : header;
  return fromHeader?.trim() || null;
}

aivaPropertyChannelRouter.use((req: PropertyChannelRequest, res: Response, next) => {
  const workspaceId = resolveWorkspaceId(req);
  if (!workspaceId) {
    res.status(400).json({ error: 'workspaceId is required (X-Workspace-Id header)' });
    return;
  }
  req.workspaceId = workspaceId;
  next();
});

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

aivaPropertyChannelRouter.get('/niches', (_req: Request, res: Response) => {
  res.json({ domains: listDomains(), niches: listNiches() });
});

aivaPropertyChannelRouter.get('/', (req: PropertyChannelRequest, res: Response) => {
  res.json({ runs: listPropertyChannelRuns(req.workspaceId!) });
});

aivaPropertyChannelRouter.post('/', (req: PropertyChannelRequest, res: Response) => {
  const niche = String(req.body?.niche ?? '').trim();
  const location = String(req.body?.location ?? '').trim();
  const publishTime = String(req.body?.publishTime ?? '18:30').trim();
  const channelId = typeof req.body?.channelId === 'string' ? req.body.channelId.trim() || undefined : undefined;
  const domainRaw = String(req.body?.domain ?? '').trim();

  if (!isChannelNicheId(niche)) {
    res.status(400).json({ error: 'A valid niche is required' });
    return;
  }
  const domain = isChannelDomainId(domainRaw) ? domainRaw : resolveDomainForNiche(niche);
  if (!nicheBelongsToDomain(niche, domain)) {
    res.status(400).json({ error: 'niche does not belong to the selected domain' });
    return;
  }
  if (!location) {
    res.status(400).json({ error: 'location is required' });
    return;
  }
  if (!TIME_RE.test(publishTime)) {
    res.status(400).json({ error: 'publishTime must be in HH:MM 24-hour format' });
    return;
  }

  const run = startPropertyChannelWorkflow({
    workspaceId: req.workspaceId!,
    domain,
    niche,
    location,
    publishTime,
    channelId,
  });
  res.status(201).json({ run });
});

aivaPropertyChannelRouter.get('/:runId', (req: Request, res: Response) => {
  const run = getWorkflowRun(routeParam(req.params.runId));
  if (!run) {
    res.status(404).json({ error: 'Run not found' });
    return;
  }
  res.json({ run });
});

aivaPropertyChannelRouter.post('/:runId/advance', async (req: Request, res: Response) => {
  try {
    const run = await advancePropertyChannelWorkflow(routeParam(req.params.runId));
    res.json({ run });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

aivaPropertyChannelRouter.post('/:runId/pause', (req: Request, res: Response) => {
  const run = pauseWorkflow(routeParam(req.params.runId));
  if (!run) {
    res.status(404).json({ error: 'Run not found' });
    return;
  }
  res.json({ run });
});

aivaPropertyChannelRouter.post('/:runId/resume', (req: Request, res: Response) => {
  const run = resumeWorkflow(routeParam(req.params.runId));
  if (!run) {
    res.status(404).json({ error: 'Run not found' });
    return;
  }
  res.json({ run });
});

aivaPropertyChannelRouter.post('/:runId/cancel', (req: Request, res: Response) => {
  const run = cancelWorkflow(routeParam(req.params.runId));
  if (!run) {
    res.status(404).json({ error: 'Run not found' });
    return;
  }
  res.json({ run });
});

aivaPropertyChannelRouter.get('/:channelId/calendar', (req: PropertyChannelRequest, res: Response) => {
  const calendar = getCalendar(req.workspaceId!, routeParam(req.params.channelId));
  res.json({ calendar });
});

aivaPropertyChannelRouter.get('/:channelId/videos', (req: PropertyChannelRequest, res: Response) => {
  const channelId = routeParam(req.params.channelId);
  const jobs = listRenderJobs(req.workspaceId!, channelId);
  const depth = queueDepth();
  res.json({
    jobs,
    queueDepth: depth,
    lastRenderError: lastRenderError(req.workspaceId!, channelId),
    renderingNote: 'Rendering usually takes several minutes. Jobs move queued to rendering to ready automatically.',
  });
});

aivaPropertyChannelRouter.get('/:channelId/queue', (req: PropertyChannelRequest, res: Response) => {
  const channelId = routeParam(req.params.channelId);
  const runs = listPropertyChannelRuns(req.workspaceId!);
  const run = runs.find((r) => {
    const provisioned = (r.context['channel-provision'] as { channelId?: string } | undefined)?.channelId;
    return provisioned === channelId || r.input.channelId === channelId;
  });
  res.json(getChannelCadenceStatus({
    workspaceId: req.workspaceId!,
    channelId,
    publishTime: run?.input.publishTime,
  }));
});

aivaPropertyChannelRouter.get('/:channelId/reports', (req: PropertyChannelRequest, res: Response) => {
  const reports = listWeeklyReports(routeParam(req.params.channelId));
  res.json({ reports });
});

aivaPropertyChannelRouter.get('/:channelId/leads', (req: PropertyChannelRequest, res: Response) => {
  const classification = typeof req.query.classification === 'string' ? req.query.classification : undefined;
  const leads = listLeads(
    req.workspaceId!,
    routeParam(req.params.channelId),
    classification ? { classification: classification as never } : undefined,
  );
  res.json({ leads });
});

aivaPropertyChannelRouter.patch('/leads/:leadId', (req: Request, res: Response) => {
  const status = String(req.body?.status ?? '').trim();
  if (!['new', 'routed', 'responded', 'handled'].includes(status)) {
    res.status(400).json({ error: 'Invalid status' });
    return;
  }
  const lead = updateLeadStatus(routeParam(req.params.leadId), status as never);
  if (!lead) {
    res.status(404).json({ error: 'Lead not found' });
    return;
  }
  res.json({ lead });
});

aivaPropertyChannelRouter.get('/:channelId/quota', (req: Request, res: Response) => {
  res.json(getQuotaUsage(routeParam(req.params.channelId)));
});
