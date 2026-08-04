import { Router, type Request, type Response, type Router as ExpressRouter } from 'express';
import { requireCloudProxy } from '../../gateway/cloud-proxy-auth.js';
import { createYouTubeClient } from '../../connectors/youtube/client.js';
import { listLeads } from '../../lead-capture/youtube/store.js';
import { buildChannelDashboard, getTopVideos } from './reporter.js';
import { generateWeeklyReport, listWeeklyReports } from './weekly-report.js';

type DashboardRequest = Request & { workspaceId?: string };

function routeParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return String(value[0] ?? '');
  return String(value ?? '');
}

function resolveWorkspaceId(req: DashboardRequest): string | null {
  const header = req.headers['x-workspace-id'];
  const fromHeader = Array.isArray(header) ? header[0] : header;
  return fromHeader?.trim() || null;
}

export const youtubeChannelAnalyticsRouter: ExpressRouter = Router();
youtubeChannelAnalyticsRouter.use(requireCloudProxy);
youtubeChannelAnalyticsRouter.use((req: DashboardRequest, res: Response, next) => {
  const workspaceId = resolveWorkspaceId(req);
  if (!workspaceId) {
    res.status(400).json({ error: 'workspaceId is required (X-Workspace-Id header)' });
    return;
  }
  req.workspaceId = workspaceId;
  next();
});

youtubeChannelAnalyticsRouter.get('/:channelId/analytics', async (req: DashboardRequest, res: Response) => {
  try {
    const client = createYouTubeClient(req.workspaceId!, routeParam(req.params.channelId));
    const dashboard = await buildChannelDashboard(client, req.workspaceId!);
    res.json(dashboard);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

youtubeChannelAnalyticsRouter.get('/:channelId/analytics/videos', async (req: DashboardRequest, res: Response) => {
  try {
    const client = createYouTubeClient(req.workspaceId!, routeParam(req.params.channelId));
    const videoIds = typeof req.query.videoIds === 'string' ? req.query.videoIds.split(',').filter(Boolean) : [];
    const videos = await getTopVideos(client, videoIds);
    res.json({ videos });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

youtubeChannelAnalyticsRouter.get('/:channelId/analytics/leads', async (req: DashboardRequest, res: Response) => {
  try {
    const classification = typeof req.query.classification === 'string' ? req.query.classification : undefined;
    const leads = listLeads(
      req.workspaceId!,
      routeParam(req.params.channelId),
      classification ? { classification: classification as never } : undefined,
    );
    res.json({ leads });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

youtubeChannelAnalyticsRouter.get('/:channelId/analytics/weekly', async (req: DashboardRequest, res: Response) => {
  try {
    const client = createYouTubeClient(req.workspaceId!, routeParam(req.params.channelId));
    if (req.query.regenerate === 'true') {
      const report = await generateWeeklyReport(client, req.workspaceId!);
      res.json({ report });
      return;
    }
    const reports = listWeeklyReports(routeParam(req.params.channelId));
    res.json({ reports });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
