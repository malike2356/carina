# Carina Distro Prompt 04: Daily Carina version check job

## Goal

Run a daily background job that checks whether a newer version of `carina-agent` is
available on the npm registry. If one is found, create an admin notification record in
the database. The job never auto-updates and never touches `node_modules/`. It only reads
and notifies.

## Context

The version check follows this logic:

1. Read the currently installed version from `apps/carina/package.json` (the pinned version)
2. Query `https://registry.npmjs.org/carina-agent/latest` for the latest published version
3. Use `semver.gt(latest, installed)` to compare
4. If newer: write a record to `system_notifications` table (idempotent - do not duplicate)
5. Job runs once per day via BullMQ repeatable job

The notification record is read by the admin dashboard API (prompt 05) and displayed as
a banner until the ABBIS team has acknowledged or acted on it.

The npm registry call is the ONLY external network call in this job. If the registry is
unreachable (npm outage, server offline), the job logs a warning and exits cleanly. No
error is surfaced to the user.

## Dependencies

`00-distro-workspace-scaffold.md`, `03-graceful-degradation.md`

## Files to create

```
abbis/apps/api/src/jobs/carina-version-check.ts
abbis/apps/api/src/jobs/queue.ts            (BullMQ queue + worker setup)
abbis/packages/db/src/schema/notifications.ts
abbis/packages/db/src/migrations/0001_add_system_notifications.sql
```

## Step-by-step

### 1. Database: system_notifications table

`abbis/packages/db/src/schema/notifications.ts`:
```typescript
import { pgTable, uuid, text, boolean, timestamp } from 'drizzle-orm/pg-core';

export const systemNotifications = pgTable('system_notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: text('type').notNull(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  actionLabel: text('action_label'),
  actionUrl: text('action_url'),
  acknowledged: boolean('acknowledged').notNull().default(false),
  acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type SystemNotification = typeof systemNotifications.$inferSelect;
export type NewSystemNotification = typeof systemNotifications.$inferInsert;
```

Migration SQL `abbis/packages/db/src/migrations/0001_add_system_notifications.sql`:
```sql
CREATE TABLE IF NOT EXISTS system_notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type        TEXT NOT NULL,
  title       TEXT NOT NULL,
  message     TEXT NOT NULL,
  action_label TEXT,
  action_url   TEXT,
  acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
  acknowledged_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_notifications_type
  ON system_notifications (type);

CREATE INDEX IF NOT EXISTS idx_system_notifications_acknowledged
  ON system_notifications (acknowledged)
  WHERE acknowledged = FALSE;
```

### 2. BullMQ queue setup

`abbis/apps/api/src/jobs/queue.ts`:
```typescript
import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';

const connection = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

export const mainQueue = new Queue('abbis-main', { connection });

export function createWorker(
  processor: (job: { name: string; data: unknown }) => Promise<void>,
): Worker {
  return new Worker('abbis-main', processor, { connection });
}

export async function scheduleRepeatableJob(
  name: string,
  cronExpression: string,
  data: Record<string, unknown> = {},
): Promise<void> {
  await mainQueue.add(name, data, {
    repeat: { pattern: cronExpression },
    jobId: `repeatable:${name}`,
  });
}
```

### 3. Version check job

