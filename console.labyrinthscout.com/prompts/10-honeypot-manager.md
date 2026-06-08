# Prompt 10 - Honeypot Manager

Build the honeypot and deception layer for Labyrinth Scout. The system deploys fake credentials
and filesystem paths. Any read of those paths or use of those credentials triggers an immediate
breach-severity security event. Named after the creator's Master's distinction in deception
technology.

**Stack:** Node.js 22, TypeScript 5, Express 5, PostgreSQL 16, Redis 7. No PHP.

**Repo root:** `/opt/lampp/htdocs/VERLOX/Carina-ai/`

**Scout source:** `labyrinthscout/src/`

**Carina source:** `src/`

---

## Files to create or modify

### 1. `labyrinthscout/src/db/migrations.ts` (modify existing)

Add the honeypots table to the existing migration sequence. Run after all existing `CREATE TABLE`
statements:

```sql
CREATE TABLE IF NOT EXISTS honeypots (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  type             TEXT         NOT NULL CHECK (type IN ('api_key', 'file', 'endpoint')),
  name             TEXT         NOT NULL,
  value            TEXT         NOT NULL,
  description      TEXT,
  instance_id      TEXT         NOT NULL,
  triggered        BOOLEAN      NOT NULL DEFAULT FALSE,
  triggered_at     TIMESTAMPTZ,
  trigger_ip       TEXT,
  trigger_metadata JSONB        NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_honeypots_instance
  ON honeypots (instance_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_honeypots_value
  ON honeypots (value);
```

The index on `value` is intentional: `checkApiKey` and `checkFilePath` query by value, not id.

---

### 2. `labyrinthscout/src/security/honeypot-manager.ts` (new file)

Export the `HoneypotManager` class and the `Honeypot` type. Export a singleton instance at the
bottom of the file.

#### Type

```typescript
export interface Honeypot {
  id: string;
  type: 'api_key' | 'file' | 'endpoint';
  name: string;
  value: string;
  description: string | null;
  instanceId: string;
  triggered: boolean;
  triggeredAt: Date | null;
  triggerIp: string | null;
  triggerMetadata: Record<string, unknown>;
  createdAt: Date;
}
```

#### Class

```typescript
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { Pool } from 'pg';
import { alertDispatcher } from '../alerts/alert-dispatcher.js';

export class HoneypotManager {
  constructor(private readonly pool: Pool) {}

  async deployApiKeyHoneypot(
    instanceId: string,
    keyType: 'openai' | 'anthropic' | 'deepseek'
  ): Promise<Honeypot> { ... }

  async deployFileHoneypots(instanceId: string): Promise<Honeypot[]> { ... }

  async checkApiKey(key: string, meta?: Record<string, unknown>): Promise<boolean> { ... }

  async checkFilePath(filePath: string, meta?: Record<string, unknown>): Promise<boolean> { ... }

  async listHoneypots(instanceId: string): Promise<Honeypot[]> { ... }

  private generateFakeKey(keyType: 'openai' | 'anthropic' | 'deepseek'): string { ... }

  private async triggerHoneypot(
    honeypot: Honeypot,
    meta: Record<string, unknown>
  ): Promise<void> { ... }
}

export const honeypotManager = new HoneypotManager(pool);
```

#### `generateFakeKey` - exact formats

- `'openai'`: `'sk-lab-'` + 48 random alphanumeric chars (A-Z, a-z, 0-9).
- `'anthropic'`: `'sk-ant-api03-'` + 95 random chars from the set A-Z, a-z, 0-9, `-`, `_`.
- `'deepseek'`: `'sk-'` + 32 lowercase hex chars.

Use `crypto.randomBytes` as the entropy source. Do not use `Math.random`.

For alphanumeric: `crypto.randomBytes(n)` then map each byte to `alphabet[byte % alphabet.length]`.
For hex: `crypto.randomBytes(16).toString('hex')`.

#### `deployApiKeyHoneypot` implementation

1. Call `generateFakeKey(keyType)` to get the fake key string.
2. Build a name: `honeypot-${keyType}-${crypto.randomUUID().slice(0, 8)}`.
3. Build a description: `Fake ${keyType} API key deployed as honeypot for instance ${instanceId}`.
4. INSERT into honeypots table:
   ```sql
   INSERT INTO honeypots (type, name, value, description, instance_id)
   VALUES ('api_key', $1, $2, $3, $4)
   RETURNING *
   ```
