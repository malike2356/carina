# Sprint 7 - Prompt 04: Monitoring and Operational Maintenance

**Sprint:** 7 - Infrastructure
**Prompt number:** 04 of 04
**Name:** Health endpoints, uptime monitoring, Sentry error tracking, cron monitoring, migration safety, env inventory, secret rotation
**Primary agent:** Claude Code
**Estimated hours:** 6-8 h
**Depends on:** Nothing. Can build independently, though health endpoints slot cleanly into the deploy scripts from prompt 01.

---

## Post-build (MANDATORY)

When all "Done When" criteria below are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file.
2. Add a "**What was built:**" bullet list.
3. Move this file to `internal/prompts/archived_prompts/archives_from_pending_prompts/sprint-7/infra/`.

---

## Read First

1. All four `package.json` files - check if `@sentry/nextjs` or `@sentry/node` is already present
2. `backends/servers/core.carinaai.uk/src/aiva/cron-scheduler.ts` - the Aiva automations cron runner; it needs a heartbeat added
3. `frontends/client-apps/app.carinaai.uk/src/app/api/` - directory structure; health route goes here
4. `frontends/client-apps/admin.carinaai.uk/src/app/api/` - same for admin app

---

## Step 1: Health check endpoints

Each app needs a health endpoint that returns 200 when the app is running correctly and 503
when it cannot connect to critical dependencies. External uptime monitors poll these URLs.

**Core backend: `GET /health`**

```typescript
// src/health/health-router.ts
// No auth required - this route must be reachable without a token
// No rate limiting - uptime monitors poll every 30-60 seconds

router.get('/health', async (req, res) => {
  const checks: Record<string, 'ok' | 'fail'> = {};
  let healthy = true;

  // DB check - run a lightweight query
  try {
    await db.query('SELECT 1');
    checks.database = 'ok';
  } catch {
    checks.database = 'fail';
    healthy = false;
  }

  // Check backup freshness (warn if last backup > 25h ago)
  try {
    const epochFile = '/var/log/verlox/backup-last-success.epoch';
    const fs = await import('fs/promises');
    const epoch = parseInt(await fs.readFile(epochFile, 'utf8'), 10);
    const ageSeconds = Math.floor(Date.now() / 1000) - epoch;
    checks.backup = ageSeconds < 90000 ? 'ok' : 'warn';
  } catch {
    checks.backup = 'unknown';
  }

  // Check PM2 cron scheduler is running (presence check via a sentinel file written by cron)
  try {
    const fs = await import('fs/promises');
    const epoch = parseInt(
      await fs.readFile('/var/log/verlox/cron-heartbeat.epoch', 'utf8'), 10
    );
    const ageSeconds = Math.floor(Date.now() / 1000) - epoch;
    // Cron heartbeat should write every 5 minutes; warn if > 10 minutes stale
    checks.cron_scheduler = ageSeconds < 600 ? 'ok' : 'warn';
  } catch {
    checks.cron_scheduler = 'unknown';
  }

  const status = healthy ? 'ok' : 'degraded';
  return res.status(healthy ? 200 : 503).json({
    status,
    version: process.env.npm_package_version || 'unknown',
    timestamp: new Date().toISOString(),
    checks,
  });
});
```

Mount at the root of the core Express/Hono app before any auth middleware:
```typescript
app.use('/health', healthRouter);
```

**Next.js workspace app: `GET /api/health`**

Create `src/app/api/health/route.ts`:

```typescript
import { NextResponse } from 'next/server';

export async function GET() {
  const checks: Record<string, string> = {};
  let healthy = true;

  // Check that the core backend is reachable
  try {
    const res = await fetch(`${process.env.CARINA_CORE_URL}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    checks.core_api = res.ok ? 'ok' : 'degraded';
    if (!res.ok) healthy = false;
  } catch {
    checks.core_api = 'fail';
    healthy = false;
  }

  return NextResponse.json(
    {
      status: healthy ? 'ok' : 'degraded',
      version: process.env.npm_package_version || 'unknown',
      timestamp: new Date().toISOString(),
      checks,
    },
    { status: healthy ? 200 : 503 }
  );
}
```

**Next.js admin app: `GET /api/health`**

Same file at `frontends/client-apps/admin.carinaai.uk/src/app/api/health/route.ts`.
Same implementation as workspace app but checks `ADMIN_CORE_URL`.

The health endpoint must NOT be protected by admin session middleware. Add an explicit exclusion
in the admin middleware:
```typescript
// In middleware.ts
if (req.nextUrl.pathname === '/api/health') {
  return NextResponse.next();
}
```

---

## Step 2: Uptime monitoring configuration

Use UptimeRobot (free tier supports 50 monitors, 5-minute check interval).
Create an account at uptimerobot.com and configure the following monitors:

Document in `infrastructure/UPTIME-MONITORS.md`:

```markdown
# UptimeRobot Monitor Configuration

