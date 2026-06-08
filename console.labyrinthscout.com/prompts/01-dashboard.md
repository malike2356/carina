# Labyrinth Scout - Prompt 01: Security Dashboard + SSE API

## What you are building

Build the Labyrinth Scout real-time security dashboard and its three supporting Express routers.
Labyrinth Scout is a security control plane that monitors a running Carina AI agent instance.

**Working directory:** `/opt/lampp/htdocs/VERLOX/Carina-ai/labyrinthscout/`

Do not touch anything outside that directory in this prompt.

---

## Files to create

```
labyrinthscout/public/dashboard.html   # single-file dashboard (main deliverable)
labyrinthscout/src/api/sse.ts          # GET /api/stream - SSE broadcaster
labyrinthscout/src/api/status.ts       # GET /api/status - instance list + stats
labyrinthscout/src/api/kill.ts         # POST /api/kill/:instanceId - suspend instance
```

---

## 1. dashboard.html - full specification

### Visual design

- Background: `#0a0e1a` (dark navy)
- Primary accent: `#d4af37` (gold)
- Critical severity: `#ef4444` (red-500)
- Warning severity: `#f59e0b` (amber-500)
- Info severity: `#3b82f6` (blue-500)
- Breach severity: `#dc2626` (red-700, pulsing)
- Text primary: `#e2e8f0`
- Text muted: `#64748b`
- Card background: `#0f1629`
- Border: `#1e2d4a`
- Font: Inter (Google Fonts). Monospace: JetBrains Mono for timestamps and IDs.

### Security grid background

The page background has a subtle CSS grid pattern - 40px cells with `rgba(212,175,55,0.04)` lines.
On `critical` or `breach` events arriving via SSE, trigger a 1-second pulse animation on the grid
(grid lines briefly glow gold at 0.12 opacity, then fade back). Use a CSS class `.grid-pulse` added
to `<body>` and removed after 1000ms.

```css
/* grid pattern example */
body::before {
  content: '';
  position: fixed;
  inset: 0;
  background-image:
    linear-gradient(rgba(212,175,55,0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(212,175,55,0.04) 1px, transparent 1px);
  background-size: 40px 40px;
  pointer-events: none;
  z-index: 0;
  transition: opacity 0.3s;
}
body.grid-pulse::before {
  background-image:
    linear-gradient(rgba(212,175,55,0.12) 1px, transparent 1px),
    linear-gradient(90deg, rgba(212,175,55,0.12) 1px, transparent 1px);
}
```

All page content sits on `z-index: 1` so the grid stays behind.

### Page header

- Left: "LABYRINTH SCOUT" in gold, monospace, 1.1rem, letter-spacing 0.15em. Below it: "CARINA SECURITY CONTROL PLANE" in muted text, 0.75rem.
- Right: Connection indicator. A small circle (10px diameter), label "SSE CONNECTED" or "SSE DISCONNECTED". Green `#22c55e` when connected, red `#ef4444` when not. Animate a gentle ring-ping on the green dot while connected (CSS keyframe, 2s loop). Beside it, a "VERLOX INTERNAL" badge in gold border, gold text, 0.65rem.

### Stat cards (top row, three cards side by side)

Each card has: large number (2.5rem, bold), label below (0.8rem muted caps), and "last 24 h" in tiny muted text bottom-right.

| Card | Color | Icon (pure CSS or unicode) | Field from SSE stats |
|---|---|---|---|
| Critical Events | red border-left | triangle with exclamation U+26A0 | `stats.critical` |
| Warnings | amber border-left | circle-i U+2139 | `stats.warning` |
| Info Events | blue border-left | info dot U+25CF | `stats.info` |

Cards update when a `{ "type": "stats" }` SSE message arrives. On update, briefly scale the number
to 1.15 and back (CSS transition, 200ms).

### Live event stream panel

Title: "LIVE EVENT STREAM" with a blinking dot indicator (1s blink CSS).

Holds the last 50 events. Oldest are removed from DOM when 51st arrives.

Each row is a `<div class="event-row">` with these columns:

| Column | Width | Content |
|---|---|---|
| timestamp | 11ch | HH:MM:SS local time |
| severity | 10ch | colored badge: CRITICAL / WARNING / INFO / BREACH |
| event_type | 22ch | monospace, snake_case, truncated with ellipsis |
| description | flex-grow | truncated to 80 chars, title attribute = full text |
| instance_id | 16ch | monospace, muted |

