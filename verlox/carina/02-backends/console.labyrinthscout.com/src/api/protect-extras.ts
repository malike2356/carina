import { Router, type IRouter, type Response } from 'express';
import { buildProtectBoardPack } from '../protect/board-pack.js';
import {
  queryBlastRadius,
  upsertGraphEdge,
  upsertGraphNode,
  type GraphEdgeType,
  type GraphNodeType,
} from '../graph/store.js';
import { validateTelemetryEvent, TELEMETRY_PII_RULES, TELEMETRY_RETENTION_DAYS_DEFAULT } from '../protect/telemetry-schema.js';
import { pool } from '../db.js';
import { runDetectionsOnEvent } from '../detections/rule-runner.js';
import { getVerdictSummary, verifySessionBlockTwoPlane } from '../planes/enforcement-verifier.js';
import type { RequestWithScoutAuth } from '../types/request.js';

export const protectExtrasRouter: IRouter = Router();

function requireAccountId(req: RequestWithScoutAuth, res: Response): string | null {
  if (req.scoutAuth?.kind === 'account') return req.scoutAuth.accountId;
  const fromBody = typeof req.body?.accountId === 'string' ? req.body.accountId.trim() : '';
  const fromQuery = typeof req.query.account_id === 'string' ? req.query.account_id.trim() : '';
  if (req.scoutAuth?.kind === 'operator' && (fromBody || fromQuery)) {
    return fromBody || fromQuery;
  }
  res.status(403).json({ error: 'Account auth required (or operator with account_id)' });
  return null;
}

/** GET /api/protect/board-pack */
protectExtrasRouter.get('/board-pack', async (req: RequestWithScoutAuth, res: Response): Promise<void> => {
  const accountId = requireAccountId(req, res);
  if (!accountId) return;
  const days = parseInt(String(req.query.days ?? '30'), 10);
  const generatedAt = typeof req.query.generated_at === 'string' ? req.query.generated_at : undefined;
  const pack = await buildProtectBoardPack({
    accountId,
    days: Number.isFinite(days) ? days : 30,
    generatedAt,
  });
  res.json(pack);
});

/** GET /api/protect/telemetry/schema */
protectExtrasRouter.get('/telemetry/schema', (_req, res: Response): void => {
  res.json({
    schema_version: 'protect.telemetry.v1',
    retention_days_default: TELEMETRY_RETENTION_DAYS_DEFAULT,
    pii_rules: TELEMETRY_PII_RULES,
  });
});

/** POST /api/protect/telemetry/ingest - validated Protect telemetry (account or sensor via protect key path). */
protectExtrasRouter.post('/telemetry/ingest', async (req: RequestWithScoutAuth, res: Response): Promise<void> => {
  const accountId = requireAccountId(req, res);
  if (!accountId) return;
  const sensorId = typeof req.body?.sensor_id === 'string' ? req.body.sensor_id : '';
  if (!sensorId) {
    res.status(400).json({ error: 'sensor_id required' });
    return;
  }
  const owned = await pool.query(
    `SELECT id FROM sensor_keys WHERE id = $1::uuid AND account_id = $2 AND active = true`,
    [sensorId, accountId],
  );
  if (!owned.rows[0]) {
    res.status(404).json({ error: 'sensor_id not found for tenant' });
    return;
  }

  const events = Array.isArray(req.body?.events) ? req.body.events : [req.body];
  const stored: string[] = [];
  const hits: unknown[] = [];
  const errors: string[] = [];

  for (const raw of events) {
    const validated = validateTelemetryEvent(raw, { tenantId: accountId, sensorId });
    if (!validated.ok) {
      errors.push(validated.error);
      continue;
    }
    const ev = validated.event;
    const result = await pool.query<{ id: string }>(
      `INSERT INTO sensor_events (account_id, sensor_key_id, event_type, payload)
       VALUES ($1, $2::uuid, $3, $4) RETURNING id`,
      [accountId, sensorId, ev.event_type, JSON.stringify(ev)],
    );
    const id = result.rows[0]?.id;
    if (id) {
      stored.push(id);
      const detectionHits = runDetectionsOnEvent(ev.event_type, ev.payload);
      if (detectionHits.length) hits.push({ eventId: id, detections: detectionHits });
    }
  }

  await pool.query(`UPDATE sensor_keys SET last_seen_at = NOW() WHERE id = $1::uuid`, [sensorId]);

  if (stored.length === 0 && errors.length) {
    res.status(400).json({ stored: 0, errors });
    return;
  }
  res.json({ stored: stored.length, ids: stored, detections: hits, errors });
});

