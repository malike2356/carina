# Platform Admin - Security Tab (Labyrinth Scout Integration)

**Working directory:** `/opt/lampp/htdocs/VERLOX/Carina-ai/ops.carinaai.uk/`
**Depends on:** Labyrinth Scout server running at `SCOUT_URL` (default `http://localhost:4444`)
**Purpose:** Add a Security tab to the VERLOX platform admin that proxies Labyrinth Scout's live event stream, stat cards, instance status, and kill switch; all inside the existing admin layout behind the existing single admin password. You never visit `localhost:4444` directly.

---

## New env vars to add to `.env` and `.env.example`

```
SCOUT_URL=http://localhost:4444
SCOUT_API_KEY=your_scout_api_key_here
```

---

## Files to create

### `lib/scout.ts`

Scout HTTP proxy helper. All calls from ops.carinaai.uk to Scout go through this.

```typescript
const SCOUT_URL = process.env.SCOUT_URL ?? 'http://localhost:4444';
const SCOUT_KEY = process.env.SCOUT_API_KEY ?? '';

const headers = () => ({ 'X-Scout-Key': SCOUT_KEY, 'Content-Type': 'application/json' });

export async function scoutGet(path: string): Promise<unknown> {
  // GET from Scout, return parsed JSON. On fetch error return null (Scout may be offline).
}

export async function scoutPost(path: string, body: unknown): Promise<unknown> {
  // POST to Scout, return parsed JSON. On fetch error return null.
}

export function scoutStreamUrl(path: string): string {
  return `${SCOUT_URL}${path}`;
}
```

Both functions: if Scout is unreachable return `null` and log `[scout] offline`. Never throw.
Timeout: 5 seconds on all non-stream calls. No timeout on the SSE stream itself.

---

### `routes/security.ts`

Express router mounted at `/security`.

```typescript
export const securityRouter = Router();
```

**`GET /security`** - renders `views/security.ejs`. Fetches initial data from Scout before rendering:
- `GET /api/status` → instances list + recent stats (critical/warning/info counts last 24h)
- If Scout offline: render with `scoutOnline: false` so the view shows a "Scout not running" banner.

Pass to view:
```typescript
{
  title: 'Security',
  scoutOnline: boolean,
  stats: { critical: number, warning: number, info: number },
  instances: Array<{ id, name, status, lastHeartbeat }>,
  scoutStreamPath: '/security/stream',   // the proxied SSE path
  scoutUrl: process.env.SCOUT_URL,
}
```

**`GET /security/stream`** - SSE proxy. Pipes Scout's `GET /api/stream` SSE to the browser client.

```typescript
securityRouter.get('/stream', requireAdmin, async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const scoutUrl = `${process.env.SCOUT_URL ?? 'http://localhost:4444'}/api/stream`;

  try {
    const upstream = await fetch(scoutUrl, {
      headers: { 'X-Scout-Key': process.env.SCOUT_API_KEY ?? '' },
    });

    if (!upstream.ok || !upstream.body) {
      res.write('data: {"type":"offline"}\n\n');
      res.end();
      return;
    }

    // Pipe the upstream SSE body to the client
    const reader = upstream.body.getReader();
    req.on('close', () => reader.cancel());

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
  } catch {
    res.write('data: {"type":"offline"}\n\n');
  }
  res.end();
});
```

**`POST /security/kill/:instanceId`** - Proxies kill switch to Scout.
- Body: `{ reason: string }`
- Calls `scoutPost('/api/kill/:instanceId', { reason })`
- Returns Scout's JSON response directly.
- Requires `requireAdmin` middleware.

**`POST /security/resume/:instanceId`** - Same pattern for resume.

**`GET /security/events`** - Returns last 50 security events as JSON (for initial page load without SSE). Calls `scoutGet('/api/events?limit=50')`.

---

### `views/security.ejs`

Security tab view. Renders inside the existing `layout.ejs` shell (no standalone HTML - just the `<div>` content that goes in `<%- body %>`).

**Layout:** Two rows.

Row 1 - Stat cards (3 columns):
```
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  CRITICAL     │  │  WARNING      │  │  INFO         │
│     2           │  │     7           │  │    143          │
│  Last 24h       │  │  Last 24h       │  │  Last 24h       │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```
Colors: critical = red border, warning = yellow border, info = blue border.
Values from `stats` object passed to view. If `scoutOnline: false`, show dashes.

Row 2 - Two columns:

Left column (60% width) - Live event stream:
- `<div id="event-stream">` - scrollable, max-height 500px, auto-scroll to bottom
- Each event row: `[HH:MM:SS]` timestamp | severity badge | event_type | description (truncated 80 chars) | instance_id
- Severity badge colours: critical=red, breach=red blinking, warning=amber, info=blue
- New events added via SSE flash briefly (CSS transition, green highlight for 1 second)
- Filter bar above stream: "All / Critical / Warning / Info" toggle buttons. Filter client-side (no re-fetch).

Right column (40% width) - Instances panel:
- Header: "Agent Instances"
- List each instance from `instances` array:
  - Name, status badge (green=active, red=suspended, grey=offline)
  - "Last seen: Xs ago" - computed client-side from `lastHeartbeat` timestamp
  - For ACTIVE instances: red "Kill" button
  - For SUSPENDED instances: green "Resume" button
- Kill button: shows confirmation modal with reason textarea before POSTing to `/security/kill/:id`
- Resume button: POSTs to `/security/resume/:id` immediately

If `scoutOnline: false`:
```html
<div class="scout-offline-banner">
  Labyrinth Scout is not running at <%= scoutUrl %>.
  Start it with: <code>cd labyrinthscout && pnpm dev</code>
</div>
```
Show placeholder data (all zeros, no instances).

**SSE connection (client-side JS in the view):**
```javascript
const es = new EventSource('/security/stream');
es.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  if (msg.type === 'event') addEventToStream(msg.data);
  if (msg.type === 'stats') updateStatCards(msg.data);
  if (msg.type === 'offline') showOfflineBanner();
};
es.onerror = () => {
  // Exponential backoff reconnect (handled automatically by EventSource)
  showDisconnectedIndicator();
};
```

Connection indicator: top-right of the Security content area (not the global nav). Green dot = connected, amber = reconnecting, red = Scout offline.

---

## Files to modify

### `server.ts`

Add import and mount:
```typescript
import { securityRouter } from './routes/security.js';
// after other routers:
app.use('/security', requireAdmin, securityRouter);
```

### `views/layout.ejs`

Add Security to the nav links array:
```javascript
const links = [
  { href: '/',           label: 'Dashboard',  match: (p) => p === '/' },
  { href: '/security',   label: 'Security',   match: (p) => p.startsWith('/security') },
  { href: '/chat',       label: 'Chat',       match: (p) => p.startsWith('/chat') },
  { href: '/memories',   label: 'Memories',   match: (p) => p.startsWith('/memories') },
  { href: '/skills',     label: 'Skills',     match: (p) => p.startsWith('/skills') },
  { href: '/rag',        label: 'RAG Corpus', match: (p) => p.startsWith('/rag') },
  { href: '/projects',   label: 'Projects',   match: (p) => p.startsWith('/projects') },
  { href: '/settings',   label: 'Settings',   match: (p) => p.startsWith('/settings') },
];
```

Add a small Scout status indicator to the sidebar footer (below the Carina version):
```html
<div id="scout-status" class="text-xs mt-1">
  <span id="scout-dot" class="inline-block w-2 h-2 rounded-full bg-gray-500 mr-1"></span>
  <span id="scout-label" class="text-gray-500">Scout</span>
</div>
```
Client-side: ping `/security/events` on page load. If 200 → dot green. If error → dot red.

---

## Error handling specifications

- Scout offline at page load: render with offline banner, zeros in stat cards, no instances. Do not crash. Do not redirect.
- Scout goes offline mid-session: SSE `offline` event triggers inline banner in event stream. Stat cards freeze at last values. Page does not reload.
- Kill switch fails (Scout returns error): show inline error message in the instance row. Do not alert(). Do not reload.
- Resume fails same pattern.
- SSE stream disconnects: EventSource auto-reconnects. Disconnected indicator shown after 5 seconds of no heartbeat.

---

## Test cases

1. Visit `/security` with Scout offline → offline banner shown, zeros in stat cards, no crash
2. Visit `/security` with Scout running → stat cards populated, instances listed
3. SSE stream: send a critical event from Scout → appears in stream within 1 second, red badge, flash animation
4. Kill button: click → confirmation modal → confirm → POST to `/security/kill/:id` → instance shows "suspended" badge
5. Resume button → POST to `/security/resume/:id` → instance shows "active" badge
6. Filter: select "Critical" → only critical events visible in stream (no re-fetch)
7. Scout goes offline mid-session → SSE error → offline indicator appears → page remains usable
