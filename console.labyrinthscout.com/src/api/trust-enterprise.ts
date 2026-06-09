import { Router, type IRouter } from 'express';
import type { Request, Response } from 'express';
import { pool } from '../db.js';
import { buildTrustHistory } from '../trust/trust-history.js';
import {
  buildEnterpriseComplianceReport,
  complianceReportToPdfLines,
} from '../trust/compliance-report.js';
import { mapEventToIncident } from '../trust/incident-types.js';
import { scopedAccountId } from '../lib/scope.js';

export const trustEnterpriseRouter: IRouter = Router();

function simplePdfFromLines(lines: string[]): Buffer {
  const content = lines.map((line) => line.slice(0, 100)).join('\n');
  const body = [
    '%PDF-1.4',
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj',
    `4 0 obj << /Length ${content.length} >> stream`,
    content,
    'endstream endobj',
    '5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Courier >> endobj',
    'xref',
    '0 6',
    '0000000000 65535 f ',
    '0000000009 00000 n ',
    '0000000062 00000 n ',
    '0000000118 00000 n ',
    '0000000262 00000 n ',
    '0000000345 00000 n ',
    'trailer << /Size 6 /Root 1 0 R >>',
    'startxref',
    '400',
    '%%EOF',
  ];
  return Buffer.from(body.join('\n'), 'ascii');
}

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

  try {
    const result = await pool.query<{
      id: string;
      severity: string;
      event_type: string;
      description: string;
      instance_id: string | null;
      session_id: string | null;
      created_at: Date;
    }>(
      accountId
        ? `SELECT e.id, e.severity, e.event_type, e.description, e.instance_id, e.session_id, e.created_at
           FROM security_events e
           JOIN carina_instances i ON i.id = e.instance_id
           WHERE i.account_id = $1
             AND e.severity IN ('warning', 'critical', 'breach')
           ORDER BY e.created_at DESC
           LIMIT $2`
        : `SELECT id, severity, event_type, description, instance_id, session_id, created_at
           FROM security_events
           WHERE severity IN ('warning', 'critical', 'breach')
           ORDER BY created_at DESC
           LIMIT $1`,
      accountId ? [accountId, limit] : [limit],
    );

    let incidents = result.rows.map(mapEventToIncident);
    if (typeFilter && ['type1', 'type2', 'type3'].includes(typeFilter)) {
      incidents = incidents.filter((item) => item.incident_type === typeFilter);
    }

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
      const pdf = simplePdfFromLines(complianceReportToPdfLines(report));
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
