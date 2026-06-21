# Labyrinth Scout - Prompt 24: Add Honeypot (Dashboard Action)

## Context

Labyrinth Scout is a Node.js/TypeScript security control plane that monitors Carina AI agent
instances. Scout runs at port 4444. This prompt adds a DEPLOY HONEYPOT action panel to the
dashboard, wiring it to the existing honeypot backend.

**Project root:** `/opt/lampp/htdocs/VERLOX/Carina-ai/`
**Scout source:** `console.labyrinthscout.com/src/`
**Dashboard:** `console.labyrinthscout.com/public/dashboard.html`
**Stack:** Node.js 22, TypeScript 5, Express 5, PostgreSQL 16, Redis 7 (ioredis). No PHP.

Shared infrastructure: Scout and Carina use the same PostgreSQL database and Redis instance.
The honeypot manager and router already exist. This prompt extends them and adds the UI.

**Files that already exist and must not be recreated:**
- `src/security/honeypot-manager.ts` - `HoneypotManager` class, `honeypotManager` singleton
- `src/api/honeypots.ts` - `honeypotsRouter`, already mounted at `/api/honeypots`
- `src/server.ts` - server with `app.use('/api/honeypots', requireApiKey, honeypotsRouter)`

---

## What to Build

### 1. Fix field names in `src/api/honeypots.ts`

The existing `POST /api/honeypots` handler reads `body.instanceId` and `body.keyType`
(camelCase). The dashboard and spec use `instance_id` and `key_type` (snake_case). Update the
`POST /` handler to accept both forms so it is backwards compatible and dashboard-compatible:

```typescript
const instanceId =
  typeof body.instance_id === 'string' ? body.instance_id.trim() :
  typeof body.instanceId  === 'string' ? body.instanceId.trim() : '';

const rawKeyType = body.key_type ?? body.keyType;
```

Apply the same dual-accept pattern for `key_type`/`keyType`. No other logic changes.

### 2. Add security event emission to `POST /` in `src/api/honeypots.ts`

After a successful `deployApiKeyHoneypot()` or `deployFileHoneypots()` call, insert a
security event into `security_events`. Use the existing `pool` from `src/db.ts`. Import it
at the top of the file alongside the existing imports.

```typescript
import { pool } from '../db.js';
```

After each successful deploy, call:

```typescript
await pool.query(
  `INSERT INTO security_events
     (instance_id, event_type, severity, source, description, metadata)
   VALUES ($1, 'honeypot_deployed', 'info', 'honeypot-api', $2, $3)`,
  [
    instanceId,
    `Honeypot deployed: ${type} for ${instanceId}`,
    JSON.stringify({ type, instanceId, keyType: keyType ?? null }),
  ],
);
```

Wrap in try/catch so a logging failure never fails the deploy response.

For `api_key` deployments also return `value` in the response so the operator can see the
fake key that was deployed. The `serializeHoneypot()` helper already includes `value`, so
the response shape is already correct.

For `file` deployments return all honeypot objects (already an array with `value` = path).

### 3. Add `GET /api/honeypots/summary` to `src/api/honeypots.ts`

Add before the existing `GET /:id` handler so it does not conflict with UUID matching:

```typescript
honeypotsRouter.get('/summary', async (req: Request, res: Response): Promise<void> => {
  const instanceId = typeof req.query.instance_id === 'string' ? req.query.instance_id.trim() : '';
  if (!instanceId) {
    res.status(400).json({ error: 'instance_id query parameter is required' });
    return;
  }

  try {
    const result = await pool.query<{
      total: string;
      triggered: string;
      untriggered: string;
      type: string;
      type_count: string;
    }>(
      `SELECT
         COUNT(*)                                  AS total,
         COUNT(*) FILTER (WHERE triggered = TRUE)  AS triggered,
         COUNT(*) FILTER (WHERE triggered = FALSE) AS untriggered,
         type,
         COUNT(*) FILTER (WHERE TRUE)              AS type_count
       FROM honeypots
       WHERE instance_id = $1
       GROUP BY ROLLUP (type)`,
      [instanceId],
    );

    const summary = { total: 0, triggered: 0, untriggered: 0, by_type: {} as Record<string, number> };
    for (const row of result.rows) {
      if (row.type === null) {
        // ROLLUP grand-total row
        summary.total     = parseInt(row.total, 10);
        summary.triggered = parseInt(row.triggered, 10);
        summary.untriggered = parseInt(row.untriggered, 10);
      } else {
        summary.by_type[row.type] = parseInt(row.type_count, 10);
      }
    }

    res.json(summary);
  } catch (err) {
    console.error('[Honeypots] summary error:', err);
    res.status(500).json({ error: 'Failed to fetch honeypot summary' });
  }
});
```

