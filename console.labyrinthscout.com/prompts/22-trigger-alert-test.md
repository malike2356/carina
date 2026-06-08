# Labyrinth Scout - Trigger Alert Test

**Target files:**
- `src/api/admin.ts` - add `POST /alert-test` route
- `src/types.ts` - extend `SecurityEventRow` with `acknowledged` fields (if
  prompt 21 has not been applied yet, add the same three fields described there)
- `public/dashboard.html` - "TEST ALERTS" button in the instances bar

---

## Overview

Operators need a one-click way to verify that alert channels (Telegram, email,
Slack) are working without waiting for a real security incident. The test route:

1. Builds a synthetic `SecurityEventRow` with `event_type: 'alert_test'`.
2. Inserts it to `security_events` so it appears in history and the SSE stream.
3. Calls `alertDispatcher.dispatch()` directly, bypassing the dedup check, so
   the test always fires even if a previous test was suppressed.
4. Broadcasts via the existing SSE mechanism so the dashboard row appears
   immediately.
5. Returns `{ok, event_id, channels_notified}`.

---

## Step 1 - Add `POST /alert-test` to `src/api/admin.ts`

Replace the existing `src/api/admin.ts` contents with the version below.  The
`/recompute-baselines` route is preserved unchanged; the new route is appended.

```typescript
import { Router, type IRouter } from 'express';
import type { Request, Response } from 'express';
import { pool } from '../db.js';
import { getRedis } from '../redis.js';
import { baselineLearner } from '../security/anomaly-detector.js';
import { alertDispatcher, toSecurityEvent } from '../alerts/dispatcher.js';
import { broadcastEvent } from './sse.js';
import type { SecurityEventRow, Severity } from '../types.js';

export const adminRouter: IRouter = Router();

const VALID_SEVERITIES: Severity[] = ['info', 'warning', 'critical', 'breach'];

// ---- existing route (unchanged) ----

adminRouter.post('/recompute-baselines', async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query<{ instance_id: string }>(
      `SELECT DISTINCT instance_id FROM security_events
       WHERE instance_id IS NOT NULL
         AND created_at > NOW() - INTERVAL '7 days'`,
    );
    for (const row of result.rows) {
      if (row.instance_id) {
        await baselineLearner.computeBaselines(row.instance_id);
      }
    }
    res.json({ ok: true, instances: result.rows.length });
  } catch (err) {
    console.error('[Admin] recompute-baselines error:', err);
    res.status(500).json({ error: 'Baseline recomputation failed' });
  }
});

// ---- new route ----

adminRouter.post('/alert-test', async (req: Request, res: Response): Promise<void> => {
  const rawSeverity = req.body?.severity;
  const severity: Severity = VALID_SEVERITIES.includes(rawSeverity) ? rawSeverity : 'critical';

  const rawInstanceId = req.body?.instance_id;
  const instanceId: string =
    typeof rawInstanceId === 'string' && /^[a-z0-9_-]+$/.test(rawInstanceId)
      ? rawInstanceId
      : 'test';

  const firedAt = new Date().toISOString();
  const id = crypto.randomUUID();

  // 1. Insert the synthetic event so it appears in event history and SSE stream.
  let inserted: SecurityEventRow;
  try {
    const result = await pool.query<SecurityEventRow>(
      `INSERT INTO security_events
         (id, severity, source, event_type, description, metadata,
          ip_address, session_id, instance_id, mitigated)
       VALUES ($1, $2, 'labyrinth', 'alert_test', $3, $4, NULL, NULL, $5, FALSE)
       RETURNING *`,
      [
        id,
        severity,
        `Alert test fired by operator at ${firedAt}`,
        JSON.stringify({ test: true, fired_at: firedAt }),
        instanceId,
      ],
    );
    if (!result.rows[0]) {
      res.status(500).json({ error: 'DB insert returned no row' });
      return;
    }
    inserted = {
      ...result.rows[0],
      metadata: result.rows[0].metadata as Record<string, unknown>,
      created_at: new Date(result.rows[0].created_at).toISOString(),
      acknowledged: false,
      acknowledged_at: null,
      acknowledged_note: null,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Admin] alert-test insert failed:', msg);
    res.status(500).json({ error: 'Database error' });
    return;
  }

  // 2. Publish to Redis so SSE subscriber picks it up (normal broadcast path).
  const redis = getRedis();
  if (redis) {
    try {
      await redis.publish('scout:events', JSON.stringify(inserted));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[Admin] alert-test Redis publish failed (non-fatal):', msg);
    }
  }

  // 3. Also broadcast directly to SSE clients in case Redis is unavailable.
  broadcastEvent(inserted);

  // 4. Count enabled channels so we can report back.
  let channelsNotified = 0;
  try {
    const chResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM alert_channels WHERE enabled = true`,
    );
    channelsNotified = parseInt(chResult.rows[0]?.count ?? '0', 10);
  } catch {
    // Non-fatal - we still fire the alert.
  }

  // 5. Dispatch to real alert channels.
  //    Bypass dedup: test events use a unique event_type ('alert_test') but we
  //    also delete any existing dedup key so successive tests are never blocked.
  if (redis) {
    try {
      await redis.del(`scout:alert-dedup:${instanceId}:alert_test`);
    } catch {
      // Non-fatal.
    }
  }

  try {
    await alertDispatcher.dispatch(toSecurityEvent(inserted));
    console.info(
      `[Admin] Alert test dispatched: severity=${severity} instance=${instanceId} id=${id}`,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Admin] Alert test dispatch failed:', msg);
    // Still return success - the event is in the DB and SSE stream.
  }

  res.json({ ok: true, event_id: id, channels_notified: channelsNotified });
});
```

### Why bypass dedup here but not in the normal path?

The dedup window is 5 minutes and tracks `{instance_id}:{event_type}`.
`alert_test` would be silently swallowed after the first test in any 5-minute
window. We delete the key before dispatching so every button press gets through,
giving operators accurate channel verification.

---

## Step 2 - Dashboard changes in `public/dashboard.html`

### CSS - add inside `<style>`

```css
/* Test-alert button */
.btn-test-alert {
  background: rgba(212, 175, 55, 0.08);
  border: 1px solid rgba(212, 175, 55, 0.35);
  color: #d4af37;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.6rem;
  padding: 0.15rem 0.6rem;
  border-radius: 2px;
  cursor: pointer;
  letter-spacing: 0.08em;
  transition: background 0.15s, border-color 0.15s;
}
.btn-test-alert:hover {
  background: rgba(212, 175, 55, 0.18);
  border-color: #d4af37;
}
.btn-test-alert:disabled {
  opacity: 0.4;
  cursor: default;
}
```

### JavaScript - add inside `<script>`

```javascript
async function triggerAlertTest() {
  const SEVERITIES = ['info', 'warning', 'critical', 'breach'];
  const severity = window.prompt('Test alert severity (info / warning / critical / breach):', 'critical');
  if (!severity || !SEVERITIES.includes(severity.trim().toLowerCase())) {
    toast('Invalid severity - cancelled', 'warning');
    return;
  }

  const btn = document.getElementById('btn-test-alert');
  if (btn) btn.disabled = true;

  try {
    const r = await fetch('/api/admin/alert-test', {
      method: 'POST',
      headers: H(),
      body: JSON.stringify({ severity: severity.trim().toLowerCase(), instance_id: 'carina-local' }),
    });
    const d = await r.json();
    if (d.ok) {
      toast(`Test alert sent to ${d.channels_notified} channel(s)`, 'ok');
    } else {
      toast('Alert test failed: ' + (d.error ?? 'unknown error'), 'critical');
    }
  } catch {
    toast('Alert test request failed', 'critical');
  } finally {
    if (btn) btn.disabled = false;
  }
}
```

### HTML - add button in the instances bar

Find the instances bar element (the `<div>` that wraps instance chips/badges,
typically rendered by the `updateInstances` function or similar). Append the
button at the end of that container, before its closing tag:

```html
<button
  id="btn-test-alert"
  class="btn-test-alert"
  onclick="triggerAlertTest()"
  title="Fire a test alert to all configured channels to verify delivery">
  TEST ALERTS