New rows are prepended (newest at top). When a new event arrives, the row gets class
`.event-flash` for 600ms (yellow-tinted background fading to transparent) then the class
is removed. Use a CSS keyframe for this - do not use JS setTimeout per-row; use CSS
`animation: eventFlash 0.6s ease-out forwards`.

Severity badge styles:
- `critical` or `breach`: red background `#7f1d1d`, red text `#fca5a5`, uppercase bold
- `warning`: amber background `#78350f`, amber text `#fcd34d`, uppercase bold
- `info`: blue background `#1e3a5f`, blue text `#93c5fd`, uppercase bold

The panel is `height: 420px; overflow-y: auto`. Use a thin custom scrollbar matching the theme
(scrollbar-color for Firefox; `::-webkit-scrollbar` for Chrome).

### Filter controls

Inline bar above the event stream:

- Severity filter: segmented button group - ALL / CRITICAL / WARNING / INFO. Active segment:
  gold background, dark text. Inactive: dark background, muted text. Clicking filters the
  visible rows using `display: none` (do not remove from DOM, just hide).
- Instance filter: a `<select>` dropdown. Options populated from the instance list. "All instances"
  is the default option. Populated after first `/api/status` poll.
- Both filters are applied together (AND). Filtering is purely DOM manipulation - no re-fetch.

### Agent status panel

Title: "AGENT INSTANCES"

Polls `GET /api/status` every 10 seconds. Shows a card per instance with:
- Instance name (bold)
- Status badge: green "ACTIVE" / red "SUSPENDED" / grey "OFFLINE"
  - OFFLINE = last_heartbeat older than 90 seconds from now
- "Last seen: Xs ago" (seconds since last_heartbeat; update every 10s on re-poll)
- Kill switch button: red outlined button, label "SUSPEND". Hidden if status is already "suspended".

On kill button click, open a confirmation modal (see below).

### Kill switch confirmation modal

Centered modal with dark overlay (`rgba(0,0,0,0.7)`). Contents:
- Title: "SUSPEND AGENT?" in gold, 1.1rem
- Body: "This will immediately suspend [instance name] and block all tool calls. The agent
  will not be able to respond until manually reactivated."
- Two buttons: "CANCEL" (muted outlined) and "CONFIRM SUSPEND" (solid red `#dc2626`)
- On confirm: POST to `/api/kill/:instanceId` with header `X-Scout-Key: <key from window.__SCOUT_KEY>`.
  - On 200: flash the instance card red, update badge to SUSPENDED, hide kill button. Show a
    green success toast notification "Agent suspended successfully" for 3 seconds.
  - On error: show red toast "Failed to suspend agent: [error message]" for 5 seconds.
- ESC key and clicking overlay close without action.

Note on auth: the dashboard is served from Labyrinth Scout itself on the local network. The kill
button reads the API key from `window.__SCOUT_KEY` which the server injects into the HTML at serve
time (see sse.ts). Do NOT hardcode a key in the HTML file - it must come from the server injection.

### Tool usage heatmap

Title: "TOOL CALLS - LAST HOUR"

A pure CSS horizontal bar chart. No canvas, no SVG, no chart library.

Six tools shown, each as a row:
```
web-search     ████████████░░░░  42
file-read      ████░░░░░░░░░░░░  14
http-request   ██████░░░░░░░░░░  21
shell-exec     █░░░░░░░░░░░░░░░   3
email-send     ░░░░░░░░░░░░░░░░   0
code-exec      ███░░░░░░░░░░░░░  11
```

Each row: tool name (11ch monospace), bar (flex-grow, max-width 200px, height 18px,
gold fill `#d4af37`, dark background `#1e2d4a`, border-radius 2px), count (4ch, right-aligned muted).
The bar width is `calc(count / maxCount * 100%)`. If maxCount is 0, all bars are 0%.

Data source: the `/api/status` response includes a `toolCalls` field (object keyed by tool name).
The chart re-renders on every status poll.

### Toast notifications

Position: bottom-right, stacked. Slide in from right, auto-dismiss.

```css
.toast { ... position: fixed; bottom: 1.5rem; right: 1.5rem; ... }
```