/** Graph APIs */
protectExtrasRouter.post('/graph/nodes', async (req: RequestWithScoutAuth, res: Response): Promise<void> => {
  const accountId = requireAccountId(req, res);
  if (!accountId) return;
  const nodeType = req.body?.nodeType as GraphNodeType;
  const externalKey = typeof req.body?.externalKey === 'string' ? req.body.externalKey : '';
  const label = typeof req.body?.label === 'string' ? req.body.label : externalKey;
  if (!nodeType || !externalKey) {
    res.status(400).json({ error: 'nodeType and externalKey required' });
    return;
  }
  const id = await upsertGraphNode({
    accountId,
    nodeType,
    externalKey,
    label,
    properties: typeof req.body?.properties === 'object' ? req.body.properties : {},
  });
  res.status(201).json({ id });
});

protectExtrasRouter.post('/graph/edges', async (req: RequestWithScoutAuth, res: Response): Promise<void> => {
  const accountId = requireAccountId(req, res);
  if (!accountId) return;
  const edgeType = req.body?.edgeType as GraphEdgeType;
  const fromNodeId = typeof req.body?.fromNodeId === 'string' ? req.body.fromNodeId : '';
  const toNodeId = typeof req.body?.toNodeId === 'string' ? req.body.toNodeId : '';
  if (!edgeType || !fromNodeId || !toNodeId) {
    res.status(400).json({ error: 'edgeType, fromNodeId, toNodeId required' });
    return;
  }
  const id = await upsertGraphEdge({
    accountId,
    edgeType,
    fromNodeId,
    toNodeId,
    score: typeof req.body?.score === 'number' ? req.body.score : 0,
    properties: typeof req.body?.properties === 'object' ? req.body.properties : {},
  });
  res.status(201).json({ id });
});

protectExtrasRouter.get('/graph/blast-radius/:nodeId', async (req: RequestWithScoutAuth, res: Response): Promise<void> => {
  const accountId = requireAccountId(req, res);
  if (!accountId) return;
  const nodeIdParam = req.params.nodeId;
  const nodeId = Array.isArray(nodeIdParam) ? nodeIdParam[0] : nodeIdParam;
  if (!nodeId) {
    res.status(400).json({ error: 'nodeId required' });
    return;
  }
  const hops = parseInt(String(req.query.hops ?? '2'), 10);
  const neighbors = await queryBlastRadius(accountId, nodeId, Number.isFinite(hops) ? hops : 2);
  res.json({
    nodeId,
    neighbors,
    limits: [
      'Max 2 hops by default',
      'Not BloodHound Enterprise; no AD/Kerberos path finding',
      'Scores are heuristic only',
    ],
  });
});

/** Two-plane verify trigger (lab / operator). */
protectExtrasRouter.post('/two-plane/session-block', async (req: RequestWithScoutAuth, res: Response): Promise<void> => {
  const accountId = requireAccountId(req, res);
  if (!accountId) return;
  const sessionId = typeof req.body?.sessionId === 'string' ? req.body.sessionId : '';
  if (!sessionId) {
    res.status(400).json({ error: 'sessionId required' });
    return;
  }
  const result = await verifySessionBlockTwoPlane({
    accountId,
    sessionId,
    appEventId: typeof req.body?.appEventId === 'string' ? req.body.appEventId : null,
    delayMs: typeof req.body?.delayMs === 'number' ? req.body.delayMs : 50,
  });
  res.json(result);
});

protectExtrasRouter.get('/two-plane/summary', async (req: RequestWithScoutAuth, res: Response): Promise<void> => {
  const accountId = requireAccountId(req, res);
  if (!accountId) return;
  const days = parseInt(String(req.query.days ?? '30'), 10);
  res.json(await getVerdictSummary(accountId, Number.isFinite(days) ? days : 30));
});
