import { Router, type Request, type Response, type Router as ExpressRouter } from 'express';
import { requireCloudProxy } from '../gateway/cloud-proxy-auth.js';
import { requireTeamPlan } from '../billing/aiva-plan-middleware.js';
import {
  parseAnalyticsPeriod,
  queryAnalyticsAdmin,
  queryAnalyticsAivaBreakdown,
  queryAnalyticsChannels,
  queryAnalyticsDirection,
  queryAnalyticsEscalations,
  queryAnalyticsHeatmap,
  queryAnalyticsOps,
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

function routeParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return String(value[0] ?? '');
  return String(value ?? '');
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

/** Phase 1 ops bundle: direction, approvals, escalation lifecycle, usage, channels w/ messages. */
aivaAnalyticsRouter.get('/ops', async (req: AnalyticsRequest, res: Response) => {
  const period = parseAnalyticsPeriod(req.query.period);
  res.json(await queryAnalyticsOps(req.workspaceId!, period));
});

aivaAnalyticsRouter.get('/direction', async (req: AnalyticsRequest, res: Response) => {
  const period = parseAnalyticsPeriod(req.query.period);
  res.json({ period, ...(await queryAnalyticsDirection(req.workspaceId!, period)) });
});

aivaAnalyticsRouter.get('/admin', async (req: AnalyticsRequest, res: Response) => {
  const period = parseAnalyticsPeriod(req.query.period);
  res.json(await queryAnalyticsAdmin(req.workspaceId!, period));
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
      threads: row.threads,
      messages: row.messages,
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

// --- Cohort retention (daily metric; never report totals alone) ---

aivaAnalyticsRouter.get('/cohort/dashboard', (req: AnalyticsRequest, res: Response) => {
  void import('./cohort/index.js').then(({ buildCohortDashboard, loadCohortActivityStore }) => {
    const period = req.query.period === 'month' ? 'month' : 'week';
    const throughWeek = Math.min(24, Math.max(1, Number(req.query.throughWeek) || 12));
    const snapshot = buildCohortDashboard(req.workspaceId!, {
      period,
      throughWeek,
      asOfDate: typeof req.query.asOf === 'string' ? req.query.asOf : undefined,
    });
    const store = loadCohortActivityStore();
    res.json({
      ...snapshot,
      refresh: {
        cadence: 'daily',
        lastComputedAt: store.lastComputedAt ?? snapshot.computedAt,
        note: 'Retention is a daily metric; dashboard data refreshes once per day.',
      },
    });
  });
});

aivaAnalyticsRouter.get('/cohort/compare', (req: AnalyticsRequest, res: Response) => {
  void import('./cohort/index.js').then(
    ({
      defineCohorts,
      listWorkspaceSignups,
      listWorkspaceActivity,
      compareCohorts,
    }) => {
      const a = typeof req.query.a === 'string' ? req.query.a : '';
      const b = typeof req.query.b === 'string' ? req.query.b : '';
      if (!a || !b) {
        res.status(400).json({ error: 'Query params a and b (cohort start dates YYYY-MM-DD) are required' });
        return;
      }
      const period = req.query.period === 'month' ? 'month' : 'week';
      const signups = listWorkspaceSignups(req.workspaceId!);
      const activity = listWorkspaceActivity(req.workspaceId!);
      const cohorts = defineCohorts(signups, period);
      const cohortA = cohorts.find((c) => c.startDate === a || c.id.endsWith(a));
      const cohortB = cohorts.find((c) => c.startDate === b || c.id.endsWith(b));
      if (!cohortA || !cohortB) {
        res.status(404).json({ error: 'One or both cohorts not found', available: cohorts.map((c) => c.startDate) });
        return;
      }
      res.json(compareCohorts(cohortA, cohortB, activity, Number(req.query.throughWeek) || 12));
    },
  );
});

aivaAnalyticsRouter.post('/cohort/activity', (req: AnalyticsRequest, res: Response) => {
  void import('./cohort/index.js').then(({ recordActivityDay, upsertSignup, toUtcDateString }) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const userId = typeof body.userId === 'string' ? body.userId.trim() : '';
    if (!userId) {
      res.status(400).json({ error: 'userId is required' });
      return;
    }
    if (typeof body.signedUpAt === 'string') {
      upsertSignup({
        userId,
        workspaceId: req.workspaceId!,
        signedUpAt: body.signedUpAt,
        reengagementOptOut: body.reengagementOptOut === true,
      });
    }
    if (body.date || body.active !== undefined) {
      const date = typeof body.date === 'string' ? body.date : toUtcDateString(new Date());
      recordActivityDay({
        userId,
        workspaceId: req.workspaceId!,
        date,
        active: body.active !== false,
      });
    }
    res.status(201).json({ ok: true });
  });
});

aivaAnalyticsRouter.post('/cohort/activity/batch', (req: AnalyticsRequest, res: Response) => {
  void import('./cohort/index.js').then(({ recordActivityDay, upsertSignup }) => {
    const body = (req.body ?? {}) as { signups?: unknown[]; activity?: unknown[] };
    let signupCount = 0;
    let activityCount = 0;
    for (const raw of body.signups ?? []) {
      const row = raw as Record<string, unknown>;
      if (typeof row.userId !== 'string' || typeof row.signedUpAt !== 'string') continue;
      upsertSignup({
        userId: row.userId,
        workspaceId: req.workspaceId!,
        signedUpAt: row.signedUpAt,
        reengagementOptOut: row.reengagementOptOut === true,
      });
      signupCount += 1;
    }
    for (const raw of body.activity ?? []) {
      const row = raw as Record<string, unknown>;
      if (typeof row.userId !== 'string' || typeof row.date !== 'string') continue;
      recordActivityDay({
        userId: row.userId,
        workspaceId: req.workspaceId!,
        date: row.date,
        active: row.active !== false,
      });
      activityCount += 1;
    }
    res.status(201).json({ ok: true, signupCount, activityCount });
  });
});

aivaAnalyticsRouter.get('/cohort/dropoff', (req: AnalyticsRequest, res: Response) => {
  void import('./cohort/index.js').then(({ detectWorkspaceDisengagement, detectCohortAnomalies, listReengagementJobs }) => {
    res.json({
      disengaged: detectWorkspaceDisengagement(req.workspaceId!),
      anomalies: detectCohortAnomalies(req.workspaceId!),
      reengagementJobs: listReengagementJobs(req.workspaceId!).slice(-50),
    });
  });
});

aivaAnalyticsRouter.post('/cohort/digest', (req: AnalyticsRequest, res: Response) => {
  void import('./cohort/index.js').then(({ buildDailyDropoffDigest }) => {
    const digest = buildDailyDropoffDigest(req.workspaceId!);
    res.json({ digest });
  });
});

// --- Feature adoption event tracking ---

aivaAnalyticsRouter.post('/events', (req: AnalyticsRequest, res: Response) => {
  void import('./events/index.js').then(({ trackEvent, trackFeatureUse, trackPageView, trackApiCall }) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const userId = typeof body.userId === 'string' ? body.userId.trim() : '';
    if (!userId) {
      res.status(400).json({ error: 'userId is required' });
      return;
    }
    const kind = typeof body.kind === 'string' ? body.kind : 'event';
    let result;
    if (kind === 'feature' || body.featureName) {
      result = trackFeatureUse(
        req.workspaceId!,
        userId,
        String(body.featureName ?? body.feature ?? ''),
        String(body.action ?? 'use'),
        {
          sessionId: typeof body.sessionId === 'string' ? body.sessionId : undefined,
          properties: (body.properties as Record<string, unknown> | undefined) ?? undefined,
        },
      );
    } else if (kind === 'page' || body.path) {
      result = trackPageView(req.workspaceId!, userId, String(body.path ?? '/'), {
        sessionId: typeof body.sessionId === 'string' ? body.sessionId : undefined,
      });
    } else if (kind === 'api') {
      result = trackApiCall(
        req.workspaceId!,
        userId,
        String(body.endpoint ?? ''),
        String(body.method ?? 'GET'),
        Number(body.statusCode ?? 0),
        Number(body.durationMs ?? 0),
        { sessionId: typeof body.sessionId === 'string' ? body.sessionId : undefined },
      );
    } else {
      result = trackEvent({
        workspaceId: req.workspaceId!,
        userId,
        eventName: String(body.eventName ?? 'custom'),
        sessionId: typeof body.sessionId === 'string' ? body.sessionId : undefined,
        properties: (body.properties as Record<string, unknown> | undefined) ?? undefined,
      });
    }
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.status(202).json({ queued: true, eventId: result.event.eventId });
  });
});

aivaAnalyticsRouter.post('/events/batch', (req: AnalyticsRequest, res: Response) => {
  void import('./events/index.js').then(({ trackEvent, flushEventsNow }) => {
    const body = (req.body ?? {}) as { events?: unknown[] };
    let accepted = 0;
    let rejected = 0;
    const errors: string[] = [];
    for (const raw of body.events ?? []) {
      const row = raw as Record<string, unknown>;
      const result = trackEvent({
        workspaceId: req.workspaceId!,
        userId: String(row.userId ?? ''),
        eventName: String(row.eventName ?? ''),
        sessionId: typeof row.sessionId === 'string' ? row.sessionId : undefined,
        timestamp: typeof row.timestamp === 'string' ? row.timestamp : undefined,
        properties: (row.properties as Record<string, unknown> | undefined) ?? undefined,
      });
      if (result.ok) accepted += 1;
      else {
        rejected += 1;
        if (errors.length < 5) errors.push(result.error);
      }
    }
    void flushEventsNow();
    res.status(202).json({ accepted, rejected, errors });
  });
});

aivaAnalyticsRouter.post('/events/flush', async (_req: AnalyticsRequest, res: Response) => {
  const { flushEventsNow, pendingEventCount } = await import('./events/index.js');
  const written = await flushEventsNow();
  res.json({ written, pending: pendingEventCount() });
});

aivaAnalyticsRouter.get('/events/adoption', (req: AnalyticsRequest, res: Response) => {
  void import('./events/index.js').then(({ getAdoptionSummary, getFeatureAdoption, getFeatureFrequency }) => {
    const to = typeof req.query.to === 'string' ? req.query.to : new Date().toISOString();
    const from =
      typeof req.query.from === 'string'
        ? req.query.from
        : new Date(Date.now() - 30 * 86_400_000).toISOString();
    const feature = typeof req.query.feature === 'string' ? req.query.feature : undefined;
    if (feature) {
      res.json({
        adoption: getFeatureAdoption(req.workspaceId!, feature, { from, to }),
        frequency: getFeatureFrequency(req.workspaceId!, feature, { from, to }),
      });
      return;
    }
    res.json(getAdoptionSummary(req.workspaceId!, { from, to }));
  });
});

aivaAnalyticsRouter.get('/events/unused', (req: AnalyticsRequest, res: Response) => {
  void import('./events/index.js').then(({ getUnusedFeatures }) => {
    const to = typeof req.query.to === 'string' ? req.query.to : new Date().toISOString();
    const from =
      typeof req.query.from === 'string'
        ? req.query.from
        : new Date(Date.now() - 30 * 86_400_000).toISOString();
    const threshold = Number(req.query.threshold ?? 20);
    res.json({
      unused: getUnusedFeatures(req.workspaceId!, { from, to }, threshold),
      thresholdPct: threshold,
    });
  });
});

aivaAnalyticsRouter.get('/events/journey/:userId', (req: AnalyticsRequest, res: Response) => {
  void import('./events/index.js').then(({ getUserJourney }) => {
    const userId = routeParam(req.params.userId);
    res.json({ events: getUserJourney(req.workspaceId!, userId) });
  });
});

aivaAnalyticsRouter.get('/events/active-metrics', (req: AnalyticsRequest, res: Response) => {
  void import('./events/index.js').then(({ getActiveUserMetrics }) => {
    const asOf = typeof req.query.asOf === 'string' ? req.query.asOf : undefined;
    res.json(getActiveUserMetrics(req.workspaceId!, asOf));
  });
});

aivaAnalyticsRouter.get('/events/registry', (_req: AnalyticsRequest, res: Response) => {
  void import('./events/index.js').then(({ REGISTERED_FEATURES, CORE_EVENT_NAMES }) => {
    res.json({ features: REGISTERED_FEATURES, coreEvents: CORE_EVENT_NAMES });
  });
});
