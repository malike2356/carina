# Labyrinth Scout - Acknowledge Event

**Target files:**
- `src/migrations.ts` - add acknowledgement columns
- `src/api/events.ts` - add `POST /:id/acknowledge` and `GET /:id` routes
- `src/types.ts` - extend `SecurityEventRow`
- `public/dashboard.html` - ack button, acknowledged styling, hide-filter

---

## Overview

Operators need to mark a security event as reviewed. Acknowledging an event:
1. Writes `acknowledged=true` plus timestamp and optional note to the DB row.
2. Deletes the Redis dedup key so the next real occurrence of the same
   `event_type` from the same `instance_id` fires a fresh alert rather than
   being suppressed by a stale counter.
3. Visually fades the row in the dashboard and hides the ack button.

---

## Step 1 - Extend `SecurityEventRow` in `src/types.ts`

Add three optional fields at the end of the interface (they are absent from
older rows that pre-date the migration):

```typescript
export interface SecurityEventRow {
  id: string;
  severity: Severity;
  source: string;
  event_type: string;
  description: string;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  session_id: string | null;
  instance_id: string | null;
  mitigated: boolean;
  created_at: string;
  // added by migration 21
  acknowledged: boolean;
  acknowledged_at: string | null;
  acknowledged_note: string | null;
}
```

---

## Step 2 - Add migration in `src/migrations.ts`

Append three `ALTER TABLE` statements at the end of `runMigrations`, before the
final `console.log`. Use `ADD COLUMN IF NOT EXISTS` so the migration is safe to
re-run:

```typescript
await client.query(`
  ALTER TABLE security_events
    ADD COLUMN IF NOT EXISTS acknowledged      BOOLEAN     DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS acknowledged_at  TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS acknowledged_note TEXT
`);

await client.query(`
  CREATE INDEX IF NOT EXISTS idx_security_events_acknowledged
    ON security_events (acknowledged)
    WHERE acknowledged = FALSE
`);
```

The partial index keeps unacknowledged-event queries fast without indexing
rows that are no longer actionable.

---

## Step 3 - Add routes to `src/api/events.ts`

Add the two new routes after the existing `eventsRouter.post('/')` block.
Do not touch the existing `GET /` or `POST /` handlers.

### `GET /:id` - fetch single event

```typescript
eventsRouter.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  // Basic UUID format guard - prevents obviously bad queries hitting the DB.
  if (!/^[0-9a-f-]{36}$/.test(id)) {
    res.status(400).json({ error: 'Invalid event id' });
    return;
  }
  try {
    const result = await pool.query<SecurityEventRow>(
      `SELECT id, severity, source, event_type, description, metadata,
              ip_address, session_id, instance_id, mitigated, created_at,
              acknowledged, acknowledged_at, acknowledged_note
       FROM security_events
       WHERE id = $1`,
      [id],
    );
    if (!result.rows[0]) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }
    res.json({ event: serializeRow(result.rows[0]) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[scout:events] GET /:id failed:', msg);
    res.status(500).json({ error: 'Database error' });
  }
});
```

### `POST /:id/acknowledge` - mark event as acknowledged

```typescript
eventsRouter.post('/:id/acknowledge', async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) {
    res.status(400).json({ error: 'Invalid event id' });
    return;
  }

  const note =
    typeof req.body?.note === 'string' ? req.body.note.trim().slice(0, 500) : null;

  try {
    const result = await pool.query<Pick<SecurityEventRow, 'id' | 'instance_id' | 'event_type' | 'acknowledged_at'>>(
      `UPDATE security_events
       SET acknowledged      = TRUE,
           acknowledged_at   = NOW(),
           acknowledged_note = $2
       WHERE id = $1
         AND acknowledged = FALSE
       RETURNING id, instance_id, event_type, acknowledged_at`,
      [id, note],
    );

    if (!result.rows[0]) {
      // Either not found or already acknowledged - treat both as idempotent success.
      const existing = await pool.query<Pick<SecurityEventRow, 'id' | 'acknowledged' | 'acknowledged_at'>>(
        `SELECT id, acknowledged, acknowledged_at FROM security_events WHERE id = $1`,
        [id],
      );
      if (!existing.rows[0]) {
        res.status(404).json({ error: 'Event not found' });
        return;
      }
      res.json({ ok: true, id, acknowledged_at: existing.rows[0].acknowledged_at, already: true });
      return;
    }

    const row = result.rows[0];

    // Delete the dedup key so the next occurrence fires a fresh alert.
    const redis = getRedis();
    if (redis && row.instance_id && row.event_type) {
      const dedupKey = `scout:alert-dedup:${row.instance_id}:${row.event_type}`;
      try {
        await redis.del(dedupKey);
        console.info(`[scout:events] Dedup key cleared after ack: ${dedupKey}`);
      } catch (redisErr) {
        const msg = redisErr instanceof Error ? redisErr.message : String(redisErr);
        console.warn('[scout:events] Redis DEL failed (non-fatal):', msg);
      }
    }

    res.json({ ok: true, id: row.id, acknowledged_at: row.acknowledged_at });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[scout:events] acknowledge failed:', msg);
    res.status(500).json({ error: 'Database error' });
  }
});
```

No new imports needed - `pool` and `getRedis` are already imported at the top
of `events.ts`.

---

## Step 4 - Update `serializeRow` in `src/api/events.ts`

