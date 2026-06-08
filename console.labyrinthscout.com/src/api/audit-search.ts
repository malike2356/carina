import { Router, type IRouter } from 'express';
import type { Request, Response } from 'express';
import { searchAuditLog } from '../audit/audit-search.js';
import { AUDIT_EVENT_TYPES, AUDIT_SEVERITIES } from '../audit/audit-schemas.js';
import type { AuditEventType, AuditSeverity } from '../audit/audit-schemas.js';

export const auditSearchRouter: IRouter = Router();

const VALID_EVENT_TYPES = new Set<string>(AUDIT_EVENT_TYPES);
const VALID_SEVERITIES = new Set<string>(AUDIT_SEVERITIES);

// GET /api/audit/search
// Query params: tenant_id, event_type, severity, from, to, query, page, per_page
auditSearchRouter.get('/search', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId =
      typeof req.query.tenant_id === 'string' && req.query.tenant_id.trim()
        ? req.query.tenant_id.trim()
        : undefined;

    const eventType =
      typeof req.query.event_type === 'string' &&
      VALID_EVENT_TYPES.has(req.query.event_type)
        ? (req.query.event_type as AuditEventType)
        : undefined;

    const severity =
      typeof req.query.severity === 'string' &&
      VALID_SEVERITIES.has(req.query.severity)
        ? (req.query.severity as AuditSeverity)
        : undefined;

    const from =
      typeof req.query.from === 'string' && req.query.from.trim()
        ? req.query.from.trim()
        : undefined;

    const to =
      typeof req.query.to === 'string' && req.query.to.trim()
        ? req.query.to.trim()
        : undefined;

    const query =
      typeof req.query.query === 'string' && req.query.query.trim()
        ? req.query.query.trim()
        : undefined;

    const page = parseInt(String(req.query.page ?? '1'), 10);
    const perPage = parseInt(String(req.query.per_page ?? '50'), 10);

    const result = await searchAuditLog({
      tenant_id: tenantId,
      event_type: eventType,
      severity,
      from,
      to,
      query,
      page: isNaN(page) ? 1 : page,
      per_page: isNaN(perPage) ? 50 : perPage,
    });

    res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[scout:audit] Search failed:', msg);
    res.status(500).json({ error: 'Audit search failed' });
  }
});

// GET /api/audit/export
// Query params: from, to, format (csv|json|pdf)
// Delegates CSV/JSON to the existing export infrastructure, adds PDF option.
auditSearchRouter.get('/export', async (req: Request, res: Response): Promise<void> => {
  try {
    const format = String(req.query.format ?? 'json');

    if (format === 'pdf') {
      // Redirect to the export endpoint with pdf format
      // The export module handles the format parameter
      const url = new URL('/api/export/events', `http://${req.hostname}`);
      if (req.query.from) url.searchParams.set('since', String(req.query.from));
      if (req.query.to) url.searchParams.set('until', String(req.query.to));
      url.searchParams.set('format', 'pdf');

      // For PDF we generate inline rather than redirecting
      const { exportAuditPdf } = await import('../audit/audit-search.js');
      const result = await searchAuditLog({
        from: typeof req.query.from === 'string' ? req.query.from : undefined,
        to: typeof req.query.to === 'string' ? req.query.to : undefined,
        per_page: 10_000,
      });

      const pdfBuffer = await exportAuditPdf(result.events);
      const dateStr = new Date().toISOString().slice(0, 10);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="audit-export-${dateStr}.pdf"`,
      );
      res.send(pdfBuffer);
      return;
    }

    // CSV/JSON: delegate to audit search then serialize
    const result = await searchAuditLog({
      from: typeof req.query.from === 'string' ? req.query.from : undefined,
      to: typeof req.query.to === 'string' ? req.query.to : undefined,
      per_page: 50_000,
    });

    const dateStr = new Date().toISOString().slice(0, 10);

    if (format === 'csv') {
      const headers =
        'id,tenant_id,event_type,action,severity,session_id,ip_address,admin_email,timestamp';
      const rows = result.events.map((e) =>
        [
          e.id,
          e.tenant_id,
          e.event_type,
          `"${String(e.action).replace(/"/g, '""')}"`,
          e.severity,
          e.session_id ?? '',
          e.ip_address ?? '',
          e.admin_email ?? '',
          e.timestamp,
        ].join(','),
      );
      const body = [headers, ...rows].join('\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="audit-export-${dateStr}.csv"`,
      );
      res.send(body);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="audit-export-${dateStr}.json"`,
      );
      res.json({
        exported_at: new Date().toISOString(),
        count: result.events.length,
        events: result.events,
      });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[scout:audit] Export failed:', msg);
    res.status(500).json({ error: 'Audit export failed' });
  }
});