Create these monitors at uptimerobot.com. Alert contact: lordsesame@gmail.com

| Monitor name        | Type  | URL                                         | Check interval | Alert threshold |
|---------------------|-------|---------------------------------------------|---------------|-----------------|
| Carina Core API     | HTTPS | https://core.carinaai.uk/health             | 5 min         | 2 failures      |
| Carina App          | HTTPS | https://app.carinaai.uk/api/health          | 5 min         | 2 failures      |
| Carina Admin        | HTTPS | https://admin.carinaai.uk/api/health        | 5 min         | 2 failures      |
| Hire Page           | HTTPS | https://carinaai.uk/aiva/                   | 5 min         | 2 failures      |

Expected responses:
  Core API health: HTTP 200, JSON body contains "status":"ok"
  App health: HTTP 200, JSON body contains "status":"ok"
  Admin health: HTTP 200 from allowlisted IP (UptimeRobot checks from fixed IPs - add UptimeRobot IPs to admin allowlist)
  Hire page: HTTP 200, HTML content-type

UptimeRobot fixed check IPs (add to admin.carinaai.uk Nginx geo block):
  216.144.248.16  -- UptimeRobot probe
  216.144.248.17
  See https://uptimerobot.com/help/locations/ for full list

Alerting: email alert to lordsesame@gmail.com on 2 consecutive failures.
           Email on recovery too (not just on-down alert).

Status page: create a public status page at status.carinaai.uk (UptimeRobot provides this as a hosted page).
```

**Important:** UptimeRobot probes the admin app from fixed IP addresses. Add those IPs to the
Nginx IP allowlist in prompt 02 so the health check is not blocked by the geo restriction.

---

## Step 3: Sentry error tracking

Install in all three apps:

```bash
# Core backend
cd backends/servers/core.carinaai.uk
npm install @sentry/node @sentry/profiling-node

# Workspace app
cd frontends/client-apps/app.carinaai.uk
npx @sentry/wizard@latest -i nextjs

# Admin app
cd frontends/client-apps/admin.carinaai.uk
npx @sentry/wizard@latest -i nextjs
```

The `@sentry/wizard` for Next.js apps creates `sentry.client.config.ts`, `sentry.server.config.ts`,
and `sentry.edge.config.ts` automatically. Review the generated files; they are correct by default.

**Core backend Sentry init** (`src/server.ts`, before anything else):

```typescript
import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

Sentry.init({
  dsn: process.env.SENTRY_DSN_CORE,
  environment: process.env.NODE_ENV,
  integrations: [nodeProfilingIntegration()],
  tracesSampleRate: 0.1,   // 10% of requests traced - adjust based on volume
  profilesSampleRate: 0.1,
  // Do not send PII - Stripe customer data, email addresses, conversation content
  beforeSend(event) {
    // Strip any request bodies from error events to avoid logging PII
    if (event.request) {
      delete event.request.data;
      delete event.request.cookies;
    }
    return event;
  },
});