`abbis/apps/api/src/jobs/carina-version-check.ts`:
```typescript
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import semver from 'semver';
import { db } from '@abbis/db';
import { systemNotifications } from '@abbis/db/schema/notifications.js';
import { eq, and } from 'drizzle-orm';

const REGISTRY_URL = 'https://registry.npmjs.org/carina-agent/latest';
const CHECK_TIMEOUT_MS = 10_000;

function getInstalledVersion(): string {
  const pkgPath = resolve(
    fileURLToPath(import.meta.url),
    '../../../../../apps/carina/package.json',
  );
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as {
    dependencies?: Record<string, string>;
  };
  const version = pkg.dependencies?.['carina-agent'];
  if (!version) throw new Error('carina-agent not found in apps/carina/package.json');
  return version.replace(/^[^~]/, '');
}

async function getLatestVersion(): Promise<string | null> {
  try {
    const res = await fetch(REGISTRY_URL, {
      signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { version?: string };
    return data.version ?? null;
  } catch {
    return null;
  }
}

async function notificationAlreadyExists(
  installedVersion: string,
  latestVersion: string,
): Promise<boolean> {
  const existing = await db
    .select({ id: systemNotifications.id })
    .from(systemNotifications)
    .where(
      and(
        eq(systemNotifications.type, 'carina_update_available'),
        eq(systemNotifications.acknowledged, false),
      ),
    )
    .limit(1);
  return existing.length > 0;
}

export async function runCarinaVersionCheck(): Promise<void> {
  let installed: string;
  try {
    installed = getInstalledVersion();
  } catch (err) {
    console.warn('[carina-version-check] Could not read installed version:', err);
    return;
  }

  const latest = await getLatestVersion();
  if (!latest) {
    console.warn('[carina-version-check] Could not reach npm registry; skipping');
    return;
  }

  if (!semver.gt(latest, installed)) {
    console.log(`[carina-version-check] Up to date (${installed})`);
    return;
  }

  const alreadyNotified = await notificationAlreadyExists(installed, latest);
  if (alreadyNotified) {
    console.log(`[carina-version-check] Update ${latest} already notified`);
    return;
  }

  await db.insert(systemNotifications).values({
    type: 'carina_update_available',
    title: `Carina ${latest} is available`,
    message: `Your ABBIS instance is running Carina ${installed}. Version ${latest} is now available. Review the changelog before updating.`,
    actionLabel: 'View changelog',
    actionUrl: `https://carinaai.uk/releases/${latest}`,
    acknowledged: false,
  });

  console.log(`[carina-version-check] Notification created: ${installed} -> ${latest}`);
}
```

### 4. Register the job in the API startup

In `abbis/apps/api/src/index.ts`, after Express is configured:
```typescript
import { scheduleRepeatableJob, createWorker } from './jobs/queue.js';
import { runCarinaVersionCheck } from './jobs/carina-version-check.js';

// Register repeatable jobs
await scheduleRepeatableJob('carina-version-check', '0 8 * * *'); // 08:00 UTC daily

// Start worker
const worker = createWorker(async (job) => {
  if (job.name === 'carina-version-check') {
    await runCarinaVersionCheck();
  }
});

worker.on('failed', (job, err) => {
  console.error(`[worker] Job ${job?.name} failed:`, err);
});
```

The cron `0 8 * * *` runs at 08:00 UTC every day. Adjust to match the ABBIS operator's
timezone if preferred. The job is idempotent: running it twice on the same day will not
create duplicate notifications because of the `notificationAlreadyExists` guard.

### 5. Manual trigger endpoint (admin only)

Add a protected admin route to trigger the check immediately:
```typescript
router.post('/admin/carina/check-version', requireAdmin, async (_req, res) => {
  await runCarinaVersionCheck();
  res.json({ ok: true });
});
```

This allows the ABBIS team to trigger a check on demand without waiting for the daily
schedule.

## Expected behavior

```bash
# Trigger manually:
curl -X POST http://localhost:3000/admin/carina/check-version \
  -H "Authorization: Bearer <admin_token>"

# If a newer version exists, a record appears:
curl http://localhost:3000/api/admin/notifications \
  -H "Authorization: Bearer <admin_token>"
# [{
#   "id": "...",
#   "type": "carina_update_available",
#   "title": "Carina 0.2.0 is available",
#   "message": "Your ABBIS instance is running Carina 0.1.1. Version 0.2.0 is now available...",
#   "actionUrl": "https://carinaai.uk/releases/0.2.0",
#   "acknowledged": false
# }]
```

## Test

```bash
# Unit test for getInstalledVersion
# Unit test for getLatestVersion with mocked fetch (return higher version)
# Unit test for idempotency (run twice, expect one notification row)
# Integration test: run job with REGISTRY_URL pointing to a mock server
```

Vitest test file: `abbis/apps/api/src/jobs/carina-version-check.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('runCarinaVersionCheck', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a notification when a newer version is available', async () => {
    vi.stubGlobal('fetch', async () => ({
      ok: true,
      json: async () => ({ version: '9.9.9' }),
    }));
    // ... mock db insert, assert it was called
  });

  it('does not create duplicate notifications', async () => {
    // ... mock db to return existing notification, assert insert not called
  });

  it('exits cleanly when registry is unreachable', async () => {
    vi.stubGlobal('fetch', async () => { throw new Error('ECONNREFUSED'); });
    await expect(runCarinaVersionCheck()).resolves.toBeUndefined();
  });
});
```

## Pitfalls

- The path resolution for `apps/carina/package.json` uses `import.meta.url` to find the
  file relative to the built output; test this path in both dev (`tsx`) and production
  (`node dist/`) modes
- If the npm registry requires authentication in the future (unlikely for public packages),
  add a `NPM_TOKEN` env var; today `carina-agent` is public
- The `semver` package must be added to `apps/api/package.json` dependencies
- BullMQ repeatable jobs persist in Redis; if the cron expression changes, remove the old
  job first with `mainQueue.removeRepeatable('carina-version-check', { pattern: '<old>' })`
