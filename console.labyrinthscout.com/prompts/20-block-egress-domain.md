# Prompt 20 - Block Egress Domain

Allow a Scout operator to block a specific external domain from Carina's HTTP tool at runtime,
without restarting the agent. Scout stores blocked domains in a Redis set, broadcasts a control
message, and Carina's egress filter checks operator-blocked domains in addition to its existing
static allowlist.

**Stack:** Node.js 22, TypeScript 5, Express 5, PostgreSQL 16, Redis 7 (ioredis). No PHP.

**Scout source root:** `console.labyrinthscout.com/src/`
**Carina source root:** `core.carinaai.uk/src/`

Existing infrastructure in place:
- `src/redis.ts` - `getRedis()` (shared client), `createSubscriber()` (dedicated subscriber)
- `src/db.ts` - `pool` for PostgreSQL queries
- `src/middleware/auth.ts` - `requireApiKey`
- `src/lib/instance-control.ts` - `publishControlMessage(payload)`
- `src/lib/constants.ts` - `CONTROL_CHANNEL = 'labyrinth:control'`
- `src/api/sse.ts` - `broadcastEvent()`, `refreshAndBroadcastStats()`
- `src/server.ts` - mounts all routers
- `src/types.ts` - `SecurityEventRow`, `Severity`
- Carina `src/security/kill-switch-listener.ts` - subscribes to `labyrinth:control`; handles `suspend`, `resume`, `block_session`, `quarantine_tool`, `lift_quarantine`
- Carina `src/security/egress-filter.ts` - `EgressFilter` class; `egressFilter` singleton; `isAllowed(url)` checks the static `allowedDomains` array; `checkRequest()` calls `isAllowed()` before scanning body
- Carina `src/tools/http.ts` - calls `filter.checkRequest(urlStr, body)` when Labyrinth is enabled; returns error objects rather than throwing for `EgressBlockedError`

---

## 1. Scout: new file `src/api/egress-control.ts`

Three endpoints on a single router. Mount at `/api/egress`.

### Domain validation helper

```typescript
const DOMAIN_RE = /^[a-z0-9]([a-z0-9\-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9\-]{0,61}[a-z0-9])?)+$/i;

function sanitiseDomain(raw: string): { ok: true; domain: string } | { ok: false; error: string } {
  let d = raw.trim().toLowerCase();
  // Strip protocol if accidentally included.
  d = d.replace(/^https?:\/\//, '');
  // Strip path, query, port.
  d = d.split('/')[0].split('?')[0].split('#')[0].split(':')[0];
  // Strip leading wildcard.
  if (d.startsWith('*.')) d = d.slice(2);
  if (!d || !DOMAIN_RE.test(d) || d.length > 253) {
    return { ok: false, error: 'Invalid domain. Provide a hostname without protocol, e.g. evil.com' };
  }
  return { ok: true, domain: d };
}
```

The stored and published domain is always the sanitised form (lowercase, no wildcard prefix,
no protocol). This makes lookup, listing, and matching unambiguous.

### POST /api/egress/block

Body: `{ domain: string, instance_id: string, reason: string }`

Steps:

1. Validate and sanitise `domain` using `sanitiseDomain`. Reject with 400 on failure.
2. Validate `instance_id`: non-empty string matching `/^[a-z0-9_-]+$/`, max 64 chars.
3. Validate `reason`: non-empty string, max 500 chars.
4. `SADD scout:egress:blocklist:{instance_id} {domain}` via `getRedis()`.
5. Publish control message via `publishControlMessage`:
   ```json
   {
     "action": "block_egress",
     "domain": "<sanitised-domain>",
     "instance_id": "<instance_id>",
     "reason": "<reason>",
     "timestamp": "<ISO 8601>"
   }
   ```
6. Insert security event (`severity:'warning'`, `event_type:'egress_domain_blocked'`,
   `source:'scout-api'`, `description:'Operator blocked domain: {domain}'`, `instance_id`,
   `metadata:{ domain, reason }`). Broadcast via `broadcastEvent()` and call `refreshAndBroadcastStats()`.
