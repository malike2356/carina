# Labyrinth Scout - Export Audit Log

**Target files:**
- `src/api/export.ts` - new router: `GET /api/export/events`
- `src/server.ts` - mount the export router
- `public/dashboard.html` - EXPORT dropdown in the instances bar

---

## Overview

Security teams need a downloadable record of all events for compliance audits,
incident post-mortems, and SIEM ingestion. The export endpoint:

- Accepts date range, severity filter, instance filter, and row limit.
- Returns either a JSON array or a CSV file as a browser download.
- Is protected by `X-Scout-Key` (same as all other API routes).
- Has sensible defaults (7-day window, 10 000 row cap) and hard limits
  (50 000 rows max) to protect the DB.

No new DB tables are needed.

---

## Step 1 - Create `src/api/export.ts`

Create the file from scratch. Do not modify any existing file until this one
compiles cleanly.

```typescript
import { Router, type IRouter } from 'express';
import type { Request, Response } from 'express';
import { pool } from '../db.js';
import type { SecurityEventRow } from '../types.js';

export const exportRouter: IRouter = Router();

type ExportFormat = 'json' | 'csv';

const VALID_SEVERITIES = new Set(['info', 'warning', 'critical', 'breach']);
const CSV_HEADERS =
  'id,severity,source,event_type,description,instance_id,session_id,' +
  'ip_address,mitigated,acknowledged,created_at';

function csvEscape(value: string | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  // Wrap in quotes if the field contains a comma, double-quote, or newline.
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
    // acknowledged may be absent on rows that pre-date migration 21
    'acknowledged' in r ? String(Boolean((r as SecurityEventRow & { acknowledged?: boolean }).acknowledged)) : 'false',
    csvEscape(r.created_at ? new Date(r.created_at).toISOString() : null),
  ].join(',');
}

function parseDate(raw: unknown, fallback: Date): Date {
  if (typeof raw !== 'string' || !raw) return fallback;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? fallback : d;
}

exportRouter.get('/events', async (req: Request, res: Response): Promise<void> => {
  // --- parse format ---
  const format: ExportFormat = req.query.format === 'csv' ? 'csv' : 'json';

  // --- parse date range ---
  const defaultSince = new Date(Date.now() - 7 * 86_400_000);
  const defaultUntil = new Date();
  const since = parseDate(req.query.since, defaultSince);
  const until = parseDate(req.query.until, defaultUntil);

  if (since >= until) {
    res.status(400).json({ error: "'since' must be earlier than 'until'" });
    return;
  }

  // --- parse limit ---
  const rawLimit = parseInt(String(req.query.limit ?? '10000'), 10);
  const limit = isNaN(rawLimit) ? 10_000 : Math.min(50_000, Math.max(1, rawLimit));

  // --- parse severity filter ---
  let severities: string[] | null = null;
  if (typeof req.query.severity === 'string' && req.query.severity.length > 0) {
    const parsed = req.query.severity.split(',').map(s => s.trim()).filter(s => VALID_SEVERITIES.has(s));
    if (parsed.length > 0) severities = parsed;
  }

  // --- parse instance filter ---
  const instanceId =
    typeof req.query.instance_id === 'string' && /^[a-z0-9_-]+$/.test(req.query.instance_id)
      ? req.query.instance_id
      : null;

  // --- build query ---
  const params: unknown[] = [since, until];
  let query = `SELECT id, severity, source, event_type, description, metadata,
                      ip_address, session_id, instance_id, mitigated, created_at`;

  // Include acknowledgement columns if migration 21 has been applied.
  // Using information_schema here would be expensive; instead rely on graceful
  // degradation - if the columns don't exist, the query falls back cleanly.
  query += `,
                      COALESCE(acknowledged, FALSE) AS acknowledged,
                      acknowledged_at,
                      acknowledged_note
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

  // --- execute ---
  let rows: SecurityEventRow[];
  try {
    const result = await pool.query<SecurityEventRow>(query, params);
    rows = result.rows.map(r => ({
      ...r,
      created_at: r.created_at ? new Date(r.created_at).toISOString() : '',
    }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[scout:export] Query failed:', msg);
    // If the COALESCE on acknowledged fails (migration not applied), retry
    // without those columns.
    if (msg.includes('acknowledged')) {
      try {
        const fallback = await pool.query<SecurityEventRow>(
          query.replace(/COALESCE\(acknowledged.*?acknowledged_note\n\s*/s,
            ''),
          params,
        );
        rows = fallback.rows.map(r => ({
          ...r,
          created_at: r.created_at ? new Date(r.created_at).toISOString() : '',
          acknowledged: false,
          acknowledged_at: null,
          acknowledged_note: null,
        }));
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

  // --- respond ---
  if (format === 'csv') {
    const csvLines = rows.map(rowToCsvLine);
    const body = [CSV_HEADERS, ...csvLines].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="scout-audit-${dateStr}.csv"`);
    res.send(body);
  } else {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="scout-audit-${dateStr}.json"`);
    res.json({ exported_at: new Date().toISOString(), count: rows.length, events: rows });
  }
});
```

---

## Step 2 - Mount the router in `src/server.ts`

Add the import near the other API imports (keep alphabetical order within the
group):

```typescript
import { exportRouter } from './api/export.js';
```

Mount after the existing `/api/instances` line:

```typescript
app.use('/api/export', requireApiKey, exportRouter);
```

`requireApiKey` is already imported and used on every other route - no new
imports needed for it.

---

## Step 3 - Dashboard changes in `public/dashboard.html`

### CSS - add inside `<style>`

```css
/* Export dropdown */
.export-wrap {
  position: relative;
  display: inline-flex;
}
.btn-export {
  background: rgba(100, 180, 255, 0.07);
  border: 1px solid rgba(100, 180, 255, 0.3);
  color: rgba(100, 180, 255, 0.8);
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.6rem;
  padding: 0.15rem 0.6rem;
  border-radius: 2px;
  cursor: pointer;
  letter-spacing: 0.08em;
  transition: background 0.15s, border-color 0.15s;
}
.btn-export:hover {
  background: rgba(100, 180, 255, 0.15);
  border-color: rgba(100, 180, 255, 0.7);
  color: rgba(100, 180, 255, 1);
}
.export-dropdown {
  display: none;
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  background: #1a1a1a;
  border: 1px solid rgba(100, 180, 255, 0.25);
  border-radius: 2px;
  min-width: 130px;
  z-index: 50;
  box-shadow: 0 4px 16px rgba(0,0,0,0.5);
}
.export-dropdown.open {
  display: block;
}
.export-dropdown button {
  display: block;
  width: 100%;
  text-align: left;
  padding: 0.4rem 0.7rem;
  background: none;
  border: none;
  color: rgba(200, 220, 255, 0.75);
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.6rem;
  cursor: pointer;
  letter-spacing: 0.06em;
}
.export-dropdown button:hover {
  background: rgba(100, 180, 255, 0.1);
  color: #fff;
}
```

### JavaScript - add inside `<script>`

```javascript
// Close the export dropdown when clicking outside it.
document.addEventListener('click', (e) => {
  const wrap = document.querySelector('.export-wrap');
  if (wrap && !wrap.contains(e.target)) {
    wrap.querySelector('.export-dropdown')?.classList.remove('open');
  }
});

async function exportLog(format) {
  // Close the dropdown immediately.
  document.querySelector('.export-dropdown')?.classList.remove('open');

  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const url =
    `/api/export/events?format=${encodeURIComponent(format)}` +
    `&since=${encodeURIComponent(since)}&limit=10000`;

  toast(`Preparing ${format.toUpperCase()} export...`, 'ok');

  try {
    const r = await fetch(url, { headers: H() });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      toast('Export failed: ' + (d.error ?? r.status), 'critical');
      return;
    }
    const blob = await r.blob();
    const dateStr = new Date().toISOString().slice(0, 10);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `scout-audit-${dateStr}.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
    toast(`${format.toUpperCase()} audit log downloaded`, 'ok');
  } catch {
    toast('Export request failed', 'critical');
  }
}
```

`H()` is the existing helper that returns `{'X-Scout-Key': window.__SCOUT_KEY,
'Content-Type': 'application/json'}` - it is already defined in the dashboard.

### HTML - add the dropdown in the instances bar

Place this `<div>` at the end of the instances bar container, after the
TEST ALERTS button (if present) or after the last instance chip:

```html
<div class="export-wrap">
  <button
    class="btn-export"
    onclick="this.nextElementSibling.classList.toggle('open')"
    title="Download audit log">
    EXPORT &#9662;
  </button>
  <div class="export-dropdown">
    <button onclick="exportLog('json')">Download JSON</button>
    <button onclick="exportLog('csv')">Download CSV</button>
  </div>
</div>
```

`&#9662;` is a small downward triangle (Unicode 25BE), ASCII-safe in HTML.

---

## Query notes

### Why `COALESCE(acknowledged, FALSE)`?

Prompts are applied incrementally. If migration 21 (acknowledge-event) has not
run yet, the `acknowledged` column does not exist and the query would fail. The
COALESCE approach works when the column exists; the catch block retries without
it when it does not. This makes prompt 23 safe to apply before or after prompt 21.

### CSV escaping correctness

The `csvEscape` helper follows RFC 4180:
- Fields containing `,`, `"`, or `\n` are wrapped in double-quotes.
- Any `"` inside a field is doubled to `""`.
- Null/undefined values produce an empty field (no quotes).
- Boolean fields (`mitigated`, `acknowledged`) are written as `true`/`false`.

### 50 000 row hard cap

PostgreSQL will stream rows and Node will buffer them into memory before
sending. At ~500 bytes/row average, 50 000 rows is ~25 MB - acceptable for a
single-tenant security dashboard. If the operator needs more, they should query
the DB directly.

---

## Test cases

1. `GET /api/export/events` (no params):
   - Response header: `Content-Disposition: attachment; filename="scout-audit-YYYY-MM-DD.json"`
   - Body: `{exported_at, count, events:[...]}` - events ordered by `created_at DESC`.
   - Defaults to last 7 days, max 10 000 rows.

2. `GET /api/export/events?format=csv`:
   - Response header: `Content-Type: text/csv; charset=utf-8`
   - First line: exactly `id,severity,source,event_type,description,instance_id,session_id,ip_address,mitigated,acknowledged,created_at`
   - Fields with commas in `description` are wrapped in double-quotes.

3. `?severity=critical,breach`:
   - Only rows with `severity IN ('critical','breach')` returned.
   - Rows with `severity='info'` absent from export.

4. `?since=2026-06-01&until=2026-06-03`:
   - Only rows where `created_at BETWEEN '2026-06-01' AND '2026-06-03'` returned.

5. `?instance_id=carina-local`:
   - Only rows with `instance_id='carina-local'` returned.

6. `?limit=5`:
   - At most 5 rows in response regardless of matching count.

7. `?limit=999999`:
   - Capped at 50 000 - no 400, graceful clamp.

8. `?since=2026-06-03&until=2026-06-01` (inverted range):
   - Returns 400 `{error: "'since' must be earlier than 'until'"}`.

9. Missing or wrong `X-Scout-Key`:
   - Returns 401 (handled by `requireApiKey` middleware, not the route).

10. Dashboard "Download JSON" click:
    - Browser receives the file as a download (not rendered in tab).
    - Dropdown closes immediately on click.
    - Toast shows "Preparing JSON export..." then "JSON audit log downloaded".