</button>
```

The button sits inline with instance chips so it is always visible without
scrolling.

### Optional: mark test events in the stream

In `appendEvent`, add a `[TEST]` badge when `event.event_type === 'alert_test'`:

```javascript
if (event.event_type === 'alert_test') {
  const badge = document.createElement('span');
  badge.textContent = '[TEST]';
  badge.style.cssText =
    'font-size:0.55rem;color:#d4af37;border:1px solid rgba(212,175,55,0.4);' +
    'padding:0 0.3rem;border-radius:2px;margin-left:0.3rem;flex-shrink:0;';
  // Insert after the severity badge element.
  severityBadgeElement.after(badge);
}
```

---

## Test cases

1. `POST /api/admin/alert-test` with `{"severity":"critical"}`:
   - Returns `{ok:true, event_id:"<uuid>", channels_notified: N}` where N matches
     `SELECT COUNT(*) FROM alert_channels WHERE enabled=true`.
   - Row appears in `security_events` with `event_type='alert_test'`, `severity='critical'`.
   - Telegram (or whichever channels are configured) receives the message within
     the adapter's timeout window.

2. `POST /api/admin/alert-test` with `{"severity":"breach"}`:
   - Highest-priority dispatch fires all channels whose `severity_threshold` is
     `'info'`, `'warning'`, `'critical'`, or `'breach'`.

3. Two calls within 5 seconds:
   - Both succeed and both dispatch (dedup key is deleted before each dispatch).

4. `POST` with invalid `severity` (e.g. `"ultra"`):
   - Falls back to `'critical'` (no 400 - graceful default, matches the spec).

5. Dashboard: clicking "TEST ALERTS", entering `"warning"`, confirms toast shows
   correct channel count, and a row with `[TEST]` badge appears in the stream.

6. If Redis is unavailable, the route still inserts the event, broadcasts via
   direct SSE, and dispatches alerts - no 500 returned.