7. Return `{ ok: true, domain, instance_id }`.

### GET /api/egress/blocklist?instance_id=xxx

1. Validate `instance_id` query param as above.
2. `SMEMBERS scout:egress:blocklist:{instance_id}` via `getRedis()`.
   If Redis is unavailable, return `{ blocked: [] }` rather than 500.
3. Return `{ blocked: string[] }` sorted alphabetically.

### DELETE /api/egress/block/:domain?instance_id=xxx

1. Validate `domain` param using `sanitiseDomain`.
2. Validate `instance_id` query param.
3. `SREM scout:egress:blocklist:{instance_id} {domain}` via `getRedis()`.
4. Publish control message: `{ action:'unblock_egress', domain, instance_id, timestamp }`.
5. Insert security event (`severity:'info'`, `event_type:'egress_domain_unblocked'`,
   `source:'scout-api'`, `description:'Operator unblocked domain: {domain}'`).
6. Return `{ ok: true, domain, instance_id, status: 'unblocked' }`.

Full file skeleton:

```typescript
import { Router, type IRouter } from 'express';
import type { Request, Response } from 'express';
import { pool } from '../db.js';
import { getRedis } from '../redis.js';
import { publishControlMessage } from '../lib/instance-control.js';
import { broadcastEvent, refreshAndBroadcastStats } from '../api/sse.js';
import type { SecurityEventRow } from '../types.js';

export const egressControlRouter: IRouter = Router();

const BLOCKLIST_KEY = (instanceId: string) => `scout:egress:blocklist:${instanceId}`;

// sanitiseDomain, validateInstanceId helpers, insertEgressEvent helper, then:
// POST /api/egress/block
// GET  /api/egress/blocklist
// DELETE /api/egress/block/:domain
```

Implement each handler as a separate named async function assigned to the route, not an inline
arrow, to keep each handler body under 20 lines.

---

## 2. Scout: mount in `src/server.ts`

Add import:

```typescript
import { egressControlRouter } from './api/egress-control.js';
```

Mount after the `/api/quarantine` line:

```typescript
app.use('/api/egress', requireApiKey, egressControlRouter);
```

The existing CORS middleware already covers `GET`, `POST`, and `DELETE`. No change needed.

---

## 3. Carina: extend `src/security/kill-switch-listener.ts`

The module already handles `quarantine_tool` and `lift_quarantine`. Add egress blocking.

Add after the `quarantinedTools` Map declaration:

```typescript
// instance_id -> Set of operator-blocked domains (lowercase, no protocol)
// NOTE: This is in-memory only. If Carina restarts, Scout must re-publish
// or the operator must re-apply blocks from the dashboard.
const operatorBlockedDomains = new Map<string, Set<string>>();
```

Inside `applyControlPayload()`, add two new branches after the `lift_quarantine` branch:

```typescript
} else if (payload.action === 'block_egress') {
  const domain = payload.domain;
  const iid = typeof payload.instance_id === 'string' ? payload.instance_id : '';
  if (typeof domain === 'string' && domain && iid) {
    if (!operatorBlockedDomains.has(iid)) operatorBlockedDomains.set(iid, new Set());
    operatorBlockedDomains.get(iid)!.add(domain.toLowerCase());
    const logLine = `EGRESS BLOCKED: ${domain} on ${iid}. Reason: ${String(payload.reason ?? '')}`;
    console.warn(`[KillSwitch] ${logLine}`);
    appendLog(logLine);
  }
} else if (payload.action === 'unblock_egress') {
  const domain = payload.domain;
  const iid = typeof payload.instance_id === 'string' ? payload.instance_id : '';
  if (typeof domain === 'string' && domain && iid) {
    operatorBlockedDomains.get(iid)?.delete(domain.toLowerCase());
    const logLine = `EGRESS UNBLOCKED: ${domain} on ${iid}`;
    console.log(`[KillSwitch] ${logLine}`);
    appendLog(logLine);
  }
}
```

Add new export:

