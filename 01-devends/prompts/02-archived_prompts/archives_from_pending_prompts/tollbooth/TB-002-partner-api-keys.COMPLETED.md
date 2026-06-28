# TB-002: Partner Platform API Keys

**Sprint:** Tollbooth platform infrastructure
**Phase:** 1 - Instrument the road
**Depends on:** TB-001 (platform_events must exist)
**Blocks:** TB-003 (gateway auth uses these keys)
**Target repo:** `02-backends/core.carinaai.uk`
**Agent:** Claude Code

---

## Context

Carina's partner model requires that external parties authenticate using a scoped API key,
not via session cookies. The pattern for encrypted key storage already exists:
`byok_keys` table in `app.carinaai.uk` stores encrypted BYOK credentials using
AES-256-GCM with a key derived from `VAULT_SECRET`. The same pattern applies here.

`partner_accounts` table already exists (see `src/api/hosted-migrations.ts`).
`src/hosted/partner-service.ts` already has `createPartnerAccount`, `getPartnerAccount`,
`getPartnerForOrg`. This sprint adds the API key layer on top.

Key names must be prefixed `cpk_live_` for production and `cpk_test_` for test keys
(similar to how Stripe uses `sk_live_` / `sk_test_`).

---

## Task

### 1. Add the migration

In `src/api/hosted-migrations.ts`, add after the `platform_events` migration (TB-001):

```sql
CREATE TABLE IF NOT EXISTS partner_api_keys (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id        UUID        NOT NULL REFERENCES partner_accounts(id) ON DELETE CASCADE,
  label             TEXT        NOT NULL,
  key_prefix        TEXT        NOT NULL,
  key_hash          TEXT        NOT NULL UNIQUE,
  scopes            TEXT[]      NOT NULL DEFAULT '{}',
  rate_limit_rpm    INTEGER     NOT NULL DEFAULT 60,
  monthly_cap_events INTEGER    NOT NULL DEFAULT 100000,
  revenue_share_bps INTEGER     NOT NULL DEFAULT 50,
  status            TEXT        NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'revoked')),
  last_used_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_partner_api_keys_partner
  ON partner_api_keys (partner_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_partner_api_keys_prefix
  ON partner_api_keys (key_prefix);
```

Valid scope values (document as a comment):
`'session'`, `'memory'`, `'skills'`, `'analytics'`, `'admin'`

### 2. Create the key service

Create `src/hosted/partner-api-key-service.ts`:

