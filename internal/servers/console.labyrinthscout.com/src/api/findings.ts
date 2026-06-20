import { Router, type IRouter } from 'express';
import type { Request, Response } from 'express';
import { resolveAccountId } from '../findings/account-scope.js';
import { getCurrentScoutScore } from '../findings/score.js';
import {
  createFinding,
  getFindingById,
  listFindings,
  updateFinding,
} from '../findings/store.js';
import type { FindingSeverity, FindingStatus } from '../findings/types.js';

export const findingsRouter: IRouter = Router();

const VALID_SEVERITIES = new Set<FindingSeverity>([
  'critical', 'high', 'medium', 'low', 'info',
]);

const VALID_STATUSES = new Set<FindingStatus>([
  'open', 'investigating', 'confirmed', 'false_positive', 'resolved',
]);

function parseSeverity(value: unknown): FindingSeverity | null {
  return typeof value === 'string' && VALID_SEVERITIES.has(value as FindingSeverity)
    ? value as FindingSeverity
    : null;
}

function parseStatus(value: unknown): FindingStatus | null {
  return typeof value === 'string' && VALID_STATUSES.has(value as FindingStatus)
    ? value as FindingStatus
    : null;
}

findingsRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  const accountId = resolveAccountId(req, res);
  if (!accountId) return;

  const severity = typeof req.query.severity === 'string'
    ? parseSeverity(req.query.severity) ?? undefined
    : undefined;
  const status = typeof req.query.status === 'string'
    ? parseStatus(req.query.status) ?? undefined
    : undefined;
  const tool = typeof req.query.tool === 'string' ? req.query.tool : undefined;
  const targetId = typeof req.query.target_id === 'string' ? req.query.target_id : undefined;
  const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : undefined;
  const offset = typeof req.query.offset === 'string' ? parseInt(req.query.offset, 10) : undefined;

  try {
    const findings = await listFindings(accountId, {
      severity,
      status,
      tool,
      targetId,
      limit: Number.isFinite(limit) ? limit : undefined,
      offset: Number.isFinite(offset) ? offset : undefined,
    });
    res.json({ findings });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[scout:findings] list failed:', msg);
    res.status(500).json({ error: 'Failed to list findings' });
  }
});

findingsRouter.get('/:findingId', async (req: Request, res: Response): Promise<void> => {
  const accountId = resolveAccountId(req, res);
  if (!accountId) return;

  const findingId = typeof req.params.findingId === 'string' ? req.params.findingId : '';
  if (!findingId) {
    res.status(400).json({ error: 'findingId is required' });
    return;
  }

  try {
    const finding = await getFindingById(accountId, findingId);
    if (!finding) {
      res.status(404).json({ error: 'Finding not found' });
      return;
    }
    res.json(finding);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[scout:findings] get failed:', msg);
    res.status(500).json({ error: 'Failed to load finding' });
  }
});

findingsRouter.post('/', async (req: Request, res: Response): Promise<void> => {
  const accountId = resolveAccountId(req, res);
  if (!accountId) return;

  const body = req.body as Record<string, unknown>;
  const targetId = typeof body.target_id === 'string' ? body.target_id : '';
  const tool = typeof body.tool === 'string' ? body.tool.trim() : '';
  const findingType = typeof body.finding_type === 'string' ? body.finding_type.trim() : '';
  const severity = parseSeverity(body.severity);
  const title = typeof body.title === 'string' ? body.title.trim() : '';

  if (!targetId || !tool || !findingType || !severity || !title) {
    res.status(400).json({
      error: 'target_id, tool, finding_type, severity, and title are required',
    });
    return;
  }

  const cvssScore = typeof body.cvss_score === 'number' ? body.cvss_score : undefined;
  const description = typeof body.description === 'string' ? body.description : undefined;
  const remediation = typeof body.remediation === 'string' ? body.remediation : undefined;
  const scanRunId = typeof body.scan_run_id === 'string' ? body.scan_run_id : undefined;
  const rawData = typeof body.raw_data === 'object' && body.raw_data !== null
    ? body.raw_data as Record<string, unknown>
    : undefined;

  try {
    const finding = await createFinding({
      accountId,
      targetId,
      tool,
      findingType,
      severity,
      title,
      cvssScore,
      description,
      remediation,
      scanRunId,
      rawData,
    });

    if (!finding) {
      res.status(404).json({ error: 'Target not found' });
      return;
    }

    void getCurrentScoutScore(accountId).catch(() => undefined);
    res.status(201).json(finding);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[scout:findings] create failed:', msg);
    res.status(500).json({ error: 'Failed to create finding' });
  }
});

findingsRouter.post('/:findingId/investigate', async (req: Request, res: Response): Promise<void> => {
  const accountId = resolveAccountId(req, res);
  if (!accountId) return;

  const findingId = typeof req.params.findingId === 'string' ? req.params.findingId : '';
  if (!findingId) {
    res.status(400).json({ error: 'findingId is required' });
    return;
  }

  const body = req.body as Record<string, unknown>;
  const operatorId = typeof body.operator_id === 'string' ? body.operator_id : 'scout-api';

  try {
    const finding = await getFindingById(accountId, findingId);
    if (!finding) {
      res.status(404).json({ error: 'Finding not found' });
      return;
    }

    const updated = finding.status === 'open'
      ? await updateFinding(accountId, findingId, { status: 'investigating' })
      : finding;

    res.status(202).json({
      investigation: {
        findingId,
        operatorId,
        status: 'opened',
        finding: updated,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[scout:findings] investigate failed:', msg);
    res.status(500).json({ error: 'Failed to open investigation' });
  }
});

findingsRouter.patch('/:findingId', async (req: Request, res: Response): Promise<void> => {
  const accountId = resolveAccountId(req, res);
  if (!accountId) return;

  const findingId = typeof req.params.findingId === 'string' ? req.params.findingId : '';
  if (!findingId) {
    res.status(400).json({ error: 'findingId is required' });
    return;
  }

  const body = req.body as Record<string, unknown>;
  const status = body.status !== undefined ? parseStatus(body.status) : undefined;
  const severity = body.severity !== undefined ? parseSeverity(body.severity) : undefined;

  if (body.status !== undefined && !status) {
    res.status(400).json({ error: 'Invalid status value' });
    return;
  }
  if (body.severity !== undefined && !severity) {
    res.status(400).json({ error: 'Invalid severity value' });
    return;
  }

  try {
    const finding = await updateFinding(accountId, findingId, {
      status: status ?? undefined,
      severity: severity ?? undefined,
      description: typeof body.description === 'string' ? body.description : undefined,
      remediation: typeof body.remediation === 'string' ? body.remediation : undefined,
      isNew: typeof body.is_new === 'boolean' ? body.is_new : undefined,
    });

    if (!finding) {
      res.status(404).json({ error: 'Finding not found' });
      return;
    }

    void getCurrentScoutScore(accountId).catch(() => undefined);
    res.json(finding);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[scout:findings] update failed:', msg);
    res.status(500).json({ error: 'Failed to update finding' });
  }
});
