# Prompt 15: Channels, Pairing, and Node Host

You are working in the Carina mono-repo at `core.carinaai.uk/`.

## What already exists

**Channel backend:**
- `src/gateway/channels/channel-registry.ts` - `registerChannel(spec)`, `listChannels()`, `getChannel(id)`
- `src/gateway/channels/channel-status.ts` - `getChannelStatus(id)`, `ChannelStatus`, health enum
- `src/gateway/channels/catalog-channel-specs.ts` - catalog of 40+ channel specs
- `src/gateway/channels/dm-pairing.ts` - DM-based pairing codes

**Pairing backend:**
- `src/pairing/pairing.ts` - `generatePairingCode()`, `completePairing(code)`, `listPairedDevices()`, `unpairDevice(id)`
- `src/infrastructure/device-pairing.ts` - persistent pairing store
- `src/api/pairing-routes.ts` - routes at /api/pairing (check what is exposed)

**Webhooks page** (already exists):
- `packages/web/assets/web/webhooks.html` - shows webhook endpoints
- Served at GET `/webhooks` with `workspacePage: 'webhooks'`

**Existing API routes:**
- Pairing routes exist in `src/api/pairing-routes.ts` - check exact routes
- Channel webhooks are mounted via `mountAllChannelWebhooks(app)` in web-server.ts

## Part A: Channels management - enhance webhooks page with channels tab

Rather than a new page, add a "Channels" tab to the existing `/webhooks` page so both live in one place.

### Step 1: Add channel status routes to `src/api/webhook-api.ts` or create `src/api/channels-api.ts`

```typescript
import { Router, type Request, type Response } from 'express';
import { listChannels, getChannel } from '../gateway/channels/channel-registry.js';
import { getChannelStatus } from '../gateway/channels/channel-status.js';

export const channelsApiRouter = Router();

channelsApiRouter.get('/', async (_req, res) => {
  const channels = listChannels();
  const withStatus = await Promise.all(
    channels.map(async (ch) => {
      const status = await getChannelStatus(ch.id).catch(() => ({ status: 'unknown' }));
      return { ...ch, health: status };
    }),
  );
  res.json({ channels: withStatus });
});

channelsApiRouter.get('/:id/status', async (req, res) => {
  try {
    const status = await getChannelStatus(req.params.id);
    res.json(status);
  } catch (err) {
    res.status(404).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
```

Mount in `createWebServer()`:
```typescript
import { channelsApiRouter } from '#core/api/channels-api.js';
app.use('/api/channels', express.json(), requireAuth, channelsApiRouter);
```

### Step 2: Add channels tab to `packages/web/assets/web/webhooks.html`

Add a tab bar at the top of the workspace content area:

```html
<div style="display:flex;gap:0;border-bottom:1px solid var(--border);">
  <button class="wh-tab active" data-tab="webhooks">Webhooks</button>
  <button class="wh-tab" data-tab="channels">Channels</button>
  <button class="wh-tab" data-tab="pairing">Pairing</button>
</div>
<div id="tab-webhooks">
  <!-- existing webhooks content -->
</div>
<div id="tab-channels" hidden>
  <div id="channel-status" style="padding:0.5rem 0.75rem;font-size:0.75rem;color:var(--muted);"></div>
  <div id="channel-list" style="overflow-y:auto;flex:1;"></div>
</div>
<div id="tab-pairing" hidden>
  <!-- pairing panel (see Part B) -->
</div>
```

Channel list item HTML:
```html
<div class="channel-row" style="padding:0.65rem 0.85rem;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:0.65rem;">
  <div class="ch-dot" style="width:8px;height:8px;border-radius:50%;flex-shrink:0;"></div>
  <div style="flex:1;min-width:0;">
    <div style="font-size:0.84rem;font-weight:600;">CHANNEL_NAME</div>
    <div style="font-size:0.7rem;color:var(--muted);">TYPE | STATUS</div>
  </div>
  <div style="font-size:0.7rem;color:var(--muted);">WEBHOOK_PATH</div>
</div>
```

