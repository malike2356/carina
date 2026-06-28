import { Router, type Request, type Response, type Router as ExpressRouter } from 'express';
import { requireCloudProxy } from '../gateway/cloud-proxy-auth.js';
import { requireTeamPlan } from '../billing/aiva-plan-middleware.js';
import {
  parseAnalyticsPeriod,
  queryAnalyticsAivaBreakdown,
  queryAnalyticsChannels,
  queryAnalyticsEscalations,
  queryAnalyticsHeatmap,
  queryAnalyticsSummary,
  queryAnalyticsVolume,
} from './aiva-analytics-queries.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type AnalyticsRequest = Request & { workspaceId?: string };

function resolveWorkspaceId(req: AnalyticsRequest): string | null {
  const header = req.headers['x-workspace-id'];
  const fromHeader = Array.isArray(header) ? header[0] : header;
  return fromHeader?.trim() && UUID_RE.test(fromHeader.trim()) ? fromHeader.trim() : null;
}

function requireWorkspace(req: AnalyticsRequest, res: Response, next: () => void): void {
  const workspaceId = resolveWorkspaceId(req);
  if (!workspaceId) {
    res.status(400).json({ error: 'workspaceId is required (X-Workspace-Id header)' });
    return;
  }
  req.workspaceId = workspaceId;
  next();
}

export const aivaAnalyticsRouter: ExpressRouter = Router();
aivaAnalyticsRouter.use(requireCloudProxy);
aivaAnalyticsRouter.use(requireWorkspace);

aivaAnalyticsRouter.get('/summary', async (req: AnalyticsRequest, res: Response) => {
  const period = parseAnalyticsPeriod(req.query.period);
  res.json(await queryAnalyticsSummary(req.workspaceId!, period));
});

aivaAnalyticsRouter.get('/volume', async (req: AnalyticsRequest, res: Response) => {
  const period = parseAnalyticsPeriod(req.query.period);
  res.json({ period, points: await queryAnalyticsVolume(req.workspaceId!, period) });
});

aivaAnalyticsRouter.get('/channels', requireTeamPlan, async (req: AnalyticsRequest, res: Response) => {
  const period = parseAnalyticsPeriod(req.query.period);
  res.json({ period, channels: await queryAnalyticsChannels(req.workspaceId!, period) });
});

aivaAnalyticsRouter.get('/escalations', requireTeamPlan, async (req: AnalyticsRequest, res: Response) => {
  const period = parseAnalyticsPeriod(req.query.period);
  res.json({ period, points: await queryAnalyticsEscalations(req.workspaceId!, period) });
});

aivaAnalyticsRouter.get('/heatmap', requireTeamPlan, async (req: AnalyticsRequest, res: Response) => {
  const period = parseAnalyticsPeriod(req.query.period);
  res.json({ period, cells: await queryAnalyticsHeatmap(req.workspaceId!, period) });
});

aivaAnalyticsRouter.get('/aiva-breakdown', requireTeamPlan, async (req: AnalyticsRequest, res: Response) => {
  const period = parseAnalyticsPeriod(req.query.period);
  res.json({ period, workers: await queryAnalyticsAivaBreakdown(req.workspaceId!, period) });
});

// Legacy overview endpoint used by older UI
aivaAnalyticsRouter.get('/overview', requireTeamPlan, async (req: AnalyticsRequest, res: Response) => {
  const period = parseAnalyticsPeriod(
    req.query.days === '7' ? '7d' : req.query.days === '90' ? '90d' : '30d',
  );
  const [summary, volume, channels, escalations, heatmap, workers] = await Promise.all([
    queryAnalyticsSummary(req.workspaceId!, period),
    queryAnalyticsVolume(req.workspaceId!, period),
    queryAnalyticsChannels(req.workspaceId!, period),
    queryAnalyticsEscalations(req.workspaceId!, period),
    queryAnalyticsHeatmap(req.workspaceId!, period),
    queryAnalyticsAivaBreakdown(req.workspaceId!, period),
  ]);
  res.json({
    rangeDays: period === '7d' ? 7 : period === '90d' ? 90 : 30,
    totalMessages: summary.messagesFromAiva,
    openEscalations: Math.round(summary.escalationRate * summary.messagesFromAiva),
    escalationRate: summary.escalationRate,
    volumeByDay: volume.map((row) => ({ date: row.date, messages: row.count })),
    channelBreakdown: channels.map((row) => ({
      channel: row.channel,
      threads: row.count,
      messages: row.count,
    })),
    perWorker: workers.map((row) => ({
      id: row.workerId,
      name: row.workerName,
      messages: row.messageCount,
      threads: row.messageCount,
    })),
    heatmap,
    summary,
  });
});
