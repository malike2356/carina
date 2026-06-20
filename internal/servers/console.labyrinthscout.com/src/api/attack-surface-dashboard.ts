import { Router, type IRouter } from 'express';
import type { Request, Response } from 'express';
import { resolveAccountId } from '../findings/account-scope.js';
import { getCurrentScoutScore } from '../findings/score.js';
import { listFindings, listScanRuns, listTargets } from '../findings/store.js';

export const attackSurfaceDashboardRouter: IRouter = Router();

attackSurfaceDashboardRouter.get('/summary', async (req: Request, res: Response): Promise<void> => {
  const accountId = resolveAccountId(req, res);
  if (!accountId) return;

  try {
    const [targets, findings, score, scans] = await Promise.all([
      listTargets(accountId),
      listFindings(accountId, { limit: 200 }),
      getCurrentScoutScore(accountId, true),
      listScanRuns(accountId, { limit: 15 }),
    ]);

    const open = findings.filter((f) => ['open', 'investigating', 'confirmed'].includes(f.status));
    const bySeverity = {
      critical: open.filter((f) => f.severity === 'critical').length,
      high: open.filter((f) => f.severity === 'high').length,
      medium: open.filter((f) => f.severity === 'medium').length,
      low: open.filter((f) => f.severity === 'low').length,
      info: open.filter((f) => f.severity === 'info').length,
    };

    const openPorts = open
      .filter((f) => f.findingType === 'open_port')
      .map((f) => f.rawData.port)
      .filter((p): p is number => typeof p === 'number');

    const subdomains = open
      .filter((f) => f.findingType === 'subdomain')
      .map((f) => String(f.rawData.subdomain ?? ''))
      .filter(Boolean);

    const cves = open.filter((f) => f.findingType === 'cve');

    res.json({
      scoutScore: score,
      targets,
      severity: bySeverity,
      openFindings: open.length,
      attackSurface: {
        openPorts: [...new Set(openPorts)].sort((a, b) => a - b),
        subdomains: [...new Set(subdomains)].slice(0, 30),
        cveCount: cves.length,
        topCves: cves.slice(0, 10).map((f) => ({
          id: f.id,
          title: f.title,
          severity: f.severity,
          cvssScore: f.cvssScore,
          tool: f.tool,
          status: f.status,
          targetId: f.targetId,
        })),
      },
      recentFindings: open.slice(0, 20),
      recentScans: scans,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[scout:attack-surface] summary failed:', msg);
    res.status(500).json({ error: 'Failed to load attack surface summary' });
  }
});
