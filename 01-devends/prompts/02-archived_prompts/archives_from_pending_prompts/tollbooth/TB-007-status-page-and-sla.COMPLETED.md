# TB-007: Public Status Page and SLA Credit Automation

**Sprint:** Tollbooth platform infrastructure
**Phase:** 3 - Build the network effect
**Depends on:** TB-003 (health endpoint at `/api/v1/platform/health`)
**Target repo:** `02-backends/core.carinaai.uk` and new `status.carinaai.uk` static site
**Agent:** Claude Code

---

## Context

A tollbooth that closes for maintenance is not a toll booth. The moment partners
depend on Carina infrastructure for their own customer commitments, downtime has a
direct financial consequence for them.

`status.carinaai.uk` is the customer-visible commitment. Internally, a probing cron
job checks the health endpoint (TB-003), records the result in a `platform_health_checks`
table, and triggers SLA credit calculation when downtime breaches the 99.9% monthly
threshold (8.7 hours per 30-day period).

The SLA credit is a billing credit on the partner's next invoice. Not a refund; a
credit. Stripe supports this via `stripe.customers.createBalanceTransaction`.

---

## Task

### 1. Migration: health check log

In `src/api/hosted-migrations.ts`, add:

```sql
CREATE TABLE IF NOT EXISTS platform_health_checks (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  checked_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  endpoint    TEXT        NOT NULL,
  status_code INTEGER,
  latency_ms  INTEGER,
  healthy     BOOLEAN     NOT NULL,
  error       TEXT
);

CREATE INDEX IF NOT EXISTS idx_health_checks_time
  ON platform_health_checks (checked_at DESC);
```

Retain only 90 days of check data. Add a cron step to delete older rows:
```sql
DELETE FROM platform_health_checks WHERE checked_at < NOW() - INTERVAL '90 days'
```

Also add an `sla_credits` table:
```sql
CREATE TABLE IF NOT EXISTS sla_credits (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id      UUID        REFERENCES partner_accounts(id),
  billing_month   TEXT        NOT NULL,
  downtime_minutes INTEGER    NOT NULL,
  credit_pence    INTEGER     NOT NULL,
  stripe_credit_id TEXT,
  applied_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 2. Health probe service

Create `src/ops/health-probe.ts`:

```typescript
import { pool } from '../memory/db.js';

const PROBE_TARGETS = [
  { label: 'platform_api', url: 'https://api.carinaai.uk/api/v1/platform/health' },
  { label: 'core_api',     url: 'https://core.carinaai.uk/api/health' },
  { label: 'app_frontend', url: 'https://app.carinaai.uk/api/health' },
];

export async function runHealthProbe(): Promise<void> {
  for (const target of PROBE_TARGETS) {
    const start = Date.now();
    let statusCode: number | null = null;
    let healthy = false;
    let error: string | null = null;
    try {
      const res = await fetch(target.url, { signal: AbortSignal.timeout(5000) });
      statusCode = res.status;
      healthy = res.ok;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }
    const latencyMs = Date.now() - start;
    await pool.query(
      `INSERT INTO platform_health_checks
         (endpoint, status_code, latency_ms, healthy, error)
       VALUES ($1, $2, $3, $4, $5)`,
      [target.label, statusCode, latencyMs, healthy, error],
    );
  }
}
```

Register as an internal route `POST /internal/ops/health-probe` (behind `CARINA_OPS_TOKEN`).
Document the cron line in `SOP/009-cron-workflows.md`:
```
* * * * * curl -s -X POST https://core.carinaai.uk/internal/ops/health-probe \
  -H "Authorization: Bearer $CARINA_OPS_TOKEN"