The existing `serializeRow` function only spreads `SecurityEventRow`. Since the
type now has the three new fields, the spread already carries them - but
`acknowledged_at` needs the same ISO string normalisation as `created_at`.
Update the function:

```typescript
function serializeRow(row: SecurityEventRow): SecurityEventRow {
  return {
    ...row,
    metadata: parseMetadata(row.metadata),
    created_at: new Date(row.created_at).toISOString(),
    acknowledged: row.acknowledged ?? false,
    acknowledged_at: row.acknowledged_at ? new Date(row.acknowledged_at).toISOString() : null,
    acknowledged_note: row.acknowledged_note ?? null,
  };
}
```

Also update the existing `GET /` query to include the new columns:

```sql
SELECT id, severity, source, event_type, description, metadata,
       ip_address, session_id, instance_id, mitigated, created_at,
       acknowledged, acknowledged_at, acknowledged_note
FROM security_events
ORDER BY created_at DESC
LIMIT $1
```

---

## Step 5 - Dashboard changes in `public/dashboard.html`

### CSS additions - add inside the `<style>` block

```css
/* Acknowledge button */
.btn-ack {
  background: transparent;
  border: 1px solid rgba(0, 200, 150, 0.3);
  color: rgba(0, 200, 150, 0.6);
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.65rem;
  padding: 0.1rem 0.4rem;
  border-radius: 2px;
  cursor: pointer;
  flex-shrink: 0;
  transition: border-color 0.15s, color 0.15s;
}
.btn-ack:hover {
  border-color: var(--green);
  color: var(--green);
}
.btn-ack:disabled {
  opacity: 0.3;
  cursor: default;
}

/* Acknowledged row state */
.ev-acknowledged {
  opacity: 0.4;
  transition: opacity 0.3s;
}
.ev-acknowledged .btn-ack {
  display: none;
}

/* Hide-acknowledged filter */
.ack-filter-label {
  font-size: 0.6rem;
  color: var(--dim);
  display: flex;
  align-items: center;
  gap: 0.3rem;
  cursor: pointer;
  user-select: none;
}
.ack-filter-label input[type="checkbox"] {
  accent-color: var(--green);
  cursor: pointer;
}
```

### JavaScript additions - add inside the `<script>` block

Add `makeAckButton` helper and `applyAckFilter` before `appendEvent`:

```javascript
function makeAckButton(eventId) {
  const btn = document.createElement('button');
  btn.className = 'btn-ack';
  btn.textContent = 'ACK';
  btn.title = 'Acknowledge - stops repeat alerts for this event type from this instance';
  btn.onclick = async () => {
    btn.disabled = true;
    try {
      const r = await fetch(`/api/events/${eventId}/acknowledge`, {
        method: 'POST',
        headers: H(),
        body: JSON.stringify({ note: '' }),
      });
      const d = await r.json();
      if (d.ok) {
        btn.closest('.ev-row')?.classList.add('ev-acknowledged');
        toast('Event acknowledged - repeat alerts suppressed', 'ok');
        applyAckFilter();
      } else {
        btn.disabled = false;
        toast('Acknowledge failed', 'warning');
      }
    } catch {
      btn.disabled = false;
      toast('Acknowledge request failed', 'critical');
    }
  };
  return btn;
}

function applyAckFilter() {
  const hide = document.getElementById('hide-ack-check')?.checked ?? false;
  document.querySelectorAll('.ev-row.ev-acknowledged').forEach(row => {
    (row as HTMLElement).style.display = hide ? 'none' : '';
  });
}
```

In `appendEvent`, append the ack button to each row after the row is built:

```javascript
// At the end of appendEvent(), before inserting the row into the DOM:
const ackBtn = makeAckButton(event.id);
row.appendChild(ackBtn);
if (event.acknowledged) {
  row.classList.add('ev-acknowledged');
}
```

### Hide-acknowledged filter toggle

Add this label element next to the stream panel heading (inside `.stream-hdr`
or wherever the "LIVE EVENT STREAM" label lives):

```html
<label class="ack-filter-label">
  <input type="checkbox" id="hide-ack-check" onchange="applyAckFilter()" />
  Hide acknowledged
</label>
```

---

## Test cases

1. `POST /api/events/{valid-uuid}/acknowledge` with `{"note":"checked"}`:
   - Response: `{ok:true, id, acknowledged_at}` (ISO string)
   - DB row: `acknowledged=true`, `acknowledged_at` set, `acknowledged_note='checked'`
   - Redis: `scout:alert-dedup:{instance_id}:{event_type}` key no longer exists

2. Repeat the same `POST` on an already-acknowledged event:
   - Returns `{ok:true, already:true}` without error (idempotent)

3. `POST` with non-UUID id (e.g. `abc`):
   - Returns 400 `{error:'Invalid event id'}`

4. `GET /api/events/{valid-uuid}`:
   - Returns `{event: {..., acknowledged: true, acknowledged_at: '...', acknowledged_note: 'checked'}}`

5. Send a second event with the same `event_type` + `instance_id` after
   acknowledging: Telegram alert fires (dedup key was deleted).

6. Dashboard: row fades after clicking ACK button, ack button disappears.

7. "Hide acknowledged" checkbox hides faded rows client-side without a page reload.

8. `GET /api/events?limit=20` returns `acknowledged`, `acknowledged_at`,
   `acknowledged_note` fields for every row.
