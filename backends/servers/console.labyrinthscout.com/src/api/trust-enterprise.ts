import { Router, type IRouter } from 'express';
import type { Request, Response } from 'express';
import { pool } from '../db.js';
import { buildTrustHistory } from '../trust/trust-history.js';
import {
  buildEnterpriseComplianceReport,
  complianceReportToPdfLines,
} from '../trust/compliance-report.js';
import { mapEventToIncident, incidentTypeSqlCondition } from '../trust/incident-types.js';
import { buildTextPagePdf } from '../lib/simple-pdf.js';
import { scopedAccountId } from '../lib/scope.js';

export const trustEnterpriseRouter: IRouter = Router();

trustEnterpriseRouter.get('/history', async (_req: Request, res: Response): Promise<void> => {
  try {
    const payload = await buildTrustHistory();
    res.json(payload);
  } catch (err) {
    console.error('[trust-enterprise] history failed:', err);
    res.status(500).json({ error: 'Trust history unavailable' });
  }
});

trustEnterpriseRouter.get('/incidents', async (req: Request, res: Response): Promise<void> => {
  const accountId = scopedAccountId(req);
  const typeFilter = typeof req.query.type === 'string' ? req.query.type : null;
  const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit ?? '50'), 10) || 50));

  const params: unknown[] = [];
  const conditions = [`e.severity IN ('warning', 'critical', 'breach')`];

  if (accountId) {
    params.push(accountId);
    conditions.push(`i.account_id = $${params.length}`);
  }

  if (typeFilter && ['type1', 'type2', 'type3'].includes(typeFilter)) {
    const typeSql = incidentTypeSqlCondition(typeFilter as 'type1' | 'type2' | 'type3', 'e');
    if (typeSql) conditions.push(typeSql);
  }

  params.push(limit);
  const limitParam = `$${params.length}`;

  try {
    const whereBase = accountId
      ? `FROM security_events e JOIN carina_instances i ON i.id = e.instance_id WHERE ${conditions.join(' AND ')}`
      : `FROM security_events e WHERE ${conditions.filter((c) => !c.includes('i.account_id')).join(' AND ')}`;

    const selectCols = accountId
      ? `SELECT e.id, e.severity, e.event_type, e.description, e.instance_id, e.session_id, e.created_at`
      : `SELECT e.id, e.severity, e.event_type, e.description, e.instance_id, e.session_id, e.created_at`;

    const result = await pool.query<{
      id: string;
      severity: string;
      event_type: string;
      description: string;
      instance_id: string | null;
      session_id: string | null;
      created_at: Date;
    }>(
      `${selectCols} ${whereBase} ORDER BY e.created_at DESC LIMIT ${limitParam}`,
      params,
    );

    const incidents = result.rows.map(mapEventToIncident);

    res.json({
      generated_at: new Date().toISOString(),
      count: incidents.length,
      incidents,
    });
  } catch (err) {
    console.error('[trust-enterprise] incidents failed:', err);
    res.status(500).json({ error: 'Incident timeline unavailable' });
  }
});

trustEnterpriseRouter.get('/compliance-report', async (req: Request, res: Response): Promise<void> => {
  const format = String(req.query.format ?? 'json');

  try {
    const report = await buildEnterpriseComplianceReport();
    if (format === 'pdf') {
      const pdf = buildTextPagePdf(complianceReportToPdfLines(report));
      const dateStr = new Date().toISOString().slice(0, 10);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="scout-compliance-${dateStr}.pdf"`);
      res.send(pdf);
      return;
    }

    res.json(report);
  } catch (err) {
    console.error('[trust-enterprise] compliance report failed:', err);
    res.status(500).json({ error: 'Compliance report unavailable' });
  }
});
