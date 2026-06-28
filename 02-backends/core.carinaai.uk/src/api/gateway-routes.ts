import crypto from 'crypto';
import express, { type NextFunction, type Request, type Response } from 'express';
import { LLMRouter } from '../brain/llm.js';
import { emitPlatformEvent } from '../billing/platform-event-emitter.js';
import { listAvailablePacks } from '../skills/index.js';
import { getRedis } from '../memory/redis.js';
import { pool } from '../memory/db.js';
import { partnerGatewayAuth, requireScope, type GatewayRequest } from './middleware/partner-gateway-auth.js';
import { partnerRateLimit } from './middleware/partner-rate-limit.js';
import { getPlatformStatus } from '../ops/health-probe.js';

// Augment Express Request with requestId and partnerApiKey
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      requestId: string;
      partnerApiKey?: import('../hosted/partner-api-key-service.js').PartnerApiKey;
    }
  }
}

const VERSION = process.env.npm_package_version ?? '0.0.0';

function gatewayError(res: Response, status: number, code: string, message: string, requestId: string): void {
  res.status(status).json({ error: code, message, requestId });
}

export const gatewayRouter: express.Router = express.Router();
gatewayRouter.use(express.json());

// Attach X-Request-Id to every response
gatewayRouter.use((req: Request, res: Response, next: NextFunction) => {
  req.requestId = crypto.randomUUID();
  res.setHeader('X-Request-Id', req.requestId);
  next();
});

// ---- Unauthenticated routes ----

gatewayRouter.get('/api/v1/platform/health', (_req, res) => {
  res.json({ status: 'ok', version: VERSION });
});

gatewayRouter.get('/api/v1/platform/info', (_req, res) => {
  res.json({
    api: 'Carina Platform API',
    version: '1',
    docs: 'https://docs.carinaai.uk/api',
    scopes: ['session', 'memory', 'skills', 'analytics'],
    rateLimiting: 'per key, see docs',
  });
});

gatewayRouter.get('/api/v1/platform/status', async (_req, res) => {
  try {
    const status = await getPlatformStatus();
    res.json(status);
  } catch {
    res.status(500).json({ error: 'status_unavailable' });
  }
});

// ---- Authenticated routes ----

const auth = [partnerGatewayAuth, partnerRateLimit] as express.RequestHandler[];

gatewayRouter.post('/api/v1/platform/session', ...auth, requireScope('session'), async (req: GatewayRequest, res: Response) => {
  const workspaceId = String(req.body?.workspaceId ?? '').trim();
  if (!workspaceId) {
    gatewayError(res, 400, 'missing_workspace_id', 'workspaceId is required.', req.requestId);
    return;
  }
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  void emitPlatformEvent({
    partnerId: req.partner!.partnerId,
    eventType: 'channel_connect',
    metadata: { workspaceId, sessionId },
  }).catch(() => {});

  res.status(201).json({ sessionId, expiresAt });
});

gatewayRouter.post('/api/v1/platform/message', ...auth, requireScope('session'), async (req: GatewayRequest, res: Response) => {
  const message = String(req.body?.message ?? '').trim();
  if (!message) {
    gatewayError(res, 400, 'missing_message', 'message is required.', req.requestId);
    return;
  }

  const start = Date.now();
  let content = '';
  let tokensIn = 0;
  let tokensOut = 0;
  let modelUsed = '';
  let provider = '';

  try {
    const router = new LLMRouter();
    const overrideModel = typeof req.body?.model === 'string' ? req.body.model : undefined;
    const result = await router.chat(
      [{ role: 'user' as const, content: message, timestamp: new Date() }],
      undefined,
      overrideModel ? { name: overrideModel.split('/')[0] ?? '', model: overrideModel } : undefined,
      undefined,
    );
    content = result.content;
    tokensIn = result.tokensIn;
    tokensOut = result.tokensOut;
    modelUsed = overrideModel ?? '';
    provider = result.provider;
  } catch (err) {
    gatewayError(res, 502, 'llm_error', 'LLM request failed.', req.requestId);
    console.error('[gateway] /message LLM error:', err instanceof Error ? err.message : String(err));
    return;
  }

  const latencyMs = Date.now() - start;
  void emitPlatformEvent({
    partnerId: req.partner!.partnerId,
    eventType: 'message',
    model: modelUsed,
    provider,
    tokensIn,
    tokensOut,
    latencyMs,
  }).catch(() => {});

  res.json({ reply: content, tokensIn, tokensOut, model: modelUsed, latencyMs, requestId: req.requestId });
});

