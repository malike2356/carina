# Labyrinth Scout - Prompt 02: Scout Server Foundation

## What you are building

Build the full Labyrinth Scout Node.js/TypeScript server. This is the foundation that prompt 01
(dashboard) and prompt 03 (Carina integration) mount onto. After completing this prompt the server
must start cleanly, run migrations, listen on port 4444, and accept event + heartbeat posts from
Carina agent instances.

**Working directory:** `/opt/lampp/htdocs/VERLOX/Carina-ai/labyrinthscout/`

Do not touch anything outside that directory in this prompt.

The Carina main project lives at `../src/`. It runs on the same PostgreSQL 16 instance and the
same Redis 7 instance. Scout shares the database connection string but will write to its own tables
(prefixed with no special namespace - just `security_events`, `carina_instances`, `alert_channels`).

---

## Files to create (complete list)

```
labyrinthscout/package.json
labyrinthscout/tsconfig.json
labyrinthscout/.env.example
labyrinthscout/src/types.ts
labyrinthscout/src/config/index.ts
labyrinthscout/src/db.ts
labyrinthscout/src/redis.ts
labyrinthscout/src/migrations.ts
labyrinthscout/src/middleware/auth.ts
labyrinthscout/src/api/events.ts
labyrinthscout/src/api/heartbeat.ts
labyrinthscout/src/api/sse.ts          (stub only - full impl in prompt 01)
labyrinthscout/src/api/status.ts       (stub only - full impl in prompt 01)
labyrinthscout/src/api/kill.ts         (stub only - full impl in prompt 01)
labyrinthscout/src/server.ts
```

---

## 1. package.json

```json
{
  "name": "labyrinth-scout",
  "version": "0.1.0",
  "description": "Security control plane for Carina AI agent instances",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "start": "node dist/src/server.js",
    "build": "tsc",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "chalk": "^5.3.0",
    "dotenv": "^16.4.5",
    "express": "^5.0.1",
    "ioredis": "^5.4.1",
    "pg": "^8.13.0",
    "uuid": "^10.0.0"
  },
  "devDependencies": {
    "@types/express": "^5.0.0",
    "@types/node": "^22.0.0",
    "@types/pg": "^8.11.10",
    "@types/uuid": "^10.0.0",
    "tsx": "^4.19.2",
    "typescript": "^5.7.2"
  },
  "engines": {
    "node": ">=22.0.0",
    "pnpm": ">=9.0.0"
  }
}
```

Use exact version ranges as shown. Run `pnpm install` after creating this file.

---

## 2. tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "rootDir": "src",
    "outDir": "dist",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": false,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "sourceMap": true,
    "declaration": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

---

## 3. .env.example

Document every environment variable Scout reads. Copy this exactly:

```
# Labyrinth Scout - Environment Variables
# Copy to .env and fill in real values. Never commit .env.

# Server
SCOUT_PORT=4444

# Database - can share with Carina's DATABASE_URL or use a dedicated one
# Scout reads SCOUT_DATABASE_URL first; falls back to DATABASE_URL
SCOUT_DATABASE_URL=postgresql://carina:password@localhost:5432/carina

# Redis - shared with Carina
REDIS_URL=redis://localhost:6379

# Authentication - Carina agents include this in X-Scout-Key header
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
SCOUT_API_KEY=change_me_generate_a_random_64_char_hex_string

# Alert channels (optional - leave blank to disable)
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=

RESEND_API_KEY=
ALERT_EMAIL_FROM=scout@verlox.co.uk
ALERT_EMAIL_TO=

# Slack webhook URL (optional)
SLACK_WEBHOOK_URL=
```

---

## 4. src/types.ts

All shared TypeScript types. Every other file imports from here.

