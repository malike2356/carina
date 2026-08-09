// HTTP routes for repository secret scanning on live scout-engine (/api/v1/...).
import { Router, type Request, type Response } from 'express';
import { resolveAccountId } from './account.js';
import { newCorrelationId, sendSecretScanError } from './errors.js';
import { getSecretScanHealth } from './health.js';
import { ingestSecretScan } from './ingest.js';
import {
  getAggregatePosture,
  listConnectors,
  listFindings,
  listScanRuns,
  transitionRemediation,
} from './service.js';

export const secretScanningRouter = Router();

function extractApiKey(req: Request): string | null {
  const headerKey = req.headers['x-scout-key'];
  if (typeof headerKey === 'string' && headerKey.trim()) return headerKey.trim();
  return null;
}

function accountRaw(req: Request): string | undefined {
  const q = req.query.account_id;
  if (typeof q === 'string' && q.trim()) return q.trim();
  const body = req.body as { account_id?: unknown } | undefined;
  if (body && typeof body.account_id === 'string') return body.account_id;
  return undefined;
}

secretScanningRouter.post('/repository-secret-scans', async (req: Request, res: Response) => {
  const correlationId = newCorrelationId();
  try {
    const apiKey = extractApiKey(req);
    if (!apiKey) {
      sendSecretScanError(res, 401, 'unauthorized', correlationId);
      return;
    }
    const accountId = await resolveAccountId(accountRaw(req));
    const rawLength =
      typeof req.headers['content-length'] === 'string'
        ? parseInt(req.headers['content-length'], 10)
        : Buffer.byteLength(JSON.stringify(req.body ?? {}), 'utf8');

    const result = await ingestSecretScan(
      {
        accountId,
        apiKey,
        correlationId,
        requestByteLength: Number.isFinite(rawLength) ? rawLength : 0,
      },
      req.body,
    );

    if (!result.ok) {
      sendSecretScanError(res, result.status, result.code, result.correlationId);
      return;
    }

    res.status(result.status).json({
      scan_run_id: result.scanRunId,
      connector_id: result.connectorId,
      duplicate: result.duplicate,
      findings_accepted: result.findingsAccepted,
      findings_deduped: result.findingsDeduped,
      correlation_id: result.correlationId,
    });
  } catch {
    sendSecretScanError(res, 500, 'internal', correlationId);
  }
});

secretScanningRouter.get('/repository-connectors', async (req, res) => {
  const correlationId = newCorrelationId();
  try {
    const accountId = await resolveAccountId(accountRaw(req));
    const connectors = await listConnectors(accountId);
    res.json({ connectors, correlation_id: correlationId });
  } catch {
    sendSecretScanError(res, 500, 'internal', correlationId);
  }
});

secretScanningRouter.get('/repository-secret-scans', async (req, res) => {
  const correlationId = newCorrelationId();
  try {
    const accountId = await resolveAccountId(accountRaw(req));
    const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? '50'), 10) || 50, 1), 200);
    const offset = Math.max(parseInt(String(req.query.offset ?? '0'), 10) || 0, 0);
    const scans = await listScanRuns(accountId, limit, offset);
    res.json({ scans, correlation_id: correlationId });
  } catch {
    sendSecretScanError(res, 500, 'internal', correlationId);
  }
});

secretScanningRouter.get('/repository-secret-findings', async (req, res) => {
  const correlationId = newCorrelationId();
  try {
    const accountId = await resolveAccountId(accountRaw(req));
    const findings = await listFindings(accountId, {
      status: typeof req.query.status === 'string' ? req.query.status : undefined,
      limit: parseInt(String(req.query.limit ?? '50'), 10) || 50,
      offset: parseInt(String(req.query.offset ?? '0'), 10) || 0,
    });
    res.json({ findings, correlation_id: correlationId });
  } catch {
    sendSecretScanError(res, 500, 'internal', correlationId);
  }
});

secretScanningRouter.post('/repository-secret-findings/:id/remediation', async (req, res) => {
  const correlationId = newCorrelationId();
  try {
    const accountId = await resolveAccountId(accountRaw(req));
    const toStatus = String((req.body as { status?: string })?.status ?? '');
    const reason = (req.body as { reason?: string })?.reason;
    const result = await transitionRemediation({
      accountId,
      findingId: req.params.id,
      toStatus,
      actor: 'ops',
      reason,
    });
    if (!result.ok) {
      sendSecretScanError(res, result.code === 'not_found' ? 404 : 400, result.code, correlationId);
      return;
    }
    res.json({ finding: result.finding, correlation_id: correlationId });
  } catch {
    sendSecretScanError(res, 500, 'internal', correlationId);
  }
});

secretScanningRouter.get('/repository-security/posture', async (req, res) => {
  const correlationId = newCorrelationId();
  try {
    const accountId = await resolveAccountId(accountRaw(req));
    const posture = await getAggregatePosture(accountId);
    res.json({ posture, correlation_id: correlationId });
  } catch {
    sendSecretScanError(res, 500, 'internal', correlationId);
  }
});

secretScanningRouter.get('/repository-security/health', async (_req, res) => {
  const health = await getSecretScanHealth();
  res.json({ repository_secret_scanning: health });
});