At most 3 toasts visible at once; oldest removed if a 4th arrives.

### SSE connection management

```javascript
let evtSource = null;
let reconnectDelay = 1000;

function connect() {
  evtSource = new EventSource('/api/stream');

  evtSource.onopen = () => {
    setConnectionIndicator(true);
    reconnectDelay = 1000;
  };

  evtSource.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.type === 'event') handleIncomingEvent(msg.data);
    if (msg.type === 'stats') updateStats(msg.data);
    if (msg.type === 'heartbeat') { /* keep-alive, no UI change */ }
  };

  evtSource.onerror = () => {
    setConnectionIndicator(false);
    evtSource.close();
    setTimeout(connect, reconnectDelay);
    reconnectDelay = Math.min(reconnectDelay * 2, 30000);
  };
}

connect();
```

Implement the full logic - this is the skeleton only.

### Status polling

```javascript
async function pollStatus() {
  try {
    const res = await fetch('/api/status');
    if (!res.ok) return;
    const data = await res.json();
    renderInstances(data.instances);
    renderToolChart(data.toolCalls);
    updateInstanceFilter(data.instances);
  } catch { /* silent */ }
}

pollStatus();
setInterval(pollStatus, 10_000);
```

### window.__SCOUT_KEY injection

In `sse.ts`, when serving the static `dashboard.html` file for requests to `/`, inject the Scout
API key by replacing the placeholder `<!-- __SCOUT_KEY_INJECTION__ -->` in the HTML with:
```html
<script>window.__SCOUT_KEY = 'ACTUAL_KEY_HERE';</script>
```

Place the placeholder comment in `<head>` immediately after `<meta charset="UTF-8">`.

---

## 2. src/api/sse.ts - SSE broadcaster

```typescript
// GET /api/stream
// No auth required (served on local network only)
// Streams SSE to dashboard clients

import { Router } from 'express';
import { getRedis } from '../redis.js';

const router = Router();
const clients = new Set<Response>();  // track active SSE connections

// Subscribe to Redis 'scout:events' channel and fan out to all SSE clients.
// On startup, subscribe once and keep the subscription alive.

router.get('/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');  // disable nginx buffering
  res.flushHeaders();

  clients.add(res);

  // Send initial heartbeat immediately
  res.write('data: ' + JSON.stringify({ type: 'heartbeat' }) + '\n\n');

  // Keep-alive: send heartbeat every 30 seconds
  const keepAlive = setInterval(() => {
    res.write('data: ' + JSON.stringify({ type: 'heartbeat' }) + '\n\n');
  }, 30_000);

  req.on('close', () => {
    clearInterval(keepAlive);
    clients.delete(res);
  });
});

// Exported function called by events.ts after inserting an event
export function broadcastEvent(event: SecurityEventRow): void {
  const msg = 'data: ' + JSON.stringify({ type: 'event', data: event }) + '\n\n';
  for (const res of clients) {
    try { res.write(msg); } catch { clients.delete(res); }
  }
}

export function broadcastStats(stats: { critical: number; warning: number; info: number }): void {
  const msg = 'data: ' + JSON.stringify({ type: 'stats', data: stats }) + '\n\n';
  for (const res of clients) {
    try { res.write(msg); } catch { clients.delete(res); }
  }
}

export { router as sseRouter };
```

Implement the full file from this skeleton. Import `SecurityEventRow` type from `../types.js`
(create `src/types.ts` with all shared types if it does not exist).

Redis subscription: in `src/server.ts`, after `initRedis()`, call `initSseSubscriber()` which
creates a dedicated Redis subscriber client (a separate `new Redis(config.redis.url)` instance,
because ioredis subscriber clients cannot run commands). It subscribes to `scout:events`. On
message, parse the JSON and call `broadcastEvent()` and re-compute stats if the event is
critical/warning.

---

## 3. src/api/status.ts - instance list and stats

```
GET /api/status
Response 200:
{
  "instances": [
    {
      "id": "carina-vps-01",
      "name": "Carina VPS 01",
      "status": "active" | "suspended" | "offline",
      "last_heartbeat": "2026-06-04T10:22:00Z",
      "secondsAgo": 8
    }
  ],
  "stats": {
    "critical": 2,
    "warning": 7,
    "info": 143
  },
  "toolCalls": {
    "web-search": 42,
    "file-read": 14,
    "http-request": 21,
    "shell-exec": 3,
    "email-send": 0,
    "code-exec": 11
  }
}
```