```
(Every minute probe. The status page reads the last 90 days of this table.)

### 3. SLA calculation endpoint

Add `GET /internal/ops/sla-report?month=2026-06` (behind `CARINA_OPS_TOKEN`).

Logic:
1. Count total checks in the month for `endpoint = 'platform_api'`.
2. Count unhealthy checks in that month.
3. Calculate uptime %: `(total - unhealthy) / total * 100`
4. If uptime < 99.9%, downtime_minutes = `unhealthy * 1` (one check per minute).
5. Credit formula: GBP 5 per hour of downtime beyond the SLA threshold.
   (`credit_pence = max(0, downtime_minutes - 527) / 60 * 500`)
   (527 minutes = 8.77 hours = 99.9% of 30 days * 24 * 60)

Response:
```json
{
  "month": "2026-06",
  "totalChecks": 43200,
  "unhealthyChecks": 18,
  "uptimePercent": 99.958,
  "slaBreach": false,
  "downtimeMinutes": 18,
  "creditDuePartners": []
}
```

If `slaBreach: true`, return `creditDuePartners` as a list of all active partners
with their credit amounts. Applying the credits is a separate manual step.

### 4. Status page static site

Create `status.carinaai.uk/` as a new directory at the same level as `carinaai.uk/`
(the marketing site at `02-backends/core.carinaai.uk/carinaai.uk/`).

The status page is a single `index.html` that fetches from a public endpoint.

Add a public route (no auth): `GET /api/v1/platform/status`

Returns:
```json
{
  "services": [
    { "name": "Platform API",    "status": "operational",   "uptimePct": 99.97 },
    { "name": "Core API",        "status": "operational",   "uptimePct": 99.95 },
    { "name": "App Frontend",    "status": "operational",   "uptimePct": 99.99 }
  ],
  "sla": "99.9%",
  "checkedAt": "2026-06-26T14:30:00Z"
}
```

Compute from the last 30 days of `platform_health_checks`. Cache for 60 seconds
(in-memory, not Redis).

`status.carinaai.uk/index.html` is plain HTML + vanilla JS. No framework.
It calls `/api/v1/platform/status` and renders three service rows with a
green/yellow/red status indicator (plain text: `operational`, `degraded`, `outage`).
No external CDN. Inline all styles in `<style>` tags.

Add the nginx `server` block for `status.carinaai.uk` to `docker/nginx/carina-prod.conf`:
```nginx
server {
  listen 443 ssl;
  http2 on;
  server_name status.carinaai.uk;
  ssl_certificate     /etc/nginx/ssl/live/carinaai.uk/fullchain.pem;
  ssl_certificate_key /etc/nginx/ssl/live/carinaai.uk/privkey.pem;
  include /etc/nginx/conf.d/ssl-params.conf;
  ssl_dhparam         /etc/nginx/ssl/ssl-dhparams.pem;
  root /usr/share/nginx/html/status;
  index index.html;
  location /api/ {
    proxy_pass http://carina-core:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
  }
}
```

Copy `status.carinaai.uk/` into the Docker image at build time.

---

## What NOT to do

- Do not use a third-party status page service (Statuspage, Betterstack, Freshping).
  The status page is part of the platform and must be owned by VERLOX. External services
  create a dependency that can go down simultaneously with the platform.
- Do not automate SLA credit application. The `sla_credits` table records what is owed.
  A human applies the Stripe credit. Only automate this after it has run correctly
  manually for three consecutive months.
- Do not probe from the VPS itself. The probe must come from the cron environment that
  is separate from the Docker stack. If the whole VPS goes down, a probe running inside
  the VPS will show false positives. Use a separate lightweight cron on the ops machine.

---

## Done when

- [ ] `platform_health_checks` table created
- [ ] `sla_credits` table created
- [ ] `runHealthProbe()` inserts one row per target per invocation
- [ ] `GET /internal/ops/sla-report` returns correct uptime percentage
- [ ] SLA breach detection is accurate (test with mock unhealthy check data)
- [ ] `GET /api/v1/platform/status` returns correct service status (public, no auth)
- [ ] `status.carinaai.uk/index.html` renders service status from the API
- [ ] nginx server block for `status.carinaai.uk` added to `carina-prod.conf`
- [ ] Status page builds into Docker image correctly
- [ ] `pnpm build` compiles without TypeScript errors
