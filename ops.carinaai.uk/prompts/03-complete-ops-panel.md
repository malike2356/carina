# ops.carinaai.uk - Complete the VERLOX Ops Panel

**Working directory:** `/opt/lampp/htdocs/VERLOX/Carina-ai/ops.carinaai.uk/`
**Purpose:** VERLOX operator's personal admin panel for managing Carina. Single admin password. Never public.
**Runs on:** port 4000 (`pnpm dev` or `node_modules/.bin/tsx watch server.ts`)

---

## Current state; read these files first before writing anything

Read ALL of the following before making changes:

- `server.ts` - Express 4.x + EJS, session auth, layout middleware, all routers mounted
- `views/layout.ejs` - sidebar nav, Tailwind CDN, dark theme
- `views/dashboard.ejs` and `routes/dashboard.ts` - stat cards + recent sessions working
- `views/chat.ejs` - 159 lines, EXISTS but needs SSE streaming wired in
- `views/memories/index.ejs` and `routes/memories.ts` - memory browser
- `views/skills/index.ejs`, `view.ejs`, `new.ejs`, `_form.ejs` and `routes/skills.ts` - skill CRUD
- `views/rag.ejs` and `routes/rag.ts` - RAG corpus viewer
- `views/projects.ejs` and `routes/projects.ts` - kanban project tracker
- `views/settings.ejs` - EXISTS as a view stub (no route wired)
- `lib/db.ts` - PostgreSQL pool, exports `query()` helper
- `lib/constants.ts` - VERLOX_QUICK_ACTIONS array
- `lib/projects.ts` - JSON file-based project store
- `middleware/auth.ts` - `requireAdmin` middleware
- `.env` - ADMIN_PASSWORD, CARINA_API_URL (http://localhost:3333), CARINA_DB_URL, PORT=4000

---

## What needs to be BUILT (not stubs, working implementations)

### 1. Security Tab (HIGHEST PRIORITY; missing entirely)

Add a Security tab that proxies Labyrinth Scout's live event stream.

**New file: `lib/scout.ts`**

```typescript
const SCOUT_URL = process.env.SCOUT_URL ?? 'http://localhost:4444';
const SCOUT_KEY = process.env.SCOUT_API_KEY ?? '';

export function scoutHeaders() {
  return { 'X-Scout-Key': SCOUT_KEY };
}

export async function scoutGet(path: string): Promise<unknown> {
  try {
    const r = await fetch(`${SCOUT_URL}${path}`, { headers: scoutHeaders(), signal: AbortSignal.timeout(5000) });
    if (!r.ok) return null;
    return r.json();
  } catch { return null; }
}

export const SCOUT_BASE = SCOUT_URL;
```

**New file: `routes/security.ts`**

`GET /security`; renders `views/security.ejs`. Fetches initial data:
- `GET /api/status` from Scout for instances + 24h stats
- If Scout offline: render with `scoutOnline: false` (banner shown, zeros in stats)

Pass to view: `{ title:'Security', scoutOnline, stats, instances, scoutUrl: SCOUT_URL }`

`GET /security/stream`; SSE proxy. Pipes Scout's `GET /api/stream` to the browser using `fetch` with streaming. Requires no auth header on Scout's stream endpoint (it's open to local network). Sets `Content-Type: text/event-stream`. On Scout offline: sends `data: {"type":"offline"}\n\n` and ends.

`POST /security/kill/:instanceId`; body `{ reason }`. Proxies to Scout `POST /api/kill/:instanceId`. Returns Scout's JSON response.

`POST /security/resume/:instanceId`; proxies to Scout `POST /api/resume/:instanceId`.

Mount in `server.ts`: `app.use('/security', requireAdmin, securityRouter);`

Add `SCOUT_URL` and `SCOUT_API_KEY` to `.env` and `.env.example`:
```
SCOUT_URL=http://localhost:4444
SCOUT_API_KEY=sk-scout-21d98b1c7f6850f2b780ee30dd01207da0af9544a625571b
```

**New file: `views/security.ejs`**

The security dashboard inside the ops layout. Shows:

**If Scout offline:** amber banner "Labyrinth Scout is not running at `<%= scoutUrl %>`. Start it with: cd console.labyrinthscout.com && pnpm dev"

**If online:**

Top: 4 stat cards (critical, warning, info, breach counts); same style as dashboard stat cards.

Middle: Live event stream; scrolling log, SSE connection to `/security/stream`. Each event row: timestamp | severity badge | event_type | description | instance. Severity badge coloured (red=critical/breach, amber=warning, cyan=info).

Right sidebar (or below on narrow): Instance chips showing each agent instance name, status, last heartbeat, with KILL and RESUME buttons. Kill shows a confirm dialog before POSTing.

Connection indicator: small dot (green=SSE connected, red=disconnected). Auto-reconnects with exponential backoff.

```javascript
// SSE connection (inline script in security.ejs)
let es;
function connectStream() {
  es = new EventSource('/security/stream');
  es.onopen = () => setDot(true);
  es.onerror = () => { setDot(false); setTimeout(connectStream, 5000); };
  es.onmessage = e => {
    try {
      const msg = JSON.parse(e.data);
      if (msg.type === 'event') appendEvent(msg.data);
      if (msg.type === 'stats') updateStats(msg.data);
      if (msg.type === 'offline') showOfflineBanner();
    } catch {}
  };
}
```

---

### 2. Chat Tab; complete SSE streaming (currently static render only)

The existing `views/chat.ejs` has the HTML structure but no working SSE stream. Complete it.

**Modify `routes/chat.ts`**; add a provider proxy:
```typescript
chatRouter.post('/provider', async (req, res) => {
  const { provider } = req.body as { provider: string };
  const carinaUrl = process.env.CARINA_API_URL ?? 'http://localhost:3333';
  try {
    const r = await fetch(`${carinaUrl}/api/providers`);
    res.json(await r.json());
  } catch { res.status(503).json({ error: 'Carina offline' }); }
});
```

**Modify `views/chat.ejs`**; complete the JavaScript so the chat actually works:

The chat form sends a message and streams from Carina's SSE endpoint `GET /api/chat/stream?message=...&sessionId=...`.

Session ID: stored in `localStorage` under key `carina-ops-session`. Generate UUID v4 on first use.

Clear session: POST to `/api/clear` on Carina with `{ sessionId }`.

Quick actions: clicking a VERLOX_QUICK_ACTIONS button pre-fills the textarea. The textarea auto-grows.

Carina offline detection: if SSE connection fails, show "Carina is not running at <%= carinaApiUrl %>. Start with: pnpm dev" banner and disable the input.

Provider indicator: fetch `GET /api/providers` from Carina on load, show current provider name.

```javascript
// Session
let SESSION_ID = localStorage.getItem('carina-ops-session');
if (!SESSION_ID) {
  SESSION_ID = crypto.randomUUID();
  localStorage.setItem('carina-ops-session', SESSION_ID);
}

async function sendMessage(text) {
  if (!text.trim()) return;
  appendMessage('user', text);
  clearInput();

  const url = new URL('<%= carinaApiUrl %>/api/chat/stream');
  url.searchParams.set('message', text);
  url.searchParams.set('sessionId', SESSION_ID);

  const msgDiv = appendMessage('assistant', '');
  let full = '';

  const es = new EventSource(url.toString());
  es.onmessage = e => {
    if (e.data === '[DONE]') { es.close(); enableInput(); return; }
    try { full += JSON.parse(e.data); msgDiv.textContent = full; scrollToBottom(); } catch {}
  };
  es.onerror = () => { es.close(); enableInput(); };
}
```

Markdown rendering for assistant messages: use `marked.parse()` from CDN `https://cdn.jsdelivr.net/npm/marked/marked.min.js`. Render into `innerHTML` of the assistant message div. Code blocks get `<pre><code>` with dark background.

---

### 3. Settings Route (view exists, route missing)

**Modify `routes/settings.ts`** (create if not exists):

`GET /settings`; renders `views/settings.ejs` with:
- `carinaApiUrl` (from env)
- `scoutUrl` (from env)
- `adminPasswordSet` (true if ADMIN_PASSWORD !== 'changeme')
- `skillAutoWrite` (from env SKILL_AUTO_WRITE)

`POST /settings/test-carina`; tries `GET /api/providers` from Carina. Returns `{ok, providers, active}` or `{ok:false, error}`.

`POST /settings/test-scout`; tries `GET /api/status` from Scout. Returns `{ok, instances}` or `{ok:false}`.

Mount in `server.ts`: `app.use('/settings', requireAdmin, settingsRouter);`

**Complete `views/settings.ejs`**; show:
- Connection status for Carina and Scout with "Test connection" buttons that POST via fetch
- Current env var values (read-only display, never show passwords)
- Warning if admin password is still 'changeme'
- SKILL_AUTO_WRITE toggle display

---

### 4. Add Security to navigation

**Modify `views/layout.ejs`**; add Security to nav links array:
```javascript
const links = [
  { href: '/', label: 'Dashboard', match: (p) => p === '/' },
  { href: '/security', label: 'Security', match: (p) => p.startsWith('/security') },
  { href: '/chat', label: 'Chat', match: (p) => p.startsWith('/chat') },
  { href: '/memories', label: 'Memories', match: (p) => p.startsWith('/memories') },
  { href: '/skills', label: 'Skills', match: (p) => p.startsWith('/skills') },
  { href: '/rag', label: 'RAG Corpus', match: (p) => p.startsWith('/rag') },
  { href: '/projects', label: 'Projects', match: (p) => p.startsWith('/projects') },
  { href: '/settings', label: 'Settings', match: (p) => p.startsWith('/settings') },
];
```

Also add a small Scout status indicator to the sidebar footer:
```html
<div id="scout-status" class="text-xs mt-1 flex items-center gap-1">
  <span id="scout-dot" class="inline-block w-2 h-2 rounded-full bg-gray-600"></span>
  <span id="scout-label" class="text-gray-600">Scout</span>
</div>
```
Ping `/security/stream` on page load. If Scout responds: dot green + label "Scout live". If not: dot red + "Scout offline".

---

### 5. TypeScript compile check

After all changes, run `node_modules/.bin/tsc --noEmit` in `ops.carinaai.uk/`. Fix all type errors. The `tsconfig.json` uses `NodeNext` module resolution.

Key type issues to watch for:
- `fetch()` is available in Node 22; no polyfill needed
- `AbortSignal.timeout()` is Node 18+; available
- EJS templates are not type-checked; don't try to type them

---

### 6. pnpm dev must work

After all changes, `pnpm dev` (which runs `tsx watch server.ts`) must start the server on port 4000 with no errors.

The root `core.carinaai.uk/package.json` has `"admin": "tsx ../ops.carinaai.uk/server.ts"`. This should also work when called from `core.carinaai.uk/`.

---

## .env.example final state

```
ADMIN_PASSWORD=changeme
SESSION_SECRET=generate-a-random-string-here
CARINA_DB_URL=postgresql://carina:secret@localhost:5433/carina_central
CARINA_API_URL=http://localhost:3333
SCOUT_URL=http://localhost:4444
SCOUT_API_KEY=
PORT=4000
```

---

## Verification checklist

After Cursor builds:
- [ ] `pnpm dev` starts without errors
- [ ] `node_modules/.bin/tsc --noEmit` passes clean
- [ ] `http://localhost:4000` → login page
- [ ] Login with ADMIN_PASSWORD → Dashboard shows real stats
- [ ] `/security` → Scout event stream shows "Offline" banner when Scout not running, live events when Scout is running
- [ ] `/security` kill button → sends kill to Scout, instance shows suspended
- [ ] `/chat` → messages stream from Carina in real time (requires Carina on :3333)
- [ ] `/chat` quick actions → prefill textarea
- [ ] `/memories` → list with session links, delete works
- [ ] `/skills` → list, create, edit, delete work
- [ ] `/rag` → corpus table shows chunks, re-ingest button SSEs output
- [ ] `/projects` → kanban board, add/edit/delete projects
- [ ] `/settings` → shows connection status, test buttons work
- [ ] All nav links active-state highlights correctly

---

## Complete file list (verify all exist and work after build)

```
ops.carinaai.uk/
├── server.ts                    Add: securityRouter, settingsRouter imports and mounts
├── lib/
│   ├── db.ts                    Keep as-is
│   ├── constants.ts             Keep as-is
│   ├── projects.ts              Keep as-is
│   └── scout.ts                 NEW; Scout HTTP proxy helper
├── middleware/auth.ts           Keep as-is
├── routes/
│   ├── auth.ts                  Keep as-is
│   ├── dashboard.ts             Keep as-is
│   ├── memories.ts              Keep as-is
│   ├── skills.ts                Keep as-is
│   ├── rag.ts                   Keep as-is
│   ├── chat.ts                  MODIFY; add provider proxy route
│   ├── projects.ts              Keep as-is
│   ├── security.ts              NEW; Scout proxy routes
│   └── settings.ts              NEW; settings + connection test routes
└── views/
    ├── layout.ejs               MODIFY; add Security + Settings nav, Scout indicator
    ├── login.ejs                Keep as-is
    ├── dashboard.ejs            Keep as-is
    ├── chat.ejs                 MODIFY; complete SSE streaming JS
    ├── security.ejs             NEW; Scout event stream + instance controls
    ├── settings.ejs             COMPLETE; add connection test UI
    ├── memories/                Keep as-is
    ├── skills/                  Keep as-is
    ├── rag.ejs                  Keep as-is
    └── projects.ejs             Keep as-is
```