5. Map the returned row to a `Honeypot` object (snake_case columns to camelCase fields).
6. Return the mapped object.

#### `deployFileHoneypots` implementation

Hardcoded target paths (relative paths resolved against `process.cwd()`):

```typescript
const HONEYPOT_PATHS = [
  '/tmp/.carina-backup.key',
  '/tmp/.env.backup',
  path.join(process.cwd(), 'data', '.api-keys.json'),
];
```

For each path:
1. Generate a fake file body. Use this template switcher:
   - If path ends in `.key`: write a PEM-like fake private key:
     ```
     -----BEGIN RSA PRIVATE KEY-----
     <48 random base64 chars per line, 16 lines>
     -----END RSA PRIVATE KEY-----
     ```
     Generate random bytes with `crypto.randomBytes(576)` then `toString('base64')` then split
     into 48-char lines.
   - If path ends in `.backup` or `.json`: write fake JSON:
     ```json
     {
       "OPENAI_API_KEY": "<fake openai key>",
       "ANTHROPIC_API_KEY": "<fake anthropic key>",
       "DEEPSEEK_API_KEY": "<fake deepseek key>"
     }
     ```
     Call `generateFakeKey` once per provider.
2. Write the file: `fs.mkdirSync(path.dirname(filePath), { recursive: true })` then
   `fs.writeFileSync(filePath, content, 'utf8')`.
3. INSERT one honeypots row per path:
   ```sql
   INSERT INTO honeypots (type, name, value, description, instance_id)
   VALUES ('file', $1, $2, $3, $4)
   RETURNING *
   ```
   Where `value` is the absolute path string, `name` is `path.basename(filePath)`.
4. Collect and return all created `Honeypot` records.

#### `triggerHoneypot` implementation

This is the shared trigger logic called by both `checkApiKey` and `checkFilePath`.

1. UPDATE the honeypots table:
   ```sql
   UPDATE honeypots
   SET triggered = TRUE,
       triggered_at = NOW(),
       trigger_ip = $1,
       trigger_metadata = $2
   WHERE id = $3
     AND triggered = FALSE
   ```
   Use `meta.ip as string | null` for `trigger_ip`. Use `JSON.stringify(meta)` for
   `trigger_metadata`. The `AND triggered = FALSE` guard prevents duplicate triggers on
   re-reads.

2. INSERT a security_events row:
   ```sql
   INSERT INTO security_events
     (instance_id, event_type, severity, metadata, created_at)
   VALUES
     ($1, 'honeypot_triggered', 'breach', $2, NOW())
   ```
   Metadata: `JSON.stringify({ honeypotId: honeypot.id, honeypotName: honeypot.name, type: honeypot.type, ...meta })`.
   Note: use severity value `'breach'` - add this to the CHECK constraint in migrations if the
   current constraint only allows info/warning/error/critical.

3. Call `await alertDispatcher.dispatch(...)` with:
   - `severity: 'critical'`
   - `title: 'Honeypot triggered'`
   - `body: 'Honeypot "${honeypot.name}" (${honeypot.type}) was accessed. Possible breach in progress.'`
   - `metadata: { honeypotId: honeypot.id, instanceId: honeypot.instanceId }`

4. Wrap all 3 steps in try/catch. Log errors with `console.error`. Never throw from this
   method - a trigger failure must not interfere with the caller.

#### `checkApiKey` implementation

1. Query:
   ```sql
   SELECT * FROM honeypots
   WHERE type = 'api_key' AND value = $1
   LIMIT 1
   ```
2. If no row: return `false`.
3. Map row to `Honeypot`. Call `await this.triggerHoneypot(honeypot, meta ?? {})`.
4. Return `true`.

#### `checkFilePath` implementation

Same pattern as `checkApiKey` but `type = 'file'` and match on `value = $1` where `$1` is the
absolute resolved path (`path.resolve(filePath)`). Return `true` if matched, `false` otherwise.

#### `listHoneypots` implementation

```sql
SELECT * FROM honeypots
WHERE instance_id = $1
ORDER BY created_at DESC
```

Map all rows to `Honeypot[]` and return.

---

### 3. `labyrinthscout/src/api/honeypots.ts` (new file)

Express router mounted at `/api/honeypots`.

#### `GET /api/honeypots`

Query param: `instance_id` (required). Validate X-Scout-Key header. Call
`honeypotManager.listHoneypots(instanceId)`. Return 200 `{ honeypots: Honeypot[] }`.

#### `POST /api/honeypots`