// Express error handler - add AFTER all routes
app.use(Sentry.expressErrorHandler());
```

**Sentry project structure:** Create three separate Sentry projects (one per app) so alerts
are scoped. A core API error should not trigger in the app project. Create projects:
- `carina-core` (Node.js)
- `carina-app` (Next.js)
- `carina-admin` (Next.js)

**Environment variables to add** (to each app's `.env.example` and VPS `.env` files):
```env
SENTRY_DSN_CORE=          # from Sentry project settings
SENTRY_DSN_APP=           # from Sentry project settings
SENTRY_DSN_ADMIN=         # from Sentry project settings
SENTRY_AUTH_TOKEN=        # for source map uploads during build
```

**Source map upload:** The `@sentry/wizard` configures this in `next.config.ts` automatically
for Next.js apps. For core backend, add to the build step in `deploy-core.sh`:
```bash
# Upload source maps to Sentry after build
npx @sentry/cli sourcemaps upload dist/ \
  --auth-token "$SENTRY_AUTH_TOKEN" \
  --project carina-core \
  --org verlox
```

**Alert configuration in Sentry:**
- Alert on first occurrence of any new issue
- Alert on spike (>10 errors in 1 hour)
- Alert channel: email (lordsesame@gmail.com)
- Ignore: 404 errors on the hire page (expected from bots)

---

## Step 4: PM2 log management

PM2 accumulates log files in `/var/www/*/shared/logs/`. Without rotation these grow unbounded.

Install PM2 log rotate:
```bash
pm2 install pm2-logrotate
```

Configure:
```bash
pm2 set pm2-logrotate:max_size 50M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
pm2 set pm2-logrotate:dateFormat YYYY-MM-DD_HH-mm-ss
pm2 set pm2-logrotate:rotateInterval '0 0 * * *'
```

This keeps 7 days of logs per process, compresses old files, and rotates daily. After 7 days
logs are deleted automatically.

Also configure system logrotate for `/var/log/verlox/`:

Create `/etc/logrotate.d/verlox`:
```
/var/log/verlox/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    create 0640 root adm
}
```

---

## Step 5: Aiva automation cron heartbeat

The Aiva automations scheduler in `cron-scheduler.ts` runs as a long-running background process
inside the core backend. If PM2 restarts the core process, the scheduler restarts automatically,
but there is no external signal that it is actually running and firing jobs.

**Heartbeat mechanism:**

In `cron-scheduler.ts`, add a heartbeat job that runs every 5 minutes:

```typescript
// After all automation jobs are registered, add a heartbeat job
import { writeFileSync } from 'fs';

cron.schedule('*/5 * * * *', () => {
  try {
    writeFileSync('/var/log/verlox/cron-heartbeat.epoch', String(Math.floor(Date.now() / 1000)));
  } catch {
    // Non-fatal: heartbeat write failure does not stop the scheduler
  }
});
```

The core health endpoint (Step 1) reads this file and reports `cron_scheduler: 'warn'` if the
file is more than 10 minutes old. UptimeRobot sees the health check degraded and fires an alert.

**Missed job detection:**

In `cron-scheduler.ts`, wrap each job execution in a try/catch that logs to `ai_worker_automations`:

```typescript
try {
  await runAutomation(automation);
  await db.query(
    'UPDATE ai_worker_automations SET last_run_at = NOW(), last_run_status = $1 WHERE id = $2',
    ['success', automation.id]
  );
} catch (err) {
  await db.query(
    'UPDATE ai_worker_automations SET last_run_at = NOW(), last_run_status = $1, last_run_error = $2 WHERE id = $3',
    ['failed', String(err), automation.id]
  );
  // Report to Scout as a warning event
  await scout.reportEvent({
    agentId: automation.worker_id,
    eventType: 'automation_failed',
    severity: 'warning',
    summary: `Automation "${automation.name}" failed: ${String(err)}`,
    metadata: { automationId: automation.id, scheduleLabel: automation.schedule_label },
    timestamp: new Date().toISOString(),
  });
}
```

Add `last_run_status TEXT` and `last_run_error TEXT` columns to `ai_worker_automations`:
```sql
ALTER TABLE ai_worker_automations ADD COLUMN IF NOT EXISTS last_run_status TEXT;
ALTER TABLE ai_worker_automations ADD COLUMN IF NOT EXISTS last_run_error TEXT;
```

This makes failed automations visible in the Scout signal feed and in the admin fleet dashboard.

---

## Step 6: Database migration safety procedure

Document in `infrastructure/MIGRATION-PROCEDURE.md` and enforce as a code review checklist:

```markdown
# Database Migration Safety Procedure

## Rules for all migration files

