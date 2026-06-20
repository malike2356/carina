import { Router, type IRouter } from 'express';
import type { Request, Response } from 'express';
import { pool } from '../db.js';
import type { SecurityEventRow } from '../types.js';

export const exportRouter: IRouter = Router();

type ExportFormat = 'json' | 'csv' | 'pdf';

const VALID_SEVERITIES = new Set(['info', 'warning', 'critical', 'breach']);
const CSV_HEADERS =
  'id,severity,source,event_type,description,instance_id,session_id,' +
  'ip_address,mitigated,acknowledged,created_at';

function csvEscape(value: string | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function rowToCsvLine(r: SecurityEventRow): string {
  return [
    csvEscape(r.id),
    csvEscape(r.severity),
    csvEscape(r.source),
    csvEscape(r.event_type),
    csvEscape(r.description),
    csvEscape(r.instance_id),
    csvEscape(r.session_id),
    csvEscape(r.ip_address),
    r.mitigated ? 'true' : 'false',
    String(Boolean(r.acknowledged)),
    csvEscape(r.created_at ? new Date(r.created_at).toISOString() : null),
  ].join(',');
}

function parseDate(raw: unknown, fallback: Date): Date {
  if (typeof raw !== 'string' || !raw) return fallback;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? fallback : d;
}

function normalizeRows(rows: SecurityEventRow[], withAck: boolean): SecurityEventRow[] {
  return rows.map((r) => ({
    ...r,
    created_at: r.created_at ? new Date(r.created_at).toISOString() : '',
    acknowledged: withAck ? Boolean(r.acknowledged) : false,
    acknowledged_at: withAck ? (r.acknowledged_at ?? null) : null,
    acknowledged_note: withAck ? (r.acknowledged_note ?? null) : null,
  }));
}

function buildSelect(withAck: boolean): string {
  const base = `SELECT id, severity, source, event_type, description, metadata,
                      ip_address, session_id, instance_id, mitigated, created_at`;
  if (!withAck) return base;
  return `${base},
                      COALESCE(acknowledged, FALSE) AS acknowledged,
                      acknowledged_at,
                      acknowledged_note`;
}

async function runExportQuery(
  withAck: boolean,
  since: Date,
  until: Date,
  limit: number,
  severities: string[] | null,
  instanceId: string | null,
): Promise<SecurityEventRow[]> {
  const params: unknown[] = [since, until];
  let query = `${buildSelect(withAck)}
               FROM security_events
               WHERE created_at >= $1
                 AND created_at <= $2`;

  if (severities) {
    params.push(severities);
    query += ` AND severity = ANY($${params.length})`;
  }
  if (instanceId) {
    params.push(instanceId);
    query += ` AND instance_id = $${params.length}`;
  }

  params.push(limit);
  query += ` ORDER BY created_at DESC LIMIT $${params.length}`;

  const result = await pool.query<SecurityEventRow>(query, params);
  return normalizeRows(result.rows, withAck);
}

function generatePdf(rows: SecurityEventRow[], dateStr: string): Buffer {
  const lines: string[] = [];

  lines.push('%PDF-1.4');
  lines.push('1 0 obj');
  lines.push('<< /Type /Catalog /Pages 2 0 R >>');
  lines.push('endobj');
  lines.push('2 0 obj');
  lines.push('<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  lines.push('endobj');

  const contentLines: string[] = [];
  contentLines.push('BT');
  contentLines.push('/F1 10 Tf');
  contentLines.push('72 750 Td');
  contentLines.push(`(Scout Security Events Export - ${dateStr}) Tj`);
  contentLines.push('0 -20 Td');
  contentLines.push('/F1 8 Tf');
  contentLines.push('(ID | Severity | Source | Event Type | Description | Created) Tj');
  contentLines.push('0 -14 Td');

  for (const r of rows.slice(0, 50)) {
    const ts = String(r.created_at ?? '').slice(0, 19).replace('T', ' ');
    const desc = String(r.description ?? '').slice(0, 30).replace(/[()]/g, '');
    const line = `${String(r.id).slice(0, 8)} | ${r.severity} | ${String(r.source).slice(0, 12)} | ${String(r.event_type).slice(0, 16)} | ${desc} | ${ts}`;
    contentLines.push(`(${line}) Tj`);
    contentLines.push('0 -12 Td');
  }

  if (rows.length > 50) {
    contentLines.push(`(... and ${rows.length - 50} more rows) Tj`);
  }

  contentLines.push('ET');
  const contentStream = contentLines.join('\n');

  lines.push('3 0 obj');
  lines.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792]');
  lines.push('   /Contents 4 0 R');
  lines.push('   /Resources << /Font << /F1 5 0 R >> >>');
  lines.push('>>');
  lines.push('endobj');
  lines.push('4 0 obj');
  lines.push(`<< /Length ${contentStream.length} >>`);
  lines.push('stream');
  lines.push(contentStream);
  lines.push('endstream');
  lines.push('endobj');
  lines.push('5 0 obj');
  lines.push('<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>');
  lines.push('endobj');

  const xrefOffset = lines.join('\n').length + 1;
  lines.push('xref');
  lines.push('0 6');
  lines.push('0000000000 65535 f ');
  lines.push('0000000009 00000 n ');
  lines.push('0000000062 00000 n ');
  lines.push('0000000118 00000 n ');
  lines.push('0000000262 00000 n ');
  lines.push('0000000345 00000 n ');
  lines.push('trailer');
  lines.push('<< /Size 6 /Root 1 0 R >>');
  lines.push('startxref');
  lines.push(String(xrefOffset));
  lines.push('%%EOF');

  return Buffer.from(lines.join('\n'), 'ascii');
}

exportRouter.get('/events', async (req: Request, res: Response): Promise<void> => {
  const rawFormat = String(req.query.format ?? 'json');
  const format: ExportFormat =
    rawFormat === 'csv' ? 'csv' : rawFormat === 'pdf' ? 'pdf' : 'json';

  const defaultSince = new Date(Date.now() - 7 * 86_400_000);
  const defaultUntil = new Date();
  const since = parseDate(req.query.since, defaultSince);
  const until = parseDate(req.query.until, defaultUntil);

  if (since >= until) {
    res.status(400).json({ error: "'since' must be earlier than 'until'" });
    return;
  }

  const rawLimit = parseInt(String(req.query.limit ?? '10000'), 10);
  const limit = isNaN(rawLimit) ? 10_000 : Math.min(50_000, Math.max(1, rawLimit));

  let severities: string[] | null = null;
  if (typeof req.query.severity === 'string' && req.query.severity.length > 0) {
    const parsed = req.query.severity.split(',').map((s) => s.trim()).filter((s) => VALID_SEVERITIES.has(s));
    if (parsed.length > 0) severities = parsed;
  }

  const instanceId =
    typeof req.query.instance_id === 'string' && /^[a-z0-9_-]+$/.test(req.query.instance_id)
      ? req.query.instance_id
      : null;

  let rows: SecurityEventRow[];
  try {
    rows = await runExportQuery(true, since, until, limit, severities, instanceId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[scout:export] Query failed:', msg);
    if (msg.includes('acknowledged')) {
      try {
        rows = await runExportQuery(false, since, until, limit, severities, instanceId);
      } catch (fallbackErr) {
        const fbMsg = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
        console.error('[scout:export] Fallback query failed:', fbMsg);
        res.status(500).json({ error: 'Database error' });
        return;
      }
    } else {
      res.status(500).json({ error: 'Database error' });
      return;
    }
  }

  const dateStr = new Date().toISOString().slice(0, 10);

  if (format === 'csv') {
    const csvLines = rows.map(rowToCsvLine);
    const body = [CSV_HEADERS, ...csvLines].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="scout-audit-${dateStr}.csv"`);
    res.send(body);
  } else if (format === 'pdf') {
    const pdfBuffer = generatePdf(rows, dateStr);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="scout-audit-${dateStr}.pdf"`);
    res.send(pdfBuffer);
  } else {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="scout-audit-${dateStr}.json"`);
    res.json({ exported_at: new Date().toISOString(), count: rows.length, events: rows });
  }
});