Body:
```typescript
{
  type: 'api_key' | 'file';
  instanceId: string;
  keyType?: 'openai' | 'anthropic' | 'deepseek';  // required when type === 'api_key'
}
```

Validate X-Scout-Key. Validate body fields. Branch:
- `type === 'api_key'`: validate `keyType` is one of the three values. Call
  `honeypotManager.deployApiKeyHoneypot(instanceId, keyType)`. Return 201
  `{ honeypot: Honeypot }`.
- `type === 'file'`: call `honeypotManager.deployFileHoneypots(instanceId)`. Return 201
  `{ honeypots: Honeypot[] }`.
- Unknown type: return 400 `{ error: 'Invalid type. Must be api_key or file.' }`.

#### `GET /api/honeypots/:id`

Validate X-Scout-Key. Query:
```sql
SELECT * FROM honeypots WHERE id = $1
```
Return 404 `{ error: 'Not found' }` if missing. Otherwise 200 `{ honeypot: Honeypot }`.

---

### 4. `src/tools/file.ts` (modify existing)

Add honeypot check before any file read. Use the same lazy-import pattern as the egress filter:

```typescript
let _honeypotManager: import('../../../labyrinthscout/src/security/honeypot-manager').HoneypotManager | null = null;
const labyrinthEnabled = process.env.LABYRINTH_ENABLED === 'true';

async function getHoneypotManager() {
  if (!labyrinthEnabled || _honeypotManager !== null) return _honeypotManager;
  try {
    const mod = await import('../../../labyrinthscout/src/security/honeypot-manager');
    _honeypotManager = mod.honeypotManager;
  } catch {
    // Scout not installed
  }
  return _honeypotManager;
}
```

In the read file handler, before opening the file:

```typescript
const hpm = await getHoneypotManager();
if (hpm) {
  const isHoneypot = await hpm.checkFilePath(
    path.resolve(filePath),
    { tool: 'file', sessionId: context?.sessionId }
  );
  if (isHoneypot) {
    return { error: '[Access Denied: This path is monitored by Labyrinth]' };
  }
}
```

The bracketed message prevents Carina from retrying with a different path.

---

### 5. `src/tools/http.ts` (modify existing)

Scan outbound Authorization headers for honeypot API keys. Add to the existing pre-request
block (after egress filter, before fetch):

```typescript
const authHeader = headers?.Authorization || headers?.authorization;
if (hpm && typeof authHeader === 'string') {
  const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  if (bearerMatch) {
    await hpm.checkApiKey(bearerMatch[1], { tool: 'http', url, sessionId: context?.sessionId });
  }
}
```

The check does not block the request - honeypot trigger is fire-and-alert. Blocking would tip
off an attacker that the key is monitored.

---

### 6. `labyrinthscout/src/dashboard/index.html` (modify existing)

Add a "Honeypots" section below the existing security events table.

**Honeypots table:**

```html
<section id="honeypots-section">
  <div class="section-header">
    <h2>Honeypots</h2>
    <button id="deploy-honeypot-btn" class="btn btn-secondary">Deploy New Honeypot</button>
  </div>
  <table id="honeypots-table">
    <thead>
      <tr>
        <th>Name</th>
        <th>Type</th>
        <th>Description</th>
        <th>Status</th>
        <th>Triggered At</th>
      </tr>
    </thead>
    <tbody id="honeypots-tbody"></tbody>
  </table>
</section>
```

**Deploy modal (inline HTML, hidden by default):**

```html
<dialog id="deploy-honeypot-dialog">
  <form method="dialog" id="deploy-honeypot-form">
    <h3>Deploy Honeypot</h3>
    <label>Type
      <select name="type" id="honeypot-type-select">
        <option value="api_key">API Key</option>
        <option value="file">File</option>
      </select>
    </label>
    <label id="key-type-label">Key Type
      <select name="keyType">
        <option value="openai">OpenAI</option>
        <option value="anthropic">Anthropic</option>
        <option value="deepseek">DeepSeek</option>
      </select>
    </label>
    <div class="dialog-actions">
      <button type="submit">Deploy</button>
      <button type="button" id="cancel-deploy-btn">Cancel</button>
    </div>
  </form>
</dialog>
```

**JavaScript (add to existing polling block):**

Fetch and render honeypots every 30 seconds alongside other stats. Triggered honeypots get
CSS class `honeypot-triggered` (style: red background, bold text). Non-triggered get class
`honeypot-safe` (green dot).