1. Every migration file must be idempotent.
   - Use `IF NOT EXISTS` on every CREATE TABLE and CREATE INDEX
   - Use `ADD COLUMN IF NOT EXISTS` on every ALTER TABLE
   - Use `ON CONFLICT DO NOTHING` on seed data INSERTs
   - A migration that is re-run must not error and must not corrupt data

2. Every migration file must have a corresponding rollback file.
   - If the migration file is `009-aiva-admin.sql`, create `009-aiva-admin-rollback.sql`
   - The rollback drops only what the forward migration added
   - Rollback files are never run automatically; they are manual recovery tools

3. Migration files are numbered sequentially and must never be renumbered.
   - 009 stays 009 forever; do not rename or reorder

## Deployment procedure for migrations

1. Test on staging:
   a. Copy the migration file to the staging DB server
   b. psql -U [user] -d [staging_db] -f [migration_file]
   c. Run the application against staging and verify functionality
   d. If the migration fails on staging, fix it before touching production

2. Take a backup:
   /opt/verlox/scripts/backup-postgres.sh
   (even if the scheduled backup ran recently, take a fresh one before a migration)

3. Run the migration on production:
   psql -U [user] -d [production_db] -f [migration_file]

4. Verify the schema:
   psql -U [user] -d [production_db] -c '\d [affected_table]'

5. Deploy the application:
   ./infrastructure/scripts/deploy-core.sh

6. Run the health check:
   curl https://core.carinaai.uk/health

7. If anything is wrong: rollback the application first (deploy-core.sh --rollback),
   then assess whether the DB rollback is also needed.

## Rollback a migration

Only roll back a migration if the data has not been written to by the new schema yet.
If new data has been written in the new schema format, rolling back the schema will corrupt it.
In that case, fix the application to tolerate the new schema rather than rolling back the schema.

To roll back:
  psql -U [user] -d [production_db] -f [migration_rollback_file]
```

---

## Step 7: Environment variable inventory

Create `infrastructure/ENV-INVENTORY.md` (committed to the repo; contains no secret values,
only variable names, descriptions, and which app uses them):

```markdown
# Environment Variable Inventory

Last updated: 2026-06-23

## core.carinaai.uk

| Variable | Description | Secret | Required |
|----------|-------------|--------|----------|
| DATABASE_URL | PostgreSQL connection string | yes | yes |
| POSTGRES_DB | Database name (used by backup scripts) | no | yes |
| POSTGRES_USER | Database user | yes | yes |
| PORT | HTTP port (default 4000) | no | no |
| NODE_ENV | production / development | no | yes |
| STRIPE_SECRET_KEY | Stripe secret API key | yes | yes |
| STRIPE_WEBHOOK_SECRET | Stripe webhook signing secret | yes | yes |
| STRIPE_PRICE_AIVA_STARTER_MONTHLY | Price ID | no | yes |
| STRIPE_PRICE_AIVA_STARTER_ANNUAL | Price ID | no | yes |
| STRIPE_PRICE_AIVA_TEAM_MONTHLY | Price ID | no | yes |
| STRIPE_PRICE_AIVA_TEAM_ANNUAL | Price ID | no | yes |
| STRIPE_PRICE_AIVA_BUSINESS_MONTHLY | Price ID | no | yes |
| STRIPE_PRICE_AIVA_BUSINESS_ANNUAL | Price ID | no | yes |
| AIVA_BILLING_ENABLED | Feature flag - 'true' to enable billing enforcement | no | yes |
| AIVA_GRACE_PERIOD_DAYS | Days before suspension after payment failure (default 7) | no | no |
| SCOUT_BASE_URL | Scout API base URL | no | yes |
| SCOUT_API_KEY | Scout API key | yes | yes |
| SCOUT_OPS_TOKEN | Token for Scout to call back /api/aiva/workers/:id/analytics | yes | yes |
| AIVA_SCOUT_FLEET_ENABLED | Feature flag - 'true' to enable Scout registration | no | yes |
| AIVA_CHAIN_ATTEST_ENABLED | Feature flag - 'true' to enable blockchain attestation | no | yes |
| CHAIN_EXPLORER_URL | Block explorer base URL for attestation links | no | no |
| ADMIN_TOKEN_SECRET | Secret for signing X-Admin-Token JWTs | yes | yes |
| ADMIN_SETUP_TOKEN | Pre-shared secret for the /api/admin/auth/check route | yes | yes |
| APP_URL | Public URL of app.carinaai.uk (for constructing URLs) | no | yes |
| SENTRY_DSN_CORE | Sentry DSN for core backend | yes | no |
| SENTRY_AUTH_TOKEN | Sentry auth token for source map uploads | yes | no |
| ANTHROPIC_API_KEY | Anthropic API key for Aiva brain | yes | yes |
| OPENAI_API_KEY | OpenAI API key (fallback / transcription) | yes | no |