```typescript
export function isOperatorBlocked(instanceId: string, domain: string): boolean {
  return operatorBlockedDomains.get(instanceId)?.has(domain.toLowerCase()) ?? false;
}
```

Add test helper:

```typescript
export function _clearOperatorBlockedDomains(): void {
  operatorBlockedDomains.clear();
}
```

Export from `src/security/index.ts`:

```typescript
export {
  initKillSwitchListener,
  checkNotSuspended,
  isSuspended,
  isSessionBlocked,
  isToolQuarantined,
  isOperatorBlocked,   // add this
} from './kill-switch-listener.js';
```

---

## 4. Carina: modify `src/tools/http.ts`

The file already imports from `../security/egress-filter.js`. Add the new import:

```typescript
import { isOperatorBlocked } from '../security/index.js';
```

In the `execute` function, after the existing `isBlockedHost(parsed.hostname)` check (around
line 54-56) and before the call to `getEgressFilter()`, add:

```typescript
if (process.env.LABYRINTH_ENABLED === 'true') {
  const instanceId =
    process.env.SCOUT_INSTANCE_ID ??
    process.env.LABYRINTH_INSTANCE_ID ??
    'carina-local';
  if (isOperatorBlocked(instanceId, parsed.hostname)) {
    return {
      error: `Domain "${parsed.hostname}" is blocked by security policy.`,
    };
  }
}
```

Place this block after the `isBlockedHost` check so that internal-host protection still
fires first, and before the egress filter allowlist check so that operator blocks bypass
the allowlist entirely. This means an operator can block `api.openai.com` even though it
is in the default allowlist.

Also call `isOperatorBlocked` from `src/security/egress-filter.ts` `isAllowed()` if a
future refactor merges the two checks. For now, keep it in `http.ts` as described above.

---

## 5. Dashboard: `public/dashboard.html`

### 5a. CSS - add inside the `<style>` block near `.btn-kill`:

```css
.btn-add-blocklist {
  background: rgba(255,34,68,.08);
  border: 1px solid rgba(255,34,68,.25);
  color: var(--red);
  font-family: 'JetBrains Mono', monospace;
  font-size: .52rem;
  padding: .06rem .35rem;
  border-radius: 2px;
  cursor: pointer;
  letter-spacing: .06em;
  opacity: 0;
  transition: opacity .15s;
  flex-shrink: 0;
}
.ev-row:hover .btn-add-blocklist {
  opacity: 1;
}

/* Egress blocklist modal */
.egress-overlay {
  position: fixed; inset: 0; z-index: 1000;
  background: rgba(2,4,9,.85);
  display: flex; align-items: center; justify-content: center;
  backdrop-filter: blur(4px);
}
.egress-overlay[hidden] { display: none; }
.egress-box {
  background: var(--navy);
  border: 1px solid var(--amber);
  box-shadow: 0 0 40px rgba(212,175,55,.15);
  border-radius: 6px; padding: 1.5rem;
  width: min(480px, 92vw);
  max-height: 70vh;
  display: flex; flex-direction: column; gap: .75rem;
}
.egress-title {
  font-family: 'JetBrains Mono', monospace;
  font-size: .85rem; font-weight: 700;
  color: var(--amber); letter-spacing: .15em;
}
.egress-list {
  flex: 1; overflow-y: auto;
  display: flex; flex-direction: column; gap: .3rem;
}
.egress-item {
  display: flex; align-items: center; gap: .5rem;
  font-family: 'JetBrains Mono', monospace; font-size: .7rem;
  color: var(--bright);
}
.btn-unblock {
  background: rgba(0,200,150,.08);
  border: 1px solid rgba(0,200,150,.25);
  color: var(--green);
  font-size: .52rem; padding: .04rem .3rem;
  border-radius: 2px; cursor: pointer;
  font-family: 'JetBrains Mono', monospace;
}
.egress-empty {
  color: var(--text);
  font-family: 'JetBrains Mono', monospace;
  font-size: .7rem; text-align: center; padding: .75rem 0;
}
```

### 5b. HTML - add egress blocklist modal (before closing `</body>`)