```typescript
export type Severity = 'info' | 'warning' | 'critical' | 'breach';

export type InstanceStatus = 'active' | 'suspended' | 'offline';

export interface SecurityEventRow {
  id: string;
  severity: Severity;
  source: string;
  event_type: string;
  description: string;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  session_id: string | null;
  instance_id: string | null;
  mitigated: boolean;
  created_at: string;
}

export interface CarinaInstanceRow {
  id: string;
  name: string;
  api_key: string;
  status: InstanceStatus;
  suspension_reason: string | null;
  last_heartbeat: string | null;
  created_at: string;
}

export interface AlertChannelRow {
  id: string;
  type: 'telegram' | 'email' | 'slack' | 'sms';
  identifier: string;
  severity_threshold: Severity;
  enabled: boolean;
  created_at: string;
}

export interface IncomingEventPayload {
  severity: Severity;
  source: string;
  event_type: string;
  description: string;
  metadata?: Record<string, unknown>;
  ip_address?: string;
  session_id?: string;
  instance_id?: string;
}

export interface HeartbeatPayload {
  instance_id: string;
  name: string;
}

export interface StatusResponse {
  instances: Array<{
    id: string;
    name: string;
    status: InstanceStatus;
    last_heartbeat: string | null;
    secondsAgo: number | null;
  }>;
  stats: {
    critical: number;
    warning: number;
    info: number;
  };
  toolCalls: Record<string, number>;
}
```

---

## 5. src/config/index.ts

Read from `process.env` after loading `.env`. Validate required keys and throw clear errors at
startup if they are missing. Never export raw `process.env` access - always use this module.

```typescript
import 'dotenv/config';

function require(key: string, fallback?: string): string {
  const val = process.env[key] ?? fallback;
  if (val === undefined) {
    throw new Error(`Missing required env var: ${key}. See .env.example.`);
  }
  return val;
}

function optional(key: string, fallback = ''): string {
  return process.env[key] ?? fallback;
}

export const config = {
  port: parseInt(optional('SCOUT_PORT', '4444'), 10),
  db: {
    url: optional('SCOUT_DATABASE_URL') || optional('DATABASE_URL')
         || 'postgresql://localhost:5432/carina',
  },
  redis: {
    url: optional('REDIS_URL', 'redis://localhost:6379'),
  },
  auth: {
    apiKey: require('SCOUT_API_KEY'),
  },
  alerts: {
    telegram: {
      botToken: optional('TELEGRAM_BOT_TOKEN'),
      chatId: optional('TELEGRAM_CHAT_ID'),
    },
    email: {
      resendApiKey: optional('RESEND_API_KEY'),
      from: optional('ALERT_EMAIL_FROM', 'scout@verlox.co.uk'),
      to: optional('ALERT_EMAIL_TO'),
    },
    slack: {
      webhookUrl: optional('SLACK_WEBHOOK_URL'),
    },
  },
} as const;
```

Note: `require('SCOUT_API_KEY')` will throw at startup if the key is missing. This is intentional -
Scout must not run without an API key.

---

## 6. src/db.ts

```typescript
import pg from 'pg';
import { config } from './config/index.js';
import { runMigrations } from './migrations.js';

export const pool = new pg.Pool({
  connectionString: config.db.url,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on('error', (err) => {
  console.error('[scout:db] Unexpected pool error:', err.message);
});

let migrated = false;

export async function initDb(): Promise<void> {
  if (migrated) return;
  const client = await pool.connect();
  try {
    await runMigrations(client);
    migrated = true;
  } finally {
    client.release();
  }
}
```

No pgvector registration needed here (Scout does not use vector similarity search).

---

## 7. src/redis.ts

```typescript
import { Redis } from 'ioredis';
import { config } from './config/index.js';

let client: Redis | null = null;

export function initRedis(): Promise<void> {
  return new Promise((resolve) => {
    const r = new Redis(config.redis.url, {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });

    r.on('error', (err) => {
      console.warn('[scout:redis] Connection error:', err.message);
    });

    r.connect()
      .then(() => {
        client = r;
        console.log('[scout:redis] Connected');
        resolve();
      })
      .catch(() => {
        console.warn('[scout:redis] Redis unavailable; kill switch and SSE fan-out degraded');
        r.disconnect();
        resolve(); // resolve (not reject) so server still starts
      });
  });
}

export function getRedis(): Redis | null {
  return client;
}

// Create a dedicated subscriber client (separate from the command client).
// ioredis subscriber clients cannot issue regular commands.
export function createSubscriber(): Redis {
  return new Redis(config.redis.url, {
    maxRetriesPerRequest: 1,
  });
}
```