## app.carinaai.uk

| Variable | Description | Secret | Required |
|----------|-------------|--------|----------|
| CARINA_CORE_URL | Internal URL of core backend | no | yes |
| SESSION_SECRET | iron-session signing secret (min 32 chars) | yes | yes |
| NEXTAUTH_SECRET | NextAuth signing secret if used | yes | conditional |
| NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY | Stripe publishable key (client-visible) | no | yes |
| NEXT_PUBLIC_APP_URL | Public URL of this app | no | yes |
| NEXT_PUBLIC_LANDING_URL | Public URL of marketing site | no | yes |
| NEXT_PUBLIC_SCOUT_FLEET_URL | Scout fleet manager URL for "View in Scout" links | no | no |
| SENTRY_DSN_APP | Sentry DSN for this app | yes | no |
| SENTRY_AUTH_TOKEN | Sentry auth token for source map uploads | yes | no |

## admin.carinaai.uk

| Variable | Description | Secret | Required |
|----------|-------------|--------|----------|
| ADMIN_CORE_URL | Internal URL of core backend (use 127.0.0.1, not public domain) | no | yes |
| ADMIN_SESSION_SECRET | iron-session signing secret (separate from app.carinaai.uk) | yes | yes |
| ADMIN_TOKEN_SECRET | Must match the same variable in core.carinaai.uk | yes | yes |
| ADMIN_SETUP_TOKEN | Must match the same variable in core.carinaai.uk | yes | yes |
| NEXT_PUBLIC_APP_URL | Public URL of this app | no | yes |
| SENTRY_DSN_ADMIN | Sentry DSN for admin app | yes | no |
| SENTRY_AUTH_TOKEN | Sentry auth token for source map uploads | yes | no |
```

---

## Step 8: Secret rotation procedure

Document in `infrastructure/SECRET-ROTATION.md`:

```markdown
# Secret Rotation Procedure

## When to rotate

- Immediately: if a secret is accidentally committed to git, logged, or shared
- Annually: SESSION_SECRET, ADMIN_SESSION_SECRET, ADMIN_TOKEN_SECRET, ADMIN_SETUP_TOKEN
- On team member departure: ADMIN_SETUP_TOKEN and any shared credentials
- On Stripe recommendation: STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET

## How to rotate

### SESSION_SECRET / ADMIN_SESSION_SECRET

1. Generate new secret: openssl rand -base64 48
2. Update in VPS .env files
3. Redeploy the affected app (deploy-app.sh or deploy-admin.sh)
4. Effect: all existing sessions are invalidated immediately. Users are logged out.
   For the admin app this is acceptable. For the workspace app, schedule during low-traffic hours.

### ADMIN_TOKEN_SECRET / ADMIN_SETUP_TOKEN

1. Generate new secret: openssl rand -base64 48
2. Update in BOTH core.carinaai.uk and admin.carinaai.uk .env files
3. Redeploy core first, then admin
4. Effect: any admin sessions issued before the rotation are invalidated.

### STRIPE_WEBHOOK_SECRET

1. Go to Stripe Dashboard -> Developers -> Webhooks -> [endpoint] -> Reveal signing secret
2. Click "Roll secret" in Stripe Dashboard
3. Update STRIPE_WEBHOOK_SECRET in core.carinaai.uk .env
4. Redeploy core
5. During the 72-hour transition window Stripe accepts both old and new secrets.
   Redeploy must happen within that window.

### ANTHROPIC_API_KEY

1. Generate new key at console.anthropic.com
2. Update in core.carinaai.uk .env
3. Redeploy core
4. Revoke the old key at console.anthropic.com after confirming the new key works

