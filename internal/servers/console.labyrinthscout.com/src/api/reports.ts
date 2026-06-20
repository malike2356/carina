import { Router, type IRouter } from 'express';
import type { Request, Response } from 'express';
import { resolveAccountId } from '../findings/account-scope.js';
import { buildAccountStixBundle } from '../findings/stix-export.js';
import { getTargetById, listFindings, listTargets } from '../findings/store.js';
import { getCurrentScoutScore } from '../findings/score.js';
import { listScanRuns } from '../findings/store.js';

export const reportsRouter: IRouter = Router();

reportsRouter.get('/stix', async (req: Request, res: Response): Promise<void> => {
  const accountId = resolveAccountId(req, res);
  if (!accountId) return;

  const targetId = typeof req.query.target_id === 'string' ? req.query.target_id : undefined;
  const cveOnly = req.query.cve_only !== 'false';

  try {
    const bundle = await buildAccountStixBundle(accountId, { targetId, cveOnly });
    res.json(bundle);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[scout:reports] stix failed:', msg);
    res.status(500).json({ error: 'Failed to generate STIX bundle' });
  }
});

reportsRouter.get('/stix/download', async (req: Request, res: Response): Promise<void> => {
  const accountId = resolveAccountId(req, res);
  if (!accountId) return;

  const targetId = typeof req.query.target_id === 'string' ? req.query.target_id : undefined;

  try {
    const bundle = await buildAccountStixBundle(accountId, { targetId, cveOnly: true });
    const filename = `scout-stix-${targetId ?? accountId}.json`;
    res.setHeader('Content-Type', 'application/stix+json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(JSON.stringify(bundle, null, 2));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[scout:reports] stix download failed:', msg);
    res.status(500).json({ error: 'Failed to export STIX bundle' });
  }
});

reportsRouter.get('/latest', async (req: Request, res: Response): Promise<void> => {
  const accountId = resolveAccountId(req, res);
  if (!accountId) return;

  const targetId = typeof req.query.target_id === 'string' ? req.query.target_id : undefined;

  try {
    const [findings, score, targets, scans] = await Promise.all([
      listFindings(accountId, { targetId, limit: 50 }),
      getCurrentScoutScore(accountId, false),
      listTargets(accountId),
      listScanRuns(accountId, { targetId, limit: 10 }),
    ]);

    const cveFindings = findings.filter((f) => f.findingType === 'cve');
    res.json({
      generatedAt: new Date().toISOString(),
      scoutScore: score,
      summary: {
        targets: targets.length,
        openFindings: findings.filter((f) => f.status === 'open').length,
        critical: findings.filter((f) => f.severity === 'critical').length,
        high: findings.filter((f) => f.severity === 'high').length,
        cves: cveFindings.length,
      },
      findings: findings.slice(0, 25),
      recentScans: scans,
      stixUrl: `/api/reports/stix${targetId ? `?target_id=${targetId}` : ''}`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[scout:reports] latest failed:', msg);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

reportsRouter.get('/target/:targetId', async (req: Request, res: Response): Promise<void> => {
  const accountId = resolveAccountId(req, res);
  if (!accountId) return;

  const targetId = typeof req.params.targetId === 'string' ? req.params.targetId : '';
  if (!targetId) {
    res.status(400).json({ error: 'targetId is required' });
    return;
  }

  try {
    const target = await getTargetById(accountId, targetId);
    if (!target) {
      res.status(404).json({ error: 'Target not found' });
      return;
    }

    const [findings, score, scans, stix] = await Promise.all([
      listFindings(accountId, { targetId, limit: 100 }),
      getCurrentScoutScore(accountId, false),
      listScanRuns(accountId, { targetId, limit: 20 }),
      buildAccountStixBundle(accountId, { targetId, cveOnly: true }),
    ]);

    res.json({
      target,
      scoutScore: score,
      findings,
      scans,
      stix,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[scout:reports] target report failed:', msg);
    res.status(500).json({ error: 'Failed to generate target report' });
  }
});
