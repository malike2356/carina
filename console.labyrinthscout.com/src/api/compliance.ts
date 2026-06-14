import { Router, type IRouter } from 'express';
import type { Request, Response } from 'express';
import { handleDataAccessRequest } from '../audit/compliance/data-access-request.js';
import { handleDataDeletion } from '../audit/compliance/data-deletion.js';
import { generateGdprReport } from '../audit/compliance/gdpr-report.js';
import { loadRegulatoryClassification } from '../governance/load-regulatory-classification.js';

export const complianceRouter: IRouter = Router();

complianceRouter.get('/regulatory-classification', async (_req: Request, res: Response): Promise<void> => {
  try {
    const classification = await loadRegulatoryClassification();
    res.json(classification);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[compliance:regulatory-classification] failed:', msg);
    res.status(500).json({ error: 'Internal server error' });
  }
});

complianceRouter.post('/sar', async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenant_id, email } = req.body as Record<string, unknown>;

    if (!tenant_id || typeof tenant_id !== 'string' || !tenant_id.trim()) {
      res.status(400).json({ error: 'tenant_id is required' });
      return;
    }
    if (!email || typeof email !== 'string' || !email.trim()) {
      res.status(400).json({ error: 'email is required' });
      return;
    }

    const exportData = await handleDataAccessRequest({
      tenant_id: tenant_id.trim(),
      email: email.trim(),
    });

    res.json(exportData);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[compliance:sar] SAR failed:', msg);
    res.status(500).json({ error: 'Internal server error' });
  }
});

complianceRouter.get('/report', async (_req: Request, res: Response): Promise<void> => {
  try {
    const report = await generateGdprReport();
    res.json(report);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[compliance:report] GDPR report failed:', msg);
    res.status(500).json({ error: 'Internal server error' });
  }
});

complianceRouter.post('/erase', async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenant_id, email } = req.body as Record<string, unknown>;

    if (!tenant_id || typeof tenant_id !== 'string' || !tenant_id.trim()) {
      res.status(400).json({ error: 'tenant_id is required' });
      return;
    }

    const result = await handleDataDeletion({
      tenant_id: tenant_id.trim(),
      email: typeof email === 'string' ? email.trim() : undefined,
    });

    res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[compliance:erase] Erasure failed:', msg);
    res.status(500).json({ error: 'Internal server error' });
  }
});
