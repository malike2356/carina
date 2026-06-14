import { Router, type IRouter } from 'express';
import type { Request, Response } from 'express';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { buildGovernancePosture } from '../governance/build-governance-posture.js';
import { buildReportSections, generateGovernancePdf } from '../governance/board-report-pdf.js';

export const governanceRouter: IRouter = Router();

const pkgVersion = (() => {
  try {
    const pkgPath = join(dirname(fileURLToPath(import.meta.url)), '../../package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { version?: string };
    return pkg.version ?? '0.1.0';
  } catch {
    return '0.1.0';
  }
})();

function accountLabel(req: Request): string {
  if (req.session?.accountId) return `account:${req.session.accountId}`;
  return 'operator';
}

governanceRouter.get('/posture', async (req: Request, res: Response): Promise<void> => {
  try {
    const posture = await buildGovernancePosture(req.session?.accountId);
    res.json(posture);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[governance] posture failed:', msg);
    res.status(500).json({ error: 'Governance posture unavailable' });
  }
});

governanceRouter.get('/board-report', async (req: Request, res: Response): Promise<void> => {
  try {
    const format = typeof req.query.format === 'string' ? req.query.format : 'pdf';
    const posture = await buildGovernancePosture(req.session?.accountId);

    if (format === 'json') {
      res.json({
        ...posture,
        report_sections: buildReportSections(posture),
        scout_version: pkgVersion,
        account: accountLabel(req),
      });
      return;
    }

    const pdf = generateGovernancePdf(posture, {
      scoutVersion: pkgVersion,
      accountLabel: accountLabel(req),
    });
    const dateStr = posture.generated_at.slice(0, 10);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="scout-governance-report-${dateStr}.pdf"`);
    res.send(pdf);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[governance] board-report failed:', msg);
    res.status(500).json({ error: 'Board report unavailable' });
  }
});