JS for channels tab:
- On tab activate: GET /api/channels, render list
- Dot color: green for `ok`, red for `error`, grey for `unknown` or `disabled`
- Skeleton: 5 rows while loading
- Empty state: "No channels configured. See the channel catalog in the Carina docs."

### Step 3: Add channels.js or extend webhooks JS

If the webhooks page has inline JS, extend it. If it has a linked `webhooks.js`, add channel logic there.

Channel list rendering function:
```javascript
function renderChannels(channels) {
  const listEl = document.getElementById('channel-list');
  document.getElementById('channel-status').textContent = channels.length + ' channels registered';
  if (!channels.length) {
    listEl.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--muted);">No channels configured.</div>';
    return;
  }
  listEl.innerHTML = channels.map(function(ch) {
    const color = ch.health && ch.health.status === 'ok' ? '#4ade80' : ch.health && ch.health.status === 'error' ? 'var(--danger)' : 'var(--muted)';
    return '<div style="padding:0.65rem 0.85rem;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:0.65rem;">' +
      '<div style="width:8px;height:8px;border-radius:50%;background:' + color + ';flex-shrink:0;"></div>' +
      '<div style="flex:1;min-width:0;"><div style="font-size:0.84rem;font-weight:600;">' + escapeHtml(ch.name || ch.id) + '</div>' +
      '<div style="font-size:0.7rem;color:var(--muted);">' + escapeHtml(ch.type || '') + ' | ' + escapeHtml((ch.health && ch.health.status) || 'unknown') + '</div></div>' +
      (ch.webhookPath ? '<code style="font-size:0.68rem;color:var(--muted);">' + escapeHtml(ch.webhookPath) + '</code>' : '') +
    '</div>';
  }).join('');
}
```

## Part B: Device pairing panel

### Step 1: Check `src/api/pairing-routes.ts` for existing routes

Expected routes already there:
- POST /api/pairing/generate - generates pairing code
- POST /api/pairing/complete - completes pairing with code
- GET /api/pairing/devices - lists paired devices
- DELETE /api/pairing/devices/:id - unpairs a device

If any are missing, add them:

```typescript
import { generatePairingCode, completePairing, listPairedDevices, unpairDevice } from '../pairing/pairing.js';

pairingRouter.get('/devices', async (_req, res) => {
  res.json({ devices: await listPairedDevices() });
});

pairingRouter.post('/generate', async (_req, res) => {
  const code = await generatePairingCode();
  res.json({ code, expiresAt: new Date(Date.now() + 5 * 60_000).toISOString() });
});

pairingRouter.post('/complete', async (req, res) => {
  const code = String(req.body?.code ?? '');
  if (!code) { res.status(400).json({ error: 'code required' }); return; }
  try {
    const device = await completePairing(code);
    res.json({ device });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

pairingRouter.delete('/devices/:id', async (req, res) => {
  try {
    await unpairDevice(req.params.id);
    res.status(204).end();
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
```

### Step 2: Pairing panel HTML inside `#tab-pairing` in webhooks.html

```html
<div style="padding:0.85rem 1rem;">
  <div style="margin-bottom:1rem;">
    <div style="font-size:0.78rem;color:var(--muted);margin-bottom:0.5rem;">Generate a one-time code to pair a mobile app or CLI device.</div>
    <button id="gen-code-btn" style="background:var(--accent);color:#0d0d0f;border:none;border-radius:8px;padding:0.45rem 0.85rem;font-size:0.82rem;font-weight:700;cursor:pointer;">Generate pairing code</button>
    <div id="pairing-code-display" hidden style="margin-top:0.65rem;">
      <code id="pairing-code" style="font-size:1.6rem;letter-spacing:0.15em;display:block;margin-bottom:0.25rem;"></code>
      <div id="pairing-expires" style="font-size:0.72rem;color:var(--muted);"></div>
    </div>
  </div>
  <div style="font-size:0.78rem;color:var(--muted);margin-bottom:0.4rem;text-transform:uppercase;letter-spacing:0.04em;">Paired devices</div>
  <div id="paired-devices"></div>
</div>
```