### SCOUT_OPS_TOKEN / SCOUT_API_KEY

1. Regenerate in Scout admin panel
2. Update in core.carinaai.uk .env
3. Redeploy core

## After any rotation

1. Verify health check: curl https://core.carinaai.uk/health
2. Check Sentry for a spike in errors (failed auth, failed Stripe events, etc.)
3. Update the "Last rotated" column in this document
```

---

## Step 9: Dependency update schedule

Document in `infrastructure/MAINTENANCE-SCHEDULE.md`:

```markdown
# Maintenance Schedule

## Weekly (Monday)

- Review PM2 logs for recurring warnings: `pm2 logs --lines 100 --nostream`
- Check Sentry for new issues opened in the last 7 days
- Check UptimeRobot for any downtime events
- Verify backup-last-success.epoch is fresh: stat /var/log/verlox/backup-last-success.epoch

## Monthly (first Monday)

- npm audit on all three apps; patch any high/critical vulnerabilities
- Review and clear resolved Sentry issues
- Check disk usage on VPS: df -h; clean up if > 70%
- Check Backblaze storage usage; adjust retention if needed
- Review failed automations in admin fleet dashboard
- Verify UptimeRobot monitors are all active and alerting correctly

## Quarterly

- Rotate SESSION_SECRET and ADMIN_SESSION_SECRET (schedule during low-traffic Sunday night)
- Review and update the admin IP allowlist (ADMIN-IP-ALLOWLIST.md)
- Review open aiva_escalations older than 30 days and resolve or close them
- Run: npm outdated in all three apps; update non-breaking minor versions
- Review Stripe dashboard for any declined webhooks or failed deliveries

## Annually

- Rotate all secrets per SECRET-ROTATION.md
- Review and renew any API keys with expiry dates (check each provider)
- Security review: re-run `npm audit`, check for new CVEs in direct dependencies
- Review Nginx TLS cipher list against current Mozilla SSL Configuration Generator recommendations
```

---

## Done When

- [ ] `GET /health` on core backend returns JSON with `status`, `version`, `timestamp`, `checks` including database, backup, and cron_scheduler
- [ ] `GET /api/health` on app.carinaai.uk returns 200 when core is reachable, 503 when not
- [ ] `GET /api/health` on admin.carinaai.uk returns 200; not protected by admin session middleware
- [ ] UptimeRobot monitors documented in `infrastructure/UPTIME-MONITORS.md`; UptimeRobot probe IPs added to admin Nginx geo block
- [ ] `@sentry/node` installed and initialized in core; errors captured and sent to Sentry
- [ ] `@sentry/nextjs` installed and initialized in app.carinaai.uk via wizard
- [ ] `@sentry/nextjs` installed and initialized in admin.carinaai.uk via wizard
- [ ] Source maps uploaded to Sentry during core build step
- [ ] Sentry alert configured for new issues and error spikes
- [ ] PII (request bodies, cookies) stripped from Sentry events in `beforeSend`
- [ ] `pm2-logrotate` installed; configured for 50M max, 7-day retain, daily rotation
- [ ] `/etc/logrotate.d/verlox` configured for `/var/log/verlox/*.log`
- [ ] Cron heartbeat job in `cron-scheduler.ts` writes `/var/log/verlox/cron-heartbeat.epoch` every 5 minutes
- [ ] Health endpoint reports `cron_scheduler: 'warn'` when heartbeat is > 10 minutes stale
- [ ] `last_run_status` and `last_run_error` columns on `ai_worker_automations`
- [ ] Failed automation execution reports to Scout as `automation_failed` warning event
- [ ] `infrastructure/MIGRATION-PROCEDURE.md` exists with rules and deployment steps
- [ ] All existing migration files reviewed for idempotency; non-idempotent statements fixed
- [ ] `infrastructure/ENV-INVENTORY.md` lists all env vars for all three apps
- [ ] `infrastructure/SECRET-ROTATION.md` documents rotation procedure for every secret type
- [ ] `infrastructure/MAINTENANCE-SCHEDULE.md` documents weekly, monthly, quarterly, and annual tasks
- [ ] No secrets or .env values in any committed file