---

## 8. src/migrations.ts

Must be fully idempotent. Safe to run on every server start. Uses `IF NOT EXISTS` throughout.
Takes a `pg.PoolClient` argument and runs all statements in sequence.

```typescript
import type pg from 'pg';

export async function runMigrations(client: pg.PoolClient): Promise<void> {
  // security_events
  await client.query(`
    CREATE TABLE IF NOT EXISTS security_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      severity TEXT NOT NULL CHECK (severity IN ('info','warning','critical','breach')),
      source TEXT NOT NULL,
      event_type TEXT NOT NULL,
      description TEXT NOT NULL,
      metadata JSONB DEFAULT '{}',
      ip_address TEXT,
      session_id TEXT,
      instance_id TEXT,
      mitigated BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // carina_instances
  await client.query(`
    CREATE TABLE IF NOT EXISTS carina_instances (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      api_key TEXT NOT NULL,
      status TEXT DEFAULT 'active' CHECK (status IN ('active','suspended','offline')),
      suspension_reason TEXT,
      last_heartbeat TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // alert_channels
  await client.query(`
    CREATE TABLE IF NOT EXISTS alert_channels (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      type TEXT NOT NULL CHECK (type IN ('telegram','email','slack','sms')),
      identifier TEXT NOT NULL,
      severity_threshold TEXT DEFAULT 'warning'
        CHECK (severity_threshold IN ('info','warning','critical')),
      enabled BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Indexes (all IF NOT EXISTS)
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_security_events_created_at
      ON security_events (created_at DESC)
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_security_events_severity
      ON security_events (severity)
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_security_events_instance_id
      ON security_events (instance_id)
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_security_events_event_type
      ON security_events (event_type)
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_carina_instances_status
      ON carina_instances (status)
  `);

  console.log('[scout:migrations] Schema ready');
}
```

---

## 9. src/middleware/auth.ts

Authentication middleware. All routes under `/api/*` except `/api/stream` require this header:
`X-Scout-Key: {SCOUT_API_KEY}`

```typescript
import type { Request, Response, NextFunction } from 'express';
import { config } from '../config/index.js';

export function requireApiKey(req: Request, res: Response, next: NextFunction): void {
  const key = req.headers['x-scout-key'];
  if (key !== config.auth.apiKey) {
    res.status(401).json({ error: 'Unauthorized: invalid or missing X-Scout-Key' });
    return;
  }
  next();
}
```

Apply this middleware selectively in `server.ts`:
```typescript
app.use('/api/events', requireApiKey, eventsRouter);
app.use('/api/heartbeat', requireApiKey, heartbeatRouter);
app.use('/api/status', requireApiKey, statusRouter);
app.use('/api/kill', requireApiKey, killRouter);
// /api/stream does NOT get requireApiKey - dashboard on local network accesses it directly
app.use('/api/stream', sseRouter);
```

---

## 10. src/api/events.ts

Receives security events POSTed by Carina agent instances.

```
POST /api/events
Headers: X-Scout-Key required (enforced by middleware before this router)
Content-Type: application/json
Body: IncomingEventPayload
Response 201: { "ok": true, "id": "uuid" }
Response 400: { "error": "..." }  (validation failure)
Response 500: { "error": "Database error" }
```

Validation rules (return 400 if any fail):
- `severity` must be one of: `info`, `warning`, `critical`, `breach`
- `source` must be non-empty string, max 100 chars
- `event_type` must be non-empty string, max 100 chars, matches `/^[a-z0-9_]+$/`
- `description` must be non-empty string, max 1000 chars
- `metadata` if present must be a plain object (not array, not null)
- `instance_id` if present must match `/^[a-z0-9_\-]+$/` and be max 64 chars

After validation:
1. Insert row into `security_events`. Use parameterised query.
2. Publish the full inserted row (with id and created_at) to Redis channel `'scout:events'`.
   If Redis is unavailable (`getRedis()` returns null), skip the publish and log a warning.
3. Return 201 with the new event id.

Publishing to Redis for SSE fan-out:
```typescript
const redis = getRedis();
if (redis) {
  await redis.publish('scout:events', JSON.stringify(insertedRow));
}
```

Extract IP address from `req.ip` and store in `ip_address` column. Trust
`X-Forwarded-For` header by setting `app.set('trust proxy', 1)` in server.ts.

---

## 11. src/api/heartbeat.ts

Carina agents call this every 60 seconds to signal they are alive.

```
POST /api/heartbeat
Headers: X-Scout-Key required
Content-Type: application/json
Body: { "instance_id": "carina-vps-01", "name": "Carina VPS 01" }
Response 200: { "ok": true }
Response 400: { "error": "..." }
```

Validation: `instance_id` required, matches `/^[a-z0-9_\-]+$/`. `name` required, max 80 chars.

Logic:
```sql
INSERT INTO carina_instances (id, name, api_key, status, last_heartbeat)
VALUES ($1, $2, $3, 'active', NOW())
ON CONFLICT (id) DO UPDATE
  SET last_heartbeat = NOW(),
      name = EXCLUDED.name,
      status = CASE
        WHEN carina_instances.status = 'suspended' THEN 'suspended'
        ELSE 'active'
      END
```

The `api_key` field for a new instance stores the Scout API key used in the heartbeat request
(available as `config.auth.apiKey`). This is a simplification for MVP - per-instance API keys
come in a later iteration.

Suspended instances remain suspended even when they heartbeat (the CASE above). Carina will
see this in the `/api/status` response and stop processing.

Return 200 on success, 500 if the upsert fails.

---

## 12. src/api/sse.ts (stub)

Create this stub now. Prompt 01 will fill in the full implementation.

```typescript
import { Router } from 'express';
import type { SecurityEventRow } from '../types.js';

export const sseRouter = Router();

export function broadcastEvent(_event: SecurityEventRow): void {
  // stub - implemented in prompt 01
}

export function broadcastStats(_stats: { critical: number; warning: number; info: number }): void {
  // stub - implemented in prompt 01
}

sseRouter.get('/stream', (_req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.write('data: ' + JSON.stringify({ type: 'heartbeat' }) + '\n\n');
  // stub - full implementation in prompt 01
});
```

---

## 13. src/api/status.ts (stub)

```typescript
import { Router } from 'express';

export const statusRouter = Router();

statusRouter.get('/', (_req, res) => {
  // stub - implemented in prompt 01
  res.json({ instances: [], stats: { critical: 0, warning: 0, info: 0 }, toolCalls: {} });
});
```

---

## 14. src/api/kill.ts (stub)

```typescript
import { Router } from 'express';

export const killRouter = Router();

killRouter.post('/:instanceId', (_req, res) => {
  // stub - implemented in prompt 01
  res.status(501).json({ error: 'Not implemented yet' });
});
```

---

## 15. src/server.ts

The main Express application. Every concern is modular; this file only wires them together.

```typescript
import express from 'express';
import { fileURLToPath } from 'url';
import path from 'path';
import chalk from 'chalk';
import { config } from './config/index.js';
import { initDb, pool } from './db.js';
import { initRedis, getRedis, createSubscriber } from './redis.js';
import { requireApiKey } from './middleware/auth.js';
import { eventsRouter } from './api/events.js';
import { heartbeatRouter } from './api/heartbeat.js';
import { sseRouter, broadcastEvent } from './api/sse.js';
import { statusRouter } from './api/status.js';
import { killRouter } from './api/kill.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

// Trust one proxy layer (for correct req.ip behind nginx)
app.set('trust proxy', 1);

// Body parsing
app.use(express.json({ limit: '64kb' }));

// CORS - allow same-origin and local dashboard only
app.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Scout-Key');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  next();
});

// Static files (dashboard.html lives in public/)
app.use(express.static(path.join(__dirname, '../../public')));

// API routes
app.use('/api/events', requireApiKey, eventsRouter);
app.use('/api/heartbeat', requireApiKey, heartbeatRouter);
app.use('/api/status', requireApiKey, statusRouter);
app.use('/api/kill', requireApiKey, killRouter);
app.use('/api/stream', sseRouter); // no auth - local network

// Global error handler (must be last middleware)
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[scout:error]', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// Graceful shutdown
async function shutdown(signal: string): Promise<void> {
  console.log(chalk.gray(`\n[scout] ${signal} received, shutting down...`));
  const redis = getRedis();
  if (redis) redis.disconnect();
  await pool.end().catch(() => undefined);
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

// SSE subscriber (Redis -> dashboard clients)
async function initSseSubscriber(): Promise<void> {
  try {
    const sub = createSubscriber();
    sub.subscribe('scout:events', (err) => {
      if (err) console.warn('[scout:sse-sub] Subscribe failed:', err.message);
    });
    sub.on('message', (_channel, message) => {
      try {
        const event = JSON.parse(message);
        broadcastEvent(event);
      } catch { /* malformed message, ignore */ }
    });
    console.log(chalk.gray('[scout] SSE Redis subscriber active'));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(chalk.yellow(`[scout] SSE subscriber unavailable: ${msg}`));
  }
}

// Startup
async function main(): Promise<void> {
  console.log(chalk.bold.hex('#d4af37')('LABYRINTH SCOUT') + chalk.gray(' - starting up'));

  await initDb();
  await initRedis();
  await initSseSubscriber();

  app.listen(config.port, () => {
    console.log(chalk.green(`[scout] Listening on http://localhost:${config.port}`));
    console.log(chalk.gray(`[scout] Dashboard: http://localhost:${config.port}/dashboard.html`));
    console.log(chalk.gray('[scout] Ready to receive events from Carina instances'));
  });
}