Note: place this route BEFORE the `honeypotsRouter.get('/:id', ...)` handler.

### 4. Update `public/dashboard.html`

All changes are within `<script>` and the existing HTML body. Do not alter any existing CSS
class names, routes, or state variables.

#### 4a. Add the honeypot modal HTML

Place this block immediately after the existing `<div id="kill-overlay" ...>` modal:

```html
<!-- HONEYPOT MODAL -->
<div id="honeypot-overlay" hidden style="position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:1500;display:flex;align-items:center;justify-content:center">
  <div style="background:#0d1826;border:1px solid #8bc;border-radius:6px;padding:1.5rem 2rem;min-width:340px;font-family:'JetBrains Mono',monospace">
    <h3 style="color:#8bc;font-size:.85rem;margin:0 0 .5rem">DEPLOY HONEYPOT</h3>
    <p style="color:rgba(139,175,192,.7);font-size:.65rem;margin:0 0 1rem;line-height:1.5">
      Deploy a decoy credential or file that alerts when accessed.<br>
      Used to detect credential harvesting by a compromised agent.
    </p>
    <div style="display:flex;flex-direction:column;gap:.45rem;margin-bottom:1rem">
      <button class="btn-honeypot-opt" onclick="deployHoneypot('api_key','openai')">Fake OpenAI Key (sk-lab-...)</button>
      <button class="btn-honeypot-opt" onclick="deployHoneypot('api_key','anthropic')">Fake Anthropic Key (sk-ant-...)</button>
      <button class="btn-honeypot-opt" onclick="deployHoneypot('api_key','deepseek')">Fake DeepSeek Key (sk-...)</button>
      <button class="btn-honeypot-opt" onclick="deployHoneypot('file',null)">Credential Files (/tmp + data/)</button>
    </div>
    <button onclick="closeHoneypotModal()" style="background:none;border:1px solid rgba(139,175,192,.3);color:rgba(139,175,192,.6);border-radius:3px;padding:.3rem .8rem;font-family:'JetBrains Mono',monospace;font-size:.65rem;cursor:pointer">CANCEL</button>
  </div>
</div>
```

Add this CSS rule inside the existing `<style>` block:

```css
.btn-honeypot-opt{background:none;border:1px solid rgba(139,175,192,.4);color:#8bc;border-radius:3px;padding:.35rem .75rem;font-family:'JetBrains Mono',monospace;font-size:.65rem;cursor:pointer;text-align:left}
.btn-honeypot-opt:hover{background:rgba(139,175,192,.08)}
```

#### 4b. Add the honeypot summary indicator and button to the instances bar

In `function updateInstances()`, after the `instances.forEach(...)` block appends chips to
`bar`, append the honeypot summary indicator. Add at the end of `updateInstances()`:

```javascript
// Honeypot summary chip
const hpChip = document.createElement('div');
hpChip.id = 'hp-chip';
hpChip.style.cssText = 'display:flex;align-items:center;gap:.4rem;margin-left:auto;cursor:pointer;padding:0 .4rem';
hpChip.title = 'Deploy or inspect honeypots';
hpChip.onclick = openHoneypotModal;
hpChip.innerHTML = honeypotSummaryHtml();
bar.appendChild(hpChip);
```

#### 4c. Add state and helper functions to the `<script>` block

Add after the existing `let instances = [];` state line:

```javascript
let honeypotSummary = { total: 0, triggered: 0, untriggered: 0, by_type: {} };

function honeypotSummaryHtml() {
  const t = honeypotSummary;
  const trigColor = t.triggered > 0 ? '#e06c75' : 'rgba(139,175,192,.5)';
  return (
    `<span style="color:rgba(139,175,192,.5);font-size:.62rem">[</span>` +
    `<span style="color:rgba(139,175,192,.7);font-size:.62rem">${t.total} pots</span>` +
    (t.triggered > 0
      ? `<span style="color:${trigColor};font-size:.62rem">ALERT ${t.triggered}</span>`
      : `<span style="color:rgba(139,175,192,.35);font-size:.62rem">${t.untriggered} safe</span>`) +
    `<span style="color:rgba(139,175,192,.5);font-size:.62rem">]</span>`
  );
}

async function loadHoneypotSummary() {
  // Use first active instance or fall back to 'carina-local'
  const instId = (instances.find(i => i.status === 'active') || {}).id || 'carina-local';
  const d = await API(`/api/honeypots/summary?instance_id=${encodeURIComponent(instId)}`);
  if (d && typeof d.total === 'number') {
    honeypotSummary = d;
    const chip = document.getElementById('hp-chip');
    if (chip) chip.innerHTML = honeypotSummaryHtml();
  }
}

function openHoneypotModal() {
  document.getElementById('honeypot-overlay').hidden = false;
}
function closeHoneypotModal() {
  document.getElementById('honeypot-overlay').hidden = true;
}

async function deployHoneypot(type, keyType) {
  const instId = (instances.find(i => i.status === 'active') || {}).id || 'carina-local';
  const body = { type, instance_id: instId };
  if (keyType) body.key_type = keyType;

  try {
    const r = await fetch('/api/honeypots', {
      method: 'POST',
      headers: H(),
      body: JSON.stringify(body),
    });
    const d = await r.json();
    if (d.honeypot || d.honeypots) {
      const label = type === 'api_key' ? `${keyType} key` : 'credential files';
      toast(`Honeypot deployed: ${label}`, 'ok');
      closeHoneypotModal();
      await loadHoneypotSummary();
    } else {
      toast('Deploy failed: ' + (d.error || 'unknown'), 'critical');
    }
  } catch {
    toast('Deploy request failed', 'critical');
  }
}
```

#### 4d. Wire the summary poll into the existing refresh cycle

In the main `async function refresh()` (or equivalent polling function that calls `loadStatus`),
add a call to `loadHoneypotSummary()`. It already runs every 30s alongside status. Also add a
dedicated 60s interval at the bottom of the `<script>` block alongside the existing intervals:

```javascript
setInterval(loadHoneypotSummary, 60_000);
```

Call `loadHoneypotSummary()` once on initial load (add to the bottom of the script alongside
the existing initial `loadStatus()` call).

---

## Test Cases

1. `POST /api/honeypots` with `{ type:'api_key', instance_id:'carina-local', key_type:'openai' }`
   - Response: `{ honeypot: { id, type:'api_key', value:'sk-lab-...48 chars...', ... } }`
   - A row exists in `security_events` with `event_type='honeypot_deployed'` and `severity='info'`

2. `POST /api/honeypots` with `{ type:'file', instance_id:'carina-local' }`
   - Response: `{ honeypots: [ { value:'/tmp/.carina-backup.key', ... }, ... ] }`
   - Files exist at those paths on disk
   - Security event logged with `event_type='honeypot_deployed'`

3. `GET /api/honeypots/summary?instance_id=carina-local`
   - Response: `{ total: N, triggered: M, untriggered: N-M, by_type: { api_key: X, file: Y } }`
   - `total === triggered + untriggered`

4. Dashboard instances bar shows `[N pots  M triggered]` indicator; clicking opens modal

5. After clicking "Fake OpenAI Key" in the modal:
   - Spinner or disable during request
   - Toast `"Honeypot deployed: openai key"` appears
   - Modal closes
   - Summary indicator updates

6. `POST /api/honeypots/check/key` with the deployed fake key value
   - Response: `{ matched: true }`
   - `security_events` gains a `honeypot_triggered` row with `severity='breach'`
   - Dashboard event stream shows the breach event in red