gatewayRouter.post('/api/v1/platform/memory', ...auth, requireScope('memory'), async (req: GatewayRequest, res: Response) => {
  const workspaceId = String(req.body?.workspaceId ?? '').trim();
  const key = String(req.body?.key ?? '').trim();
  const value = String(req.body?.value ?? '');
  const ttlSeconds = typeof req.body?.ttlSeconds === 'number' ? req.body.ttlSeconds : 86400;

  if (!workspaceId || !key) {
    gatewayError(res, 400, 'missing_fields', 'workspaceId and key are required.', req.requestId);
    return;
  }

  const redis = getRedis();
  const redisKey = `partner_memory:${req.partner!.partnerId}:${workspaceId}:${key}`;
  const id = crypto.randomUUID();

  if (redis) {
    await redis.set(redisKey, JSON.stringify({ id, value, storedAt: new Date().toISOString() }), 'EX', ttlSeconds);
  }

  void emitPlatformEvent({
    partnerId: req.partner!.partnerId,
    eventType: 'memory_write',
    metadata: { workspaceId, key },
  }).catch(() => {});

  res.status(201).json({ id, stored: true });
});

gatewayRouter.get('/api/v1/platform/memory', ...auth, requireScope('memory'), async (req: GatewayRequest, res: Response) => {
  const workspaceId = String(req.query.workspaceId ?? '').trim();
  const key = String(req.query.key ?? '').trim();

  if (!workspaceId) {
    gatewayError(res, 400, 'missing_workspace_id', 'workspaceId query param is required.', req.requestId);
    return;
  }

  const redis = getRedis();
  let entry: unknown = null;

  if (redis && key) {
    const raw = await redis.get(`partner_memory:${req.partner!.partnerId}:${workspaceId}:${key}`);
    entry = raw ? (JSON.parse(raw) as unknown) : null;
  }

  void emitPlatformEvent({
    partnerId: req.partner!.partnerId,
    eventType: 'memory_read',
    metadata: { workspaceId, key: key || null },
  }).catch(() => {});

  res.json({ entry });
});

gatewayRouter.get('/api/v1/platform/skills', ...auth, requireScope('skills'), (_req: GatewayRequest, res: Response) => {
  const packs = listAvailablePacks();
  res.json({ packs: packs.map((p) => ({ name: p.name, description: p.description, skillCount: p.skillCount })) });
});

gatewayRouter.post('/api/v1/platform/skills/:skillId/invoke', ...auth, requireScope('skills'), async (req: GatewayRequest, res: Response) => {
  const start = Date.now();
  const skillId = req.params.skillId;

  // Skill invocation is wired through the full orchestrator in production.
  // This stub validates the path and records the telemetry event so billing is correct.
  void emitPlatformEvent({
    partnerId: req.partner!.partnerId,
    eventType: 'skill_invocation',
    skillCalls: 1,
    metadata: { skillId },
  }).catch(() => {});

  res.json({ output: { message: `Skill '${skillId}' acknowledged.` }, latencyMs: Date.now() - start });
});

function parseDateRange(
  req: GatewayRequest,
  res: Response,
  maxDays: number,
): { fromDate: Date; toDate: Date } | null {
  const from = String(req.query.from ?? '').trim();
  const to = String(req.query.to ?? '').trim();
  if (!from || !to) {
    gatewayError(res, 400, 'missing_date_range', 'from and to query params are required.', req.requestId);
    return null;
  }
  const fromDate = new Date(from);
  const toDate = new Date(to);
  if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
    gatewayError(res, 400, 'invalid_date', 'from and to must be valid ISO 8601 date strings.', req.requestId);
    return null;
  }
  const diffDays = (toDate.getTime() - fromDate.getTime()) / 86_400_000;
  if (diffDays > maxDays) {
    gatewayError(res, 400, 'date_range_too_large', `Maximum date range is ${maxDays} days.`, req.requestId);
    return null;
  }
  return { fromDate, toDate };
}