```html
<div class="egress-overlay" id="egress-overlay" hidden>
  <div class="egress-box">
    <div style="display:flex;align-items:center;justify-content:space-between">
      <span class="egress-title">EGRESS BLOCKLIST</span>
      <button class="btn-cancel" onclick="closeEgressModal()">CLOSE</button>
    </div>
    <div class="egress-list" id="egress-list">
      <div class="egress-empty">Loading...</div>
    </div>
  </div>
</div>
```

Add a "BLOCKLIST" button to the instances bar alongside the existing kill/resume buttons:

```javascript
// Inside renderInstances(), for each instance chip:
const egressBtn = document.createElement('button');
egressBtn.className = 'btn-quarantine-toggle';  // reuse purple style
egressBtn.textContent = 'EGRESS';
egressBtn.title = 'View and manage egress domain blocklist';
egressBtn.onclick = () => void openEgressModal(inst.id);
chip.appendChild(egressBtn);
```

### 5c. JavaScript - egress modal and stream button functions

```javascript
let egressModalInstanceId = null;

async function openEgressModal(instanceId) {
  egressModalInstanceId = instanceId;
  document.getElementById('egress-overlay').removeAttribute('hidden');
  await refreshEgressList(instanceId);
}

function closeEgressModal() {
  document.getElementById('egress-overlay').setAttribute('hidden', '');
  egressModalInstanceId = null;
}

async function refreshEgressList(instanceId) {
  const list = document.getElementById('egress-list');
  try {
    const r = await fetch(
      `/api/egress/blocklist?instance_id=${encodeURIComponent(instanceId)}`,
      { headers: H() },
    );
    const d = await r.json();
    const domains = d.blocked || [];
    if (domains.length === 0) {
      list.innerHTML = '<div class="egress-empty">No domains blocked</div>';
      return;
    }
    list.innerHTML = '';
    for (const domain of domains) {
      const item = document.createElement('div');
      item.className = 'egress-item';
      const name = document.createElement('span');
      name.textContent = domain;
      name.style.flex = '1';
      const unblockBtn = document.createElement('button');
      unblockBtn.className = 'btn-unblock';
      unblockBtn.textContent = 'UNBLOCK';
      unblockBtn.onclick = () => void unblockDomain(domain, instanceId);
      item.appendChild(name);
      item.appendChild(unblockBtn);
      list.appendChild(item);
    }
  } catch {
    list.innerHTML = '<div class="egress-empty">Failed to load blocklist</div>';
  }
}

async function blockEgressDomain(domain, instanceId) {
  try {
    const r = await fetch('/api/egress/block', {
      method: 'POST',
      headers: H(),
      body: JSON.stringify({
        domain,
        instance_id: instanceId || 'carina-local',
        reason: 'Operator block from dashboard',
      }),
    });
    const d = await r.json();
    if (d.ok) {
      toast(`Blocked domain: ${d.domain}`, 'warning');
    } else {
      toast('Block failed: ' + (d.error || ''), 'critical');
    }
  } catch {
    toast('Block request failed (network error)', 'critical');
  }
}

async function unblockDomain(domain, instanceId) {
  try {
    const r = await fetch(
      `/api/egress/block/${encodeURIComponent(domain)}?instance_id=${encodeURIComponent(instanceId)}`,
      { method: 'DELETE', headers: H() },
    );
    const d = await r.json();
    if (d.ok) {
      toast(`Unblocked: ${domain}`, 'info');
      await refreshEgressList(instanceId);
    } else {
      toast('Unblock failed: ' + (d.error || ''), 'critical');
    }
  } catch {
    toast('Unblock request failed (network error)', 'critical');
  }
}
```

In `appendEvent(ev)`, detect `egress_blocked` events and show an "ADD TO BLOCKLIST" button.
Extract the domain from `ev.metadata.hostname` if present, otherwise parse `ev.description`:

```javascript
// Inside appendEvent(ev), after the existing BLOCK button logic from prompt 18:
if (ev.event_type === 'egress_blocked' || ev.event_type === 'egress_domain_blocked') {
  const domain = (ev.metadata && ev.metadata.hostname)
    ? String(ev.metadata.hostname)
    : extractDomainFromDescription(ev.description);

  if (domain) {
    const btn = document.createElement('button');
    btn.className = 'btn-add-blocklist';
    btn.textContent = 'BLOCK DOMAIN';
    btn.title = `Add ${domain} to operator blocklist`;
    btn.onclick = (e) => {
      e.stopPropagation();
      void blockEgressDomain(domain, ev.instance_id || 'carina-local');
    };
    row.appendChild(btn);
  }
}

function extractDomainFromDescription(desc) {
  // Matches "hostname 'foo.com'" from EgressBlockedError message.
  const m = desc && desc.match(/hostname '([^']+)'/);
  return m ? m[1] : null;
}
```

---

## Test cases

Write tests in `src/api/__tests__/egress-control.test.ts`.

**Test 1 - block a domain:**
`POST /api/egress/block` with `{ domain:'evil.com', instance_id:'carina-local', reason:'data exfil attempt' }`.
Expect 200, body `{ ok:true, domain:'evil.com', instance_id:'carina-local' }`.
Expect `SMEMBERS scout:egress:blocklist:carina-local` returns `['evil.com']`.
Expect `publishControlMessage` called with `action:'block_egress'`.

**Test 2 - protocol-prefixed input sanitised:**
`POST /api/egress/block` with `domain:'https://evil.com/path?q=1'`.
Expect 200 and stored domain `'evil.com'` (protocol, path, query stripped).

**Test 3 - GET blocklist:**
After test 1, `GET /api/egress/blocklist?instance_id=carina-local`.
Expect `{ blocked: ['evil.com'] }`.

**Test 4 - DELETE unblocks domain:**
`DELETE /api/egress/block/evil.com?instance_id=carina-local`.
Expect 200, `{ ok:true, domain:'evil.com', status:'unblocked' }`.
`GET` blocklist: expect empty array.
Expect `publishControlMessage` called with `action:'unblock_egress'`.

**Test 5 - Carina receives block_egress message:**
Call `_processControlMessage(JSON.stringify({ action:'block_egress', domain:'evil.com', instance_id:'carina-local', reason:'test' }))`.
Expect `isOperatorBlocked('carina-local', 'evil.com')` to be `true`.
Expect `isOperatorBlocked('carina-local', 'safe.com')` to be `false`.

**Test 6 - Carina receives unblock_egress message:**
Follow test 5. Call `_processControlMessage(JSON.stringify({ action:'unblock_egress', domain:'evil.com', instance_id:'carina-local' }))`.
Expect `isOperatorBlocked('carina-local', 'evil.com')` to be `false`.

**Test 7 - domain matching is case-insensitive:**
Block `Evil.COM`. Expect `isOperatorBlocked('carina-local', 'evil.com')` to be `true`.

**Test 8 - invalid domain rejected:**
`POST /api/egress/block` with `domain:'not a domain!'`. Expect 400.

---

## Coding standards

- All DB queries use parameterised placeholders. No string concatenation.
- All async Express handlers wrapped in try/catch; return 500 on unexpected errors.
- TypeScript strict mode. `unknown` over `any`; narrow with type guards before use.
- Redis key format: `scout:egress:blocklist:{instance_id}` - document as a typed helper function.
- `SMEMBERS` returns `string[]` from ioredis. Handle the `null` case if Redis is unavailable.
- `publishControlMessage` already handles Redis unavailability; no extra guard needed.
- The `sanitiseDomain` function must be pure (no side effects, no network calls) so it can
  be tested in isolation without mocking.
- Operator blocks take precedence over the static allowlist. Document this behaviour with a
  comment above the `isOperatorBlocked` check in `http.ts`.
- Functions under 20 lines; extract helpers (`buildQuarantinePanel`, `sanitiseDomain`,
  `insertEgressEvent`) to keep handlers minimal and readable.
- Never log full `reason` strings at `info` level; use `console.warn` for operator-action paths.