Implementation notes:
- Query `carina_instances` table for all rows ordered by `created_at`.
- Compute `secondsAgo` from `last_heartbeat`. If null, treat as offline.
- An instance is "offline" if `secondsAgo > 90` regardless of stored status.
- Stats query: count severity from `security_events WHERE created_at > NOW() - INTERVAL '24 hours'`.
- Tool calls query: count from `security_events WHERE created_at > NOW() - INTERVAL '1 hour'`
  and `event_type = 'tool_call'` and `metadata->>'tool_name' IN (the 6 tools)`. Returns 0 if
  no records for a tool.
- Auth: requires `X-Scout-Key` header (handled by middleware in server.ts; no auth logic here).
- Error: return 500 with `{ "error": "Database unavailable" }` if query fails.

---

## 4. src/api/kill.ts - suspend an instance

```
POST /api/kill/:instanceId
Headers: X-Scout-Key required
Body: none
Response 200: { "ok": true, "instanceId": "...", "suspended": true }
Response 404: { "error": "Instance not found" }
Response 400: { "error": "Instance already suspended" }
```

Implementation:
1. Look up `instanceId` in `carina_instances`. Return 404 if not found.
2. Return 400 if `status` is already `'suspended'`.
3. UPDATE `carina_instances SET status='suspended', suspension_reason='Kill switch activated via dashboard'`
   WHERE id = $1`.
4. Publish to Redis channel `'labyrinth:control'` the message:
   ```json
   { "action": "suspend", "instance_id": "carina-vps-01", "reason": "Kill switch activated via dashboard", "ts": "ISO8601" }
   ```
5. Insert a `security_events` row with severity `'critical'`, event_type `'kill_switch_activated'`,
   description `'Agent suspended via dashboard kill switch'`, instance_id = the suspended instance id.
6. Call `broadcastEvent()` so the dashboard sees the event immediately.
7. Return 200 on success.

---

## Error handling requirements

- `dashboard.html`: all fetch calls wrapped in try/catch. Network errors show toast, never crash.
- `sse.ts`: individual write failures to one client must not affect other clients (the Set iteration
  catches per-client errors).
- `status.ts`: DB query failure returns 500; never throws unhandled.
- `kill.ts`: Redis publish failure is logged but does not block the 200 response (the DB update
  is the source of truth; Redis is best-effort notification).

---

## Test cases to verify manually after building

1. Open `http://localhost:4444` in browser - dashboard loads, shows "SSE DISCONNECTED" briefly
   then "SSE CONNECTED" within 1 second.
2. POST a test event via curl:
   ```bash
   curl -X POST http://localhost:4444/api/events \
     -H "X-Scout-Key: test_key" \
     -H "Content-Type: application/json" \
     -d '{"severity":"critical","source":"test","event_type":"injection_blocked","description":"Test event"}'
   ```
   The dashboard event stream should show the new row within 500ms with a brief flash.
3. The stat cards should update when a stats SSE message arrives.
4. Click a kill button, cancel the modal - no POST is made.
5. Click a kill button, confirm - the instance badge changes to SUSPENDED.
6. Disconnect the Scout server process. Dashboard shows red "SSE DISCONNECTED". Restart Scout.
   Dashboard auto-reconnects within 30 seconds (reconnect delay starts at 1s and doubles).
7. Filter by "CRITICAL" severity - only critical rows remain visible, others are hidden.
8. Filter by a specific instance_id - only that instance's events show.

---

## Constraints

- No React, Vue, Angular, or any JS framework.
- No chart libraries (Chart.js, D3, etc.).
- Tailwind CDN is allowed for utility classes if useful, but the dark theme and grid background
  must be custom CSS (Tailwind does not ship with the exact gold/navy palette required).
- No build step for the dashboard. It must work as a plain file served by Express static middleware.
- Total dashboard HTML file size target: under 600 lines. Keep JS functions focused and named.
- All JS is in a single `<script>` block at the bottom of `<body>`. No inline event handlers
  (use `addEventListener`). No `eval`.
- TypeScript files use ES module syntax (`import`/`export`). No CommonJS `require`.
- All TypeScript files must pass `tsc --noEmit` with strict mode on.