```javascript
async function fetchHoneypots() {
  const instanceId = getCurrentInstanceId();  // existing helper
  const res = await fetch(`/api/honeypots?instance_id=${instanceId}`, {
    headers: { 'X-Scout-Key': SCOUT_KEY }
  });
  const { honeypots } = await res.json();
  renderHoneypots(honeypots);
}

function renderHoneypots(honeypots) {
  const tbody = document.getElementById('honeypots-tbody');
  tbody.innerHTML = honeypots.map(h => `
    <tr class="${h.triggered ? 'honeypot-triggered' : 'honeypot-safe'}">
      <td>${escHtml(h.name)}</td>
      <td>${escHtml(h.type)}</td>
      <td>${escHtml(h.description ?? '')}</td>
      <td>${h.triggered ? 'TRIGGERED' : 'Waiting'}</td>
      <td>${h.triggeredAt ? new Date(h.triggeredAt).toLocaleString() : '-'}</td>
    </tr>
  `).join('');
}
```

Hide the `key-type-label` when `type === 'file'` (toggle via change event on the type select).
On form submit: POST `/api/honeypots` with body, re-fetch the list on success, close the dialog.

---

## Environment variables (no additions needed)

The honeypot manager uses the existing `DATABASE_URL`, `SCOUT_API_KEY`, and `LABYRINTH_ENABLED`
variables already defined in prior prompts.

---

## Test cases

Write in `labyrinthscout/src/security/__tests__/honeypot-manager.test.ts` using Vitest with a
mocked `Pool`.

**Test 1 - deployApiKeyHoneypot generates correct format:**
Call with `keyType: 'openai'`. Assert returned `value` matches `/^sk-lab-[A-Za-z0-9]{48}$/`.

**Test 2 - deployApiKeyHoneypot generates Anthropic format:**
Assert returned `value` matches `/^sk-ant-api03-[A-Za-z0-9_-]{95}$/`.

**Test 3 - deployApiKeyHoneypot generates DeepSeek format:**
Assert returned `value` matches `/^sk-[a-f0-9]{32}$/`.

**Test 4 - deployFileHoneypots creates files and DB rows:**
Mock `fs.writeFileSync`. Call `deployFileHoneypots('instance-1')`. Assert `writeFileSync` called
3 times. Assert pool.query called 3 times with `INSERT INTO honeypots`. Assert 3 Honeypot objects
returned.

**Test 5 - checkApiKey on a registered honeypot triggers it:**
Stub pool.query: first call (SELECT) returns one row, second call (UPDATE) returns `{ rowCount: 1 }`,
third call (INSERT security_events) succeeds. Stub alertDispatcher.dispatch. Call `checkApiKey('sk-lab-abc...')`.
Assert returns `true`. Assert alertDispatcher.dispatch called once.

**Test 6 - checkApiKey on unknown key returns false:**
Stub pool.query to return `{ rows: [] }`. Assert returns `false`. Assert alertDispatcher.dispatch
not called.

**Test 7 - checkFilePath on non-honeypot path returns false:**
Stub pool.query to return `{ rows: [] }`. Call with `/tmp/normal-file.txt`. Assert returns `false`.

**Test 8 - Carina file tool blocks read on honeypot path:**
Mock `honeypotManager.checkFilePath` to return `true`. Call the file tool handler with the
honeypot path. Assert return value contains `'Access Denied'`. Assert actual `fs.readFile` not
called.

**Test 9 - triggerHoneypot with triggered = TRUE already set:**
Stub pool.query UPDATE to return `{ rowCount: 0 }` (already triggered). Assert alertDispatcher
not called a second time (no double alert).

---

## Acceptance criteria

- `deployApiKeyHoneypot('inst', 'openai')` inserts a row and returns a Honeypot with the
  correct value format.
- `deployFileHoneypots('inst')` writes 3 files to disk and returns 3 Honeypot records.
- `checkApiKey(honeypotValue)` returns `true`, updates the DB row, creates a security_event
  with severity `'breach'`, and calls alertDispatcher.
- `checkFilePath('/tmp/.carina-backup.key')` returns `true` after that path is registered.
- `checkFilePath('/tmp/normal-file.txt')` returns `false` without hitting alertDispatcher.
- Carina file tool returns `'[Access Denied: This path is monitored by Labyrinth]'` for
  honeypot paths and does not read the file.
- Dashboard shows honeypot table; triggered rows are styled red with timestamp.
- TypeScript strict mode: zero `any` types.
