# Prompt 07 - Egress Filter

Build the egress filter security module for Labyrinth Scout. This prevents the Carina agent from
making outbound HTTP requests to domains not on an allowlist, and scans outbound and inbound
request bodies for credential leakage before or after they transit the network.

**Stack:** Node.js 22, TypeScript 5, Express 5, PostgreSQL 16, Redis 7. No PHP.

**Repo root:** `/opt/lampp/htdocs/VERLOX/Carina-ai/`

**Scout lives at:** `labyrinthscout/src/`

**Carina lives at:** `src/`

---

## Files to create or modify

### 1. `labyrinthscout/src/security/egress-filter.ts` (new file)

Implement and export the `EgressFilter` class and two custom error classes.

#### Custom errors

```typescript
export class EgressBlockedError extends Error {
  constructor(public readonly url: string, public readonly hostname: string) {
    super(`Egress blocked: hostname '${hostname}' is not in the allowlist`);
    this.name = 'EgressBlockedError';
  }
}

export class DataLeakError extends Error {
  constructor(public readonly patternName: string) {
    super(`Data leak detected: pattern '${patternName}' found in request body`);
    this.name = 'DataLeakError';
  }
}
```

#### Domain allowlist

Read from environment variable `SCOUT_ALLOWED_DOMAINS` (comma-separated string). Merge with the
hardcoded defaults. Store the merged list as `string[]` on the class instance.

```typescript
const DEFAULT_ALLOWED_DOMAINS = [
  'api.search.brave.com',
  'api.openai.com',
  'api.anthropic.com',
  'api.deepseek.com',
  'api.resend.com',
  'api.telegram.org',
  'api.twilio.com',
  'api.propertydata.co.uk',
  'generativelanguage.googleapis.com',
  '*.carinaai.uk',
  '*.github.com',
  'github.com',
];
```

#### Sensitive data patterns

```typescript
const SENSITIVE_PATTERNS = [
  { pattern: /sk-[A-Za-z0-9]{48}/, name: 'openai_key' },
  { pattern: /sk-ant-api[0-9A-Za-z\-_]{100,}/, name: 'anthropic_key' },
  { pattern: /sk-[a-f0-9]{32}/, name: 'deepseek_key' },
  { pattern: /-----BEGIN (RSA|OPENSSH|PGP) PRIVATE KEY-----/, name: 'private_key' },
  { pattern: /ghp_[A-Za-z0-9]{36}/, name: 'github_token' },
  { pattern: /re_[A-Za-z0-9_]{32,}/, name: 'resend_key' },
  { pattern: /Authorization:\s*Bearer\s+[A-Za-z0-9._-]+/i, name: 'bearer_token' },
];
```

#### `EgressFilter` class

```typescript
export class EgressFilter {
  private readonly allowedDomains: string[];
  private readonly scoutBaseUrl: string | null;
  private readonly instanceId: string;

  constructor() {
    // Merge env domains with defaults; deduplicate
    // Read SCOUT_BASE_URL and SCOUT_INSTANCE_ID from env
    // SCOUT_INSTANCE_ID defaults to 'carina-local'
  }

  isAllowed(url: string): boolean {
    // Parse URL. If parsing throws, return false.
    // Extract hostname.
    // For each entry in allowedDomains:
    //   If entry starts with '*.' it is a wildcard:
    //     Check hostname === entry.slice(2) (bare domain match)
    //     OR hostname ends with '.' + entry.slice(2) (subdomain match)
    //   Otherwise: exact case-insensitive match
    // Return true if any entry matches, false otherwise.
  }

  async scanForSensitiveData(content: string): Promise<{ found: boolean; patternName?: string }> {
    // Test each SENSITIVE_PATTERNS entry against content.
    // Return { found: true, patternName: match.name } on first match.
    // Return { found: false } if none match.
  }

  async checkRequest(url: string, body?: string): Promise<void> {
    // 1. Call isAllowed(url). If false:
    //    - Call reportToScout('egress_blocked', 'critical', { url, hostname })
    //    - Throw EgressBlockedError(url, hostname)
    // 2. If body is provided:
    //    - Call scanForSensitiveData(body)
    //    - If found:
    //      - Call reportToScout('data_leak_outbound', 'critical', { patternName, url })
    //      - Throw DataLeakError(patternName)
  }

  async checkResponse(url: string, body: string): Promise<void> {
    // Scan body for sensitive patterns.
    // If found: call reportToScout('data_leak_inbound', 'critical', { patternName, url })
    // Do NOT throw - data already arrived. Just alert.
  }

  private async reportToScout(
    eventType: string,
    severity: string,
    meta: Record<string, unknown>
  ): Promise<void> {
    // If scoutBaseUrl is null, log to console.warn and return.
    // POST to ${scoutBaseUrl}/api/events with body:
    // {
    //   instance_id: this.instanceId,
    //   event_type: eventType,
    //   severity,
    //   description: JSON.stringify(meta),
    //   session_id: meta.sessionId ?? 'system',
    // }
    // Use fetch with a 3-second timeout (AbortController).
    // Catch all errors silently - reporting must never crash the agent.
  }
}

export const egressFilter = new EgressFilter();
```

---

### 2. `src/tools/http.ts` (modify existing file)

The existing `http-request` tool already has SSRF prevention. Add egress filter integration.

At the top of the file, add a conditional import:

```typescript
// Loaded lazily so the agent works without Labyrinth Scout installed
let _egressFilter: import('../../../labyrinthscout/src/security/egress-filter').EgressFilter | null = null;
const labyrinthEnabled = process.env.LABYRINTH_ENABLED === 'true';

async function getEgressFilter() {
  if (!labyrinthEnabled || _egressFilter !== null) return _egressFilter;
  try {
    const mod = await import('../../../labyrinthscout/src/security/egress-filter');
    _egressFilter = mod.egressFilter;
  } catch {
    // Scout not installed - silently skip
  }
  return _egressFilter;
}
```

Inside the tool handler, before the `fetch()` call, add:

```typescript
const filter = await getEgressFilter();
if (filter) {
  try {
    await filter.checkRequest(url, typeof body === 'string' ? body : JSON.stringify(body));
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'EgressBlockedError') {
      return { error: 'Request blocked by Labyrinth Egress Filter: domain not in allowlist' };
    }
    if (err instanceof Error && err.name === 'DataLeakError') {
      return { error: 'Request blocked: outbound body contains sensitive credentials' };
    }
    throw err;
  }
}
```

After the fetch completes and the response body is read, add:

```typescript
if (filter && typeof responseText === 'string') {
  // Fire-and-forget - do not await
  void filter.checkResponse(url, responseText);
}
```

---

### 3. `labyrinthscout/src/api/events.ts` (modify existing file)

Ensure the `security_events` table has an `event_type` column that stores the string passed in
`reportToScout`. The existing table likely already has this. If the column is missing, add it to
the migration in `labyrinthscout/src/db/migrations.ts`:

```sql
ALTER TABLE security_events ADD COLUMN IF NOT EXISTS event_type TEXT NOT NULL DEFAULT 'unknown';
CREATE INDEX IF NOT EXISTS idx_security_events_type_time
  ON security_events (event_type, created_at);
```

---

### 4. `labyrinthscout/src/dashboard/index.html` (modify existing file)

Add a small stat card below the existing stats row. Fetch count from:

`GET /api/stats/egress-blocked` - returns `{ count: number, window: '24h' }`

Add the endpoint in the Scout Express app:

```typescript
app.get('/api/stats/egress-blocked', async (req, res) => {
  const result = await pool.query(
    `SELECT COUNT(*) AS count FROM security_events
     WHERE event_type = 'egress_blocked'
       AND created_at > NOW() - INTERVAL '24 hours'`
  );
  res.json({ count: Number(result.rows[0].count), window: '24h' });
});
```

The dashboard card:

```html
<div class="stat-card">
  <div class="stat-label">Blocked Egress (24h)</div>
  <div class="stat-value" id="egress-blocked-count">--</div>
</div>
```

Fetch and populate in the existing dashboard JS polling loop.

---

## Environment variables (add to `.env.example` in both `labyrinthscout/` and root)

```
# Labyrinth Scout - Egress Filter
SCOUT_ALLOWED_DOMAINS=          # Optional extra domains, comma-separated
LABYRINTH_ENABLED=true          # Set false to disable all Scout integration
SCOUT_BASE_URL=http://localhost:4444
SCOUT_INSTANCE_ID=carina-local
```

---

## Test cases

Write these in `labyrinthscout/src/security/__tests__/egress-filter.test.ts` using Vitest.

```typescript
describe('EgressFilter.isAllowed', () => {
  it('allows exact match: api.openai.com', ...);
  it('blocks unlisted domain: evil.com', ...);
  it('allows wildcard subdomain: sub.carinaai.uk matches *.carinaai.uk', ...);
  it('allows bare wildcard root: carinaai.uk does NOT match *.carinaai.uk', ...);
  // Note: *.carinaai.uk should match subdomains, not the bare root
  it('allows github.com exact match', ...);
  it('allows sub.github.com via *.github.com wildcard', ...);
});

describe('EgressFilter.scanForSensitiveData', () => {
  it('detects OpenAI key pattern', ...);
  it('detects Anthropic key pattern', ...);
  it('detects GitHub token pattern', ...);
  it('returns found=false for clean content', ...);
});

describe('EgressFilter.checkRequest', () => {
  it('throws EgressBlockedError for blocked domain', ...);
  it('throws DataLeakError when body contains API key', ...);
  it('resolves without error for allowed domain and clean body', ...);
});

describe('EgressFilter.checkResponse', () => {
  it('does not throw even when private key found in response', ...);
  // (Assert reportToScout is called - stub it out)
});

describe('LABYRINTH_ENABLED=false', () => {
  it('http tool skips egress check when flag is false', ...);
});
```

---

## Acceptance criteria

- `egressFilter.isAllowed('https://evil.com/steal')` returns `false`
- `egressFilter.isAllowed('https://api.openai.com/v1/chat')` returns `true`
- `egressFilter.isAllowed('https://sub.carinaai.uk/api')` returns `true`
- `egressFilter.checkRequest(url, bodyWithKey)` throws `DataLeakError`
- `egressFilter.checkResponse(url, bodyWithKey)` resolves (does not throw)
- When `LABYRINTH_ENABLED=false`, the http tool skips all egress checks
- Scout events are posted to `/api/events` for each blocked or leaking request
- The dashboard stat card shows the 24h blocked egress count
- TypeScript strict mode: zero `any` types introduced
