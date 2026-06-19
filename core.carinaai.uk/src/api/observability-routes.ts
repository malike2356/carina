import type { Express, Request, Response } from 'express';
import { authorizeOps } from '../ops/ops-auth.js';
import { collectGatewayLogs, formatSseLogLine } from '../ops/observability/gateway-logs.js';
import { collectPresence, listSystemEvents } from '../ops/observability/system-events.js';
import { buildSessionOverview } from '../ops/observability/session-overview.js';
import { parseSinceArg } from '../telemetry/turn-log.js';
import { buildUsageMetricsSnapshot } from '../telemetry/usage-metrics.js';
import { buildPromptCacheObservability } from '../telemetry/prompt-cache-observability.js';
import { buildSessionTelemetryBundle } from '../telemetry/session-telemetry.js';
import {
  buildTelemetryHealthSnapshot,
  buildTelemetryOverview,
} from '../ops/observability/health-snapshot.js';
import { buildChannelHealthSnapshot } from '../ops/observability/channel-health.js';
import { listProviderObservations } from '../telemetry/provider-observation.js';
import { listSubagentMetrics } from '../telemetry/subagent-metrics.js';
import { getOtelStatus } from '../telemetry/otel.js';

function parseLimit(raw: unknown, fallback = 50, max = 500): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(n, max);
}

export function mountObservabilityRoutes(app: Express): void {
  app.get('/api/ops/logs', async (req: Request, res: Response) => {
    if (!authorizeOps(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const sinceRaw = typeof req.query.since === 'string' ? req.query.since : '';
    const since = sinceRaw ? parseSinceArg(sinceRaw) : undefined;
    const source = typeof req.query.source === 'string'
      ? (req.query.source as 'turn' | 'node-audit' | 'gateway')
      : undefined;
    const logs = await collectGatewayLogs({
      since,
      limit: parseLimit(req.query.limit),
      source,
    });
    res.json({ logs, count: logs.length });
  });

  app.get('/api/ops/logs/stream', async (req: Request, res: Response) => {
    if (!authorizeOps(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    let lastTs = '';
    const pollMs = 2000;
    const timer = setInterval(async () => {
      try {
        const logs = await collectGatewayLogs({ limit: 20 });
        const fresh = lastTs
          ? logs.filter((l) => l.ts > lastTs)
          : logs.slice(0, 5);
        for (const line of fresh.reverse()) {
          res.write(formatSseLogLine(line));
          if (!lastTs || line.ts > lastTs) lastTs = line.ts;
        }
      } catch {
        res.write(`data: ${JSON.stringify({ error: 'stream poll failed' })}\n\n`);
      }
    }, pollMs);

    req.on('close', () => clearInterval(timer));
  });

  app.get('/api/ops/events', (req: Request, res: Response) => {
    if (!authorizeOps(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const events = listSystemEvents(parseLimit(req.query.limit));
    const presence = collectPresence();
    res.json({ events, presence, presenceOnline: presence.filter((p) => p.online).length });
  });

  app.get('/api/ops/sessions', async (req: Request, res: Response) => {
    if (!authorizeOps(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const sessions = await buildSessionOverview();
    const statusFilter = typeof req.query.status === 'string' ? req.query.status : '';
    const filtered = statusFilter
      ? sessions.filter((s) => s.status === statusFilter)
      : sessions;
    res.json({
      sessions: filtered,
      summary: {
        active: sessions.filter((s) => s.status === 'active').length,
        idle: sessions.filter((s) => s.status === 'idle').length,
        stale: sessions.filter((s) => s.status === 'stale').length,
        total: sessions.length,
      },
    });
  });

  app.get('/api/ops/phone/presence', (req: Request, res: Response) => {
    if (!authorizeOps(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const presence = collectPresence().filter((p) =>
      p.kind === 'device' || p.meta?.role === 'phone',
    );
    const phoneNodeId = process.env.CARINA_PHONE_NODE_ID ?? null;
    res.json({
      phoneNodeId,
      devices: presence,
      online: presence.filter((p) => p.online).length,
    });
  });

  app.get('/api/ops/telemetry/health', async (req: Request, res: Response) => {
    if (!authorizeOps(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const snapshot = await buildTelemetryHealthSnapshot();
    res.json(snapshot);
  });

  app.get('/api/ops/telemetry/metrics', async (req: Request, res: Response) => {
    if (!authorizeOps(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const hours = Number(req.query.hours ?? 24);
    const metrics = await buildUsageMetricsSnapshot(Number.isFinite(hours) ? hours : 24);
    res.json({
      metrics,
      otel: getOtelStatus(),
      promptCache: buildPromptCacheObservability(),
      providers: listProviderObservations(parseLimit(req.query.providerLimit, 20, 100)),
      subagents: listSubagentMetrics(parseLimit(req.query.subagentLimit, 20, 100)),
    });
  });

  app.get('/api/ops/telemetry/overview', async (req: Request, res: Response) => {
    if (!authorizeOps(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const hours = Number(req.query.hours ?? 24);
    const overview = await buildTelemetryOverview(Number.isFinite(hours) ? hours : 24);
    res.json(overview);
  });

  app.get('/api/ops/telemetry/sessions', async (req: Request, res: Response) => {
    if (!authorizeOps(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const hours = Number(req.query.hours ?? 24);
    const bundle = await buildSessionTelemetryBundle(Number.isFinite(hours) ? hours : 24);
    res.json(bundle);
  });

  app.get('/api/ops/telemetry/channels', (req: Request, res: Response) => {
    if (!authorizeOps(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    res.json(buildChannelHealthSnapshot());
  });

  app.get('/api/ops/telemetry/prompt-cache', (req: Request, res: Response) => {
    if (!authorizeOps(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const limit = parseLimit(req.query.limit, 20, 100);
    res.json(buildPromptCacheObservability(limit));
  });

  app.get('/api/ops/telemetry/provider-quota', async (req: Request, res: Response) => {
    if (!authorizeOps(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { readProviderQuotaStore, pollProviderQuotas, providerQuotaPollingEnabled } =
      await import('../brain/provider-quota-poller.js');
    const refresh = req.query.refresh === '1' || req.query.refresh === 'true';
    const store = refresh ? await pollProviderQuotas() : readProviderQuotaStore();
    res.json({ enabled: providerQuotaPollingEnabled(), ...store });
  });
}