main().catch((err) => {
  console.error(chalk.red('[scout] Fatal startup error:'), err);
  process.exit(1);
});
```

---

## Startup log (expected output when server starts successfully)

```
LABYRINTH SCOUT - starting up
[scout:migrations] Schema ready
[scout:redis] Connected
[scout] SSE Redis subscriber active
[scout] Listening on http://localhost:4444
[scout] Dashboard: http://localhost:4444/dashboard.html
[scout] Ready to receive events from Carina instances
```

If PostgreSQL is unavailable, the process must exit with a clear error and non-zero exit code
(because migrations are required; Scout cannot operate without the DB).

If Redis is unavailable, warn and continue (SSE fan-out and kill switch are degraded but events
still insert to DB and the status endpoint still works).

---

## Manual verification steps

After running `pnpm dev`:

1. Server starts on port 4444 with no errors in the terminal.
2. `curl http://localhost:4444/` returns the dashboard HTML (after it exists) or a 404/empty.
3. `curl -X POST http://localhost:4444/api/heartbeat` (no key) returns 401.
4. `curl -X POST http://localhost:4444/api/heartbeat -H "X-Scout-Key: $SCOUT_API_KEY" -H "Content-Type: application/json" -d '{"instance_id":"carina-local","name":"Carina Local"}' ` returns `{"ok":true}`.
5. Row appears in `carina_instances` table: `SELECT id, name, status, last_heartbeat FROM carina_instances;`
6. `curl -X POST http://localhost:4444/api/events -H "X-Scout-Key: $SCOUT_API_KEY" -H "Content-Type: application/json" -d '{"severity":"warning","source":"test","event_type":"test_event","description":"hello"}'` returns `{"ok":true,"id":"..."}`.
7. Row appears in `security_events` table.
8. Sending SIGINT (Ctrl+C) shows graceful shutdown message and exits cleanly.

---

## Constraints

- TypeScript strict mode throughout. `tsc --noEmit` must pass with zero errors.
- No `any` types except as temporary stubs clearly marked `// TODO: type`.
- All async functions must have explicit return types.
- Errors thrown in async route handlers must be caught and forwarded to Express error handler
  via `next(err)` or by being caught in a try/catch that calls `res.status(500)`.
- No `console.log` in hot paths (event insert, heartbeat) - only on startup and warnings.
  Use structured `console.warn` / `console.error` with `[scout:module]` prefix for filtering.
- The `requireApiKey` middleware uses constant-time comparison to prevent timing attacks. Use
  Node.js `crypto.timingSafeEqual` comparing `Buffer.from(key)` and `Buffer.from(config.auth.apiKey)`.
  Both buffers must be the same length before comparing (return 401 immediately if lengths differ).