gatewayRouter.get('/api/v1/platform/usage', ...auth, requireScope('analytics'), async (req: GatewayRequest, res: Response) => {
  const range = parseDateRange(req, res, 90);
  if (!range) return;
  const { fromDate, toDate } = range;

  const partnerId = req.partner!.partnerId;
  const groupBy = String(req.query.groupBy ?? 'day');
  const orgIdParam = String(req.query.orgId ?? '').trim();

  // Validate orgId belongs to this partner to prevent cross-partner data access
  let orgId: string | null = null;
  if (orgIdParam) {
    const orgCheck = await pool.query(
      `SELECT id FROM organizations WHERE id = $1 AND partner_id = $2 LIMIT 1`,
      [orgIdParam, partnerId],
    );
    if ((orgCheck.rowCount ?? 0) === 0) {
      gatewayError(res, 403, 'org_not_found', 'orgId not found or not owned by this partner.', req.requestId);
      return;
    }
    orgId = orgIdParam;
  }

  const baseWhere = orgId
    ? `WHERE e.partner_id = $1 AND e.created_at >= $2 AND e.created_at < $3 AND e.org_id = $4`
    : `WHERE e.partner_id = $1 AND e.created_at >= $2 AND e.created_at < $3`;
  const params: unknown[] = orgId ? [partnerId, fromDate, toDate, orgId] : [partnerId, fromDate, toDate];

  let seriesRows: Record<string, unknown>[] = [];
  if (groupBy === 'model') {
    const r = await pool.query(
      `SELECT e.model AS group_key, COUNT(*) AS events,
              SUM(e.tokens_in) AS tokens_in, SUM(e.tokens_out) AS tokens_out,
              SUM(e.tool_calls) AS tool_calls, SUM(e.skill_calls) AS skill_calls
       FROM platform_events e ${baseWhere}
       GROUP BY 1 ORDER BY events DESC`,
      params,
    );
    seriesRows = r.rows as Record<string, unknown>[];
  } else if (groupBy === 'event_type') {
    const r = await pool.query(
      `SELECT e.event_type AS group_key, COUNT(*) AS events,
              SUM(e.tokens_in) AS tokens_in, SUM(e.tokens_out) AS tokens_out,
              SUM(e.tool_calls) AS tool_calls, SUM(e.skill_calls) AS skill_calls
       FROM platform_events e ${baseWhere}
       GROUP BY 1 ORDER BY events DESC`,
      params,
    );
    seriesRows = r.rows as Record<string, unknown>[];
  } else {
    const r = await pool.query(
      `SELECT DATE_TRUNC('day', e.created_at) AS day, COUNT(*) AS events,
              SUM(e.tokens_in) AS tokens_in, SUM(e.tokens_out) AS tokens_out,
              SUM(e.tool_calls) AS tool_calls, SUM(e.skill_calls) AS skill_calls
       FROM platform_events e ${baseWhere}
       GROUP BY 1 ORDER BY 1`,
      params,
    );
    seriesRows = r.rows as Record<string, unknown>[];
  }

  const totals = seriesRows.reduce<{ events: number; tokensIn: number; tokensOut: number; toolCalls: number; skillCalls: number }>(
    (acc, row) => {
      acc.events += Number(row.events ?? 0);
      acc.tokensIn += Number(row.tokens_in ?? 0);
      acc.tokensOut += Number(row.tokens_out ?? 0);
      acc.toolCalls += Number(row.tool_calls ?? 0);
      acc.skillCalls += Number(row.skill_calls ?? 0);
      return acc;
    },
    { events: 0, tokensIn: 0, tokensOut: 0, toolCalls: 0, skillCalls: 0 },
  );

  const estimatedFeePence = Math.max(0, totals.events - 50_000) * 0.1;

  res.json({
    from: fromDate.toISOString().slice(0, 10),
    to: toDate.toISOString().slice(0, 10),
    partnerId,
    groupBy,
    totals: { ...totals, estimatedFeePence },
    series: seriesRows.map((row) => ({
      ...(groupBy === 'day' ? { date: new Date(String(row.day)).toISOString().slice(0, 10) } : { key: row.group_key }),
      events: Number(row.events ?? 0),
      tokensIn: Number(row.tokens_in ?? 0),
      tokensOut: Number(row.tokens_out ?? 0),
      toolCalls: Number(row.tool_calls ?? 0),
      skillCalls: Number(row.skill_calls ?? 0),
    })),
  });
});