JS for pairing panel:
```javascript
function loadPairedDevices() {
  var el = document.getElementById('paired-devices');
  el.innerHTML = '<div class="skeleton" style="height:52px;border-radius:8px;"></div>';
  fetch('/api/pairing/devices')
    .then(function(r){return r.json();})
    .then(function(d) {
      var devices = d.devices || [];
      if (!devices.length) {
        el.innerHTML = '<div style="font-size:0.82rem;color:var(--muted);padding:0.5rem 0;">No paired devices. Generate a code to pair one.</div>';
        return;
      }
      el.innerHTML = devices.map(function(dev) {
        return '<div style="display:flex;align-items:center;gap:0.6rem;padding:0.55rem 0;border-bottom:1px solid var(--border);">' +
          '<div style="flex:1;font-size:0.83rem;">' + escapeHtml(dev.name || dev.id) + '</div>' +
          '<div style="font-size:0.7rem;color:var(--muted);">' + escapeHtml(dev.pairedAt ? new Date(dev.pairedAt).toLocaleDateString() : '') + '</div>' +
          '<button data-unpair="' + escapeHtml(dev.id) + '" style="background:none;border:1px solid var(--border);border-radius:6px;padding:0.2rem 0.5rem;font-size:0.72rem;color:var(--muted);cursor:pointer;">Unpair</button>' +
        '</div>';
      }).join('');
      el.querySelectorAll('[data-unpair]').forEach(function(btn) {
        btn.addEventListener('click', function() {
          if (!confirm('Unpair this device?')) return;
          fetch('/api/pairing/devices/' + btn.dataset.unpair, { method: 'DELETE' })
            .then(function(){loadPairedDevices();});
        });
      });
    });
}

document.getElementById('gen-code-btn').addEventListener('click', function() {
  fetch('/api/pairing/generate', { method: 'POST' })
    .then(function(r){return r.json();})
    .then(function(d) {
      document.getElementById('pairing-code').textContent = d.code || '';
      document.getElementById('pairing-expires').textContent = d.expiresAt ? 'Expires ' + new Date(d.expiresAt).toLocaleTimeString() : '';
      document.getElementById('pairing-code-display').hidden = false;
    });
});
```

## Part C: Process/host status - add to settings page

The process API (`src/api/process-api.ts`) exposes CPU, memory, uptime. Surface this in the settings page as a "System" section.

GET /api/process/status (check process-api.ts for exact route):

```javascript
fetch('/api/process/status').then(function(r){return r.json();}).then(function(d) {
  document.getElementById('sys-uptime').textContent = d.uptime ? Math.floor(d.uptime / 60) + ' min' : '--';
  document.getElementById('sys-mem').textContent = d.memoryMb ? d.memoryMb + ' MB' : '--';
  document.getElementById('sys-pid').textContent = d.pid || '--';
});
```

Add to settings.html:
```html
<section class="settings-section">
  <h2>System</h2>
  <div class="settings-row"><span>Uptime</span><span id="sys-uptime">--</span></div>
  <div class="settings-row"><span>Memory</span><span id="sys-mem">--</span></div>
  <div class="settings-row"><span>PID</span><span id="sys-pid">--</span></div>
  <div class="settings-row"><span>Node</span><span id="sys-node">--</span></div>
</section>
```

## Tests

Create `src/api/channels-api.test.ts`:
- GET /api/channels returns `{ channels: [] }` when no channels registered
- GET /api/channels/:id/status returns 404 for unknown channel

Add to or create `src/api/pairing-routes.test.ts`:
- GET /api/pairing/devices returns `{ devices: [] }` initially
- POST /api/pairing/generate returns `{ code: string, expiresAt: string }`
- DELETE /api/pairing/devices/:id returns 204
- POST /api/pairing/complete with bad code returns 400

## Acceptance criteria

- The webhooks/channels page has tabs: Webhooks, Channels, Pairing
- Channels tab lists all registered channels with health dots
- Pairing tab lets the operator generate a code and see paired devices
- Unpairing a device removes it from the list immediately
- System section in settings shows live process stats