```typescript
import crypto from 'crypto';
import { pool } from '../memory/db.js';

export interface PartnerApiKey {
  id: string;
  partnerId: string;
  label: string;
  keyPrefix: string;
  scopes: string[];
  rateLimitRpm: number;
  monthlyCapEvents: number;
  revenueSharBps: number;
  status: 'active' | 'revoked';
  lastUsedAt: string | null;
  createdAt: string;
}

export interface CreateKeyResult extends PartnerApiKey {
  rawKey: string; // Only returned once on creation. Never stored.
}

function generateKey(): { raw: string; prefix: string; hash: string } {
  const env = process.env.NODE_ENV === 'production' ? 'live' : 'test';
  const rand = crypto.randomBytes(24).toString('base64url');
  const raw = `cpk_${env}_${rand}`;
  const prefix = raw.slice(0, 16); // cpk_live_XXXXXXXX
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  return { raw, prefix, hash };
}

export async function createPartnerApiKey(input: {
  partnerId: string;
  label: string;
  scopes?: string[];
  rateLimitRpm?: number;
  monthlyCapEvents?: number;
  revenueSharBps?: number;
}): Promise<CreateKeyResult> {
  const { raw, prefix, hash } = generateKey();
  const result = await pool.query(
    `INSERT INTO partner_api_keys
       (partner_id, label, key_prefix, key_hash, scopes,
        rate_limit_rpm, monthly_cap_events, revenue_share_bps)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING *`,
    [
      input.partnerId,
      input.label,
      prefix,
      hash,
      input.scopes ?? ['session', 'memory', 'skills'],
      input.rateLimitRpm ?? 60,
      input.monthlyCapEvents ?? 100000,
      input.revenueSharBps ?? 50,
    ],
  );
  return { ...mapKeyRow(result.rows[0]), rawKey: raw };
}

export async function resolvePartnerApiKey(rawKey: string): Promise<PartnerApiKey | null> {
  const hash = crypto.createHash('sha256').update(rawKey).digest('hex');
  const result = await pool.query(
    `SELECT * FROM partner_api_keys WHERE key_hash = $1 AND status = 'active' LIMIT 1`,
    [hash],
  );
  if ((result.rowCount ?? 0) === 0) return null;
  // Touch last_used_at asynchronously
  void pool.query(
    `UPDATE partner_api_keys SET last_used_at = NOW() WHERE id = $1`,
    [result.rows[0].id],
  );
  return mapKeyRow(result.rows[0]);
}

export async function revokePartnerApiKey(keyId: string, partnerId: string): Promise<boolean> {
  const result = await pool.query(
    `UPDATE partner_api_keys
     SET status = 'revoked', revoked_at = NOW()
     WHERE id = $1 AND partner_id = $2 AND status = 'active'`,
    [keyId, partnerId],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function listPartnerApiKeys(partnerId: string): Promise<PartnerApiKey[]> {
  const result = await pool.query(
    `SELECT * FROM partner_api_keys WHERE partner_id = $1 ORDER BY created_at DESC`,
    [partnerId],
  );
  return result.rows.map(mapKeyRow);
}

function mapKeyRow(row: Record<string, unknown>): PartnerApiKey {
  return {
    id: String(row.id),
    partnerId: String(row.partner_id),
    label: String(row.label),
    keyPrefix: String(row.key_prefix),
    scopes: Array.isArray(row.scopes) ? (row.scopes as string[]) : [],
    rateLimitRpm: Number(row.rate_limit_rpm),
    monthlyCapEvents: Number(row.monthly_cap_events),
    revenueSharBps: Number(row.revenue_share_bps),
    status: String(row.status) as 'active' | 'revoked',
    lastUsedAt: row.last_used_at ? String(row.last_used_at) : null,
    createdAt: String(row.created_at),
  };
}
```

### 3. Admin API route for key management

In `src/api/carina-ops-routes.ts` (or an appropriate admin router file), add:

```
POST   /internal/partners/:partnerId/keys         createPartnerApiKey
GET    /internal/partners/:partnerId/keys         listPartnerApiKeys
DELETE /internal/partners/:partnerId/keys/:keyId  revokePartnerApiKey
```

These routes must require `CARINA_OPS_TOKEN` bearer auth (same as other internal routes).
The raw key is returned ONLY on the POST response and never stored anywhere in plaintext.

### 4. Rate limit middleware

Create `src/api/middleware/partner-rate-limit.ts`:

Use an in-memory Map keyed by `keyId` with a sliding window counter.
If `requestsInLastMinute >= rateLimitRpm`, return HTTP 429 with body:
`{ error: 'rate_limit_exceeded', limit: N, reset_at: ISO_DATE }`.

This is sufficient for a single-process deployment. A Redis-backed rate limiter
is the upgrade path when the gateway scales horizontally.

---

## Security requirements

- The raw key string is generated once and returned once. It must never be logged, stored,
  or sent in a response body beyond the initial creation response.
- `key_hash` is SHA-256 of the raw key. Only the hash is stored.
- `key_prefix` (first 16 characters) is stored for display in the partner dashboard
  so the partner can identify which key is which without exposing the full value.
- Revoked keys must not be deleted. Audit trails depend on the row remaining.
- Admin routes must enforce `CARINA_OPS_TOKEN`. Do not make them publicly accessible.

---

## Done when

- [ ] `partner_api_keys` table created by migration
- [ ] `createPartnerApiKey` returns `rawKey` in the response, hash is what is stored
- [ ] `resolvePartnerApiKey(rawKey)` returns the key record or null if revoked/not found
- [ ] `revokePartnerApiKey` sets `status = 'revoked'`, does not delete the row
- [ ] `listPartnerApiKeys` returns rows without `key_hash` field in the response
- [ ] Admin routes are behind `CARINA_OPS_TOKEN` auth
- [ ] Rate limit middleware rejects over-limit requests with 429
- [ ] `pnpm test` passes (unit test for `resolvePartnerApiKey` with mocked pool)
- [ ] `pnpm build` compiles without TypeScript errors