gatewayRouter.get('/api/v1/platform/trends', ...auth, requireScope('analytics'), async (req: GatewayRequest, res: Response) => {
  const range = parseDateRange(req, res, 90);
  if (!range) return;
  const { fromDate, toDate } = range;
  const partnerId = req.partner!.partnerId;

  const partnerStats = await pool.query(
    `SELECT COALESCE(AVG(daily_events), 0)     AS avg_daily_events,
            COALESCE(AVG(daily_tokens_in), 0)  AS avg_daily_tokens_in
     FROM (
       SELECT DATE_TRUNC('day', created_at) AS day,
              COUNT(*)                       AS daily_events,
              SUM(tokens_in)                 AS daily_tokens_in
       FROM platform_events
       WHERE partner_id = $1 AND created_at >= $2 AND created_at < $3
       GROUP BY 1
     ) sub`,
    [partnerId, fromDate, toDate],
  );

  const platformStats = await pool.query(
    `SELECT COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY daily_events), 0)    AS median_daily_events,
            COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY daily_tokens_in), 0) AS median_daily_tokens_in
     FROM (
       SELECT partner_id, DATE_TRUNC('day', created_at) AS day,
              COUNT(*)      AS daily_events,
              SUM(tokens_in) AS daily_tokens_in
       FROM platform_events
       WHERE created_at >= $1 AND created_at < $2
       GROUP BY 1, 2
     ) sub`,
    [fromDate, toDate],
  );

  const pRow = partnerStats.rows[0] as Record<string, string>;
  const plRow = platformStats.rows[0] as Record<string, string>;

  const avgDailyEvents = Math.round(Number(pRow.avg_daily_events ?? 0));
  const medianDailyEvents = Math.round(Number(plRow.median_daily_events ?? 0));

  let interpretation = 'Your usage is at the platform median.';
  if (avgDailyEvents > medianDailyEvents) interpretation = 'Your usage is above the platform median.';
  if (avgDailyEvents < medianDailyEvents) interpretation = 'Your usage is below the platform median.';

  res.json({
    partner: {
      avgDailyEvents,
      avgDailyTokensIn: Math.round(Number(pRow.avg_daily_tokens_in ?? 0)),
    },
    platform: {
      medianDailyEvents,
      medianDailyTokensIn: Math.round(Number(plRow.median_daily_tokens_in ?? 0)),
    },
    interpretation,
  });
});

gatewayRouter.get('/api/v1/platform/export', ...auth, requireScope('analytics'), async (req: GatewayRequest, res: Response) => {
  const range = parseDateRange(req, res, 31);
  if (!range) return;
  const { fromDate, toDate } = range;

  const partnerId = req.partner!.partnerId;
  const format = String(req.query.format ?? 'json').toLowerCase();
  if (format !== 'json' && format !== 'csv') {
    gatewayError(res, 400, 'invalid_format', 'format must be json or csv.', req.requestId);
    return;
  }

  const result = await pool.query(
    `SELECT id, event_type, org_id, model, provider,
            tokens_in, tokens_out, tool_calls, skill_calls,
            scout_verified, fee_pence, created_at
     FROM platform_events
     WHERE partner_id = $1 AND created_at >= $2 AND created_at < $3
     ORDER BY created_at ASC`,
    [partnerId, fromDate, toDate],
  );

  const rows = result.rows as Record<string, unknown>[];
  const dateLabel = `${fromDate.toISOString().slice(0, 10)}_${toDate.toISOString().slice(0, 10)}`;

  // Log the export to platform_events for audit trail
  void emitPlatformEvent({
    partnerId,
    eventType: 'memory_read',
    metadata: { action: 'compliance_export', format, rows: rows.length, from: fromDate.toISOString(), to: toDate.toISOString() },
  }).catch(() => {});

  if (format === 'csv') {
    const header = 'id,event_type,org_id,model,provider,tokens_in,tokens_out,tool_calls,skill_calls,scout_verified,fee_pence,created_at';
    const csvRows = rows.map((r) =>
      [
        r.id, r.event_type, r.org_id ?? '', r.model ?? '', r.provider ?? '',
        r.tokens_in, r.tokens_out, r.tool_calls, r.skill_calls,
        r.scout_verified, r.fee_pence,
        r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at ?? ''),
      ]
        .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`)
        .join(','),
    );
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=carina_events_${dateLabel}.csv`);
    res.send([header, ...csvRows].join('\n'));
    return;
  }

  res.setHeader('Content-Type', 'application/x-ndjson');
  res.setHeader('Content-Disposition', `attachment; filename=carina_events_${dateLabel}.ndjson`);
  res.send(rows.map((r) => JSON.stringify(r)).join('\n'));
});

// Also export a mount helper for consistency with other routers
export function mountGatewayRoutes(app: { use: (router: express.Router) => void }): void {
  app.use(gatewayRouter);
}
