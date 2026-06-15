# Carina Distro Prompt 07: ABBIS Boreholes module

## Goal

Build the borehole project management module: database schema, REST API routes, and
TimescaleDB time-series table for drilling logs. This is the core domain of ABBIS.

## Context

Borehole projects are the central entity in ABBIS. Every other module (invoices, jobs,
compliance reports) references a borehole project. The drilling log is a time-series:
one row per day per project, tracking depth progress. TimescaleDB hypertables give
efficient range queries over log history without full-table scans.

The API will be called by:
- The ABBIS web dashboard
- The Carina `project-tools` skill (via HTTP with an internal API key)
- The WhatsApp channel adapter (through Carina)

## Dependencies

`00-distro-workspace-scaffold.md` - database and API workspace must exist.
Run database migrations before starting the API.

## Files to create

```
abbis/packages/db/src/schema/boreholes.ts
abbis/packages/db/src/migrations/0002_boreholes_and_logs.sql
abbis/apps/api/src/routes/boreholes.ts
abbis/apps/api/src/routes/boreholes.test.ts
```

## Step-by-step

### 1. Database schema - Drizzle

`abbis/packages/db/src/schema/boreholes.ts`:
```typescript
import {
  pgTable, uuid, text, numeric, integer, timestamp,
  pgEnum, boolean, jsonb,
} from 'drizzle-orm/pg-core';

export const boreholeStatusEnum = pgEnum('borehole_status', [
  'planning',
  'mobilising',
  'drilling',
  'casing',
  'development',
  'pump_installation',
  'commissioning',
  'completed',
  'abandoned',
  'on_hold',
]);

export const boreholes = pgTable('boreholes', {
  id:              uuid('id').primaryKey().defaultRandom(),
  tenantId:        uuid('tenant_id').notNull(),
  projectCode:     text('project_code').notNull().unique(),
  clientName:      text('client_name').notNull(),
  clientPhone:     text('client_phone'),
  clientEmail:     text('client_email'),
  siteName:        text('site_name').notNull(),
  region:          text('region').notNull(),
  district:        text('district'),
  gpsLat:          numeric('gps_lat', { precision: 10, scale: 7 }),
  gpsLng:          numeric('gps_lng', { precision: 10, scale: 7 }),
  targetDepthM:    integer('target_depth_m'),
  currentDepthM:   integer('current_depth_m').notNull().default(0),
  status:          boreholeStatusEnum('status').notNull().default('planning'),
  rigId:           uuid('rig_id'),
  contractValueGhs: numeric('contract_value_ghs', { precision: 12, scale: 2 }),
  notes:           text('notes'),
  metadata:        jsonb('metadata'),
  startDate:       timestamp('start_date', { withTimezone: true }),
  completedAt:     timestamp('completed_at', { withTimezone: true }),
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:       timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const drillingLogFluidEnum = pgEnum('fluid_return_type', [
  'good', 'partial', 'lost', 'artesian',
]);

export const drillingLogs = pgTable('drilling_logs', {
  id:             uuid('id').primaryKey().defaultRandom(),
  boreholeId:     uuid('borehole_id').notNull().references(() => boreholes.id),
  tenantId:       uuid('tenant_id').notNull(),
  logDate:        timestamp('log_date', { withTimezone: true }).notNull(),
  depthStartM:    integer('depth_start_m').notNull(),
  depthEndM:      integer('depth_end_m').notNull(),
  formationCode:  text('formation_code'),
  fluidReturns:   drillingLogFluidEnum('fluid_returns'),
  drillBit:       text('drill_bit'),
  notes:          text('notes'),
  submittedBy:    uuid('submitted_by'),
  createdAt:      timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Borehole = typeof boreholes.$inferSelect;
export type NewBorehole = typeof boreholes.$inferInsert;
export type DrillingLog = typeof drillingLogs.$inferSelect;
export type NewDrillingLog = typeof drillingLogs.$inferInsert;
```

### 2. Migration SQL

`abbis/packages/db/src/migrations/0002_boreholes_and_logs.sql`:
```sql
CREATE TYPE borehole_status AS ENUM (
  'planning', 'mobilising', 'drilling', 'casing', 'development',
  'pump_installation', 'commissioning', 'completed', 'abandoned', 'on_hold'
);

CREATE TYPE fluid_return_type AS ENUM ('good', 'partial', 'lost', 'artesian');

CREATE TABLE boreholes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL,
  project_code      TEXT NOT NULL UNIQUE,
  client_name       TEXT NOT NULL,
  client_phone      TEXT,
  client_email      TEXT,
  site_name         TEXT NOT NULL,
  region            TEXT NOT NULL,
  district          TEXT,
  gps_lat           NUMERIC(10, 7),
  gps_lng           NUMERIC(10, 7),
  target_depth_m    INTEGER,
  current_depth_m   INTEGER NOT NULL DEFAULT 0,
  status            borehole_status NOT NULL DEFAULT 'planning',
  rig_id            UUID,
  contract_value_ghs NUMERIC(12, 2),
  notes             TEXT,
  metadata          JSONB,
  start_date        TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_boreholes_tenant ON boreholes (tenant_id);
CREATE INDEX idx_boreholes_status ON boreholes (tenant_id, status);
CREATE INDEX idx_boreholes_region ON boreholes (tenant_id, region);

CREATE TABLE drilling_logs (
  id             UUID NOT NULL DEFAULT gen_random_uuid(),
  borehole_id    UUID NOT NULL REFERENCES boreholes(id),
  tenant_id      UUID NOT NULL,
  log_date       TIMESTAMPTZ NOT NULL,
  depth_start_m  INTEGER NOT NULL,
  depth_end_m    INTEGER NOT NULL,
  formation_code TEXT,
  fluid_returns  fluid_return_type,
  drill_bit      TEXT,
  notes          TEXT,
  submitted_by   UUID,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, log_date)
);

-- Convert drilling_logs to TimescaleDB hypertable partitioned by log_date
SELECT create_hypertable('drilling_logs', 'log_date', if_not_exists => TRUE);

CREATE INDEX idx_drilling_logs_borehole ON drilling_logs (borehole_id, log_date DESC);
```

### 3. API routes

`abbis/apps/api/src/routes/boreholes.ts`:
```typescript
import { Router } from 'express';
import { db } from '@abbis/db';
import { boreholes, drillingLogs } from '@abbis/db/schema/boreholes.js';
import { eq, and, desc, asc, gte, lte } from 'drizzle-orm';
import { requireAuth } from '../middleware/require-auth.js';
import { requireTenant } from '../middleware/require-tenant.js';
import { z } from 'zod';

const router = Router();

router.use(requireAuth, requireTenant);

// GET /api/boreholes - paginated list with optional status filter
router.get('/', async (req, res) => {
  const { status, region, limit = '20', offset = '0' } = req.query as Record<string, string>;

  const conditions = [eq(boreholes.tenantId, req.tenantId)];
  if (status) conditions.push(eq(boreholes.status, status as typeof boreholes.status._.data));
  if (region) conditions.push(eq(boreholes.region, region));

  const rows = await db
    .select()
    .from(boreholes)
    .where(and(...conditions))
    .orderBy(desc(boreholes.createdAt))
    .limit(Math.min(parseInt(limit), 100))
    .offset(parseInt(offset));

  res.json(rows);
});

// GET /api/boreholes/:id - single project with recent logs
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  const [project] = await db
    .select()
    .from(boreholes)
    .where(and(eq(boreholes.id, id), eq(boreholes.tenantId, req.tenantId)));

  if (!project) { res.status(404).json({ error: 'not_found' }); return; }

  const logs = await db
    .select()
    .from(drillingLogs)
    .where(and(eq(drillingLogs.boreholeId, id), eq(drillingLogs.tenantId, req.tenantId)))
    .orderBy(desc(drillingLogs.logDate))
    .limit(30);

  res.json({ ...project, recentLogs: logs });
});

const createBoreholeSchema = z.object({
  projectCode:       z.string().min(1).max(50),
  clientName:        z.string().min(1),
  clientPhone:       z.string().optional(),
  clientEmail:       z.string().email().optional(),
  siteName:          z.string().min(1),
  region:            z.string().min(1),
  district:          z.string().optional(),
  gpsLat:            z.number().min(-90).max(90).optional(),
  gpsLng:            z.number().min(-180).max(180).optional(),
  targetDepthM:      z.number().int().positive().optional(),
  contractValueGhs:  z.number().positive().optional(),
  notes:             z.string().optional(),
  startDate:         z.string().datetime().optional(),
});

// POST /api/boreholes - create project
router.post('/', async (req, res) => {
  const parsed = createBoreholeSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'validation', details: parsed.error.flatten() }); return; }

  const [created] = await db
    .insert(boreholes)
    .values({ ...parsed.data, tenantId: req.tenantId })
    .returning();

  res.status(201).json(created);
});

// PATCH /api/boreholes/:id - update status / depth
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const allowedFields = ['status', 'currentDepthM', 'rigId', 'notes', 'completedAt'] as const;
  const updates: Record<string, unknown> = { updatedAt: new Date() };

  for (const field of allowedFields) {
    if (field in req.body) updates[field] = req.body[field];
  }

  const [updated] = await db
    .update(boreholes)
    .set(updates)
    .where(and(eq(boreholes.id, id), eq(boreholes.tenantId, req.tenantId)))
    .returning();

  if (!updated) { res.status(404).json({ error: 'not_found' }); return; }
  res.json(updated);
});

const createLogSchema = z.object({
  logDate:       z.string().datetime().optional(),
  depthStartM:   z.number().int().min(0),
  depthEndM:     z.number().int().min(0),
  formationCode: z.string().optional(),
  fluidReturns:  z.enum(['good', 'partial', 'lost', 'artesian']).optional(),
  drillBit:      z.string().optional(),
  notes:         z.string().optional(),
});

// POST /api/boreholes/:id/logs - submit drilling log
router.post('/:id/logs', async (req, res) => {
  const { id } = req.params;

  const [project] = await db
    .select({ id: boreholes.id })
    .from(boreholes)
    .where(and(eq(boreholes.id, id), eq(boreholes.tenantId, req.tenantId)));

  if (!project) { res.status(404).json({ error: 'not_found' }); return; }

  const parsed = createLogSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'validation', details: parsed.error.flatten() }); return; }

  const logDate = parsed.data.logDate ? new Date(parsed.data.logDate) : new Date();

  const [log] = await db
    .insert(drillingLogs)
    .values({
      ...parsed.data,
      boreholeId: id,
      tenantId: req.tenantId,
      logDate,
      submittedBy: req.user.id,
    })
    .returning();

  // Update current depth if this log goes deeper
  if (parsed.data.depthEndM > 0) {
    await db
      .update(boreholes)
      .set({ currentDepthM: parsed.data.depthEndM, updatedAt: new Date() })
      .where(
        and(
          eq(boreholes.id, id),
          eq(boreholes.tenantId, req.tenantId),
        ),
      );
  }

  res.status(201).json(log);
});

// GET /api/boreholes/:id/logs - drilling log history with date range
router.get('/:id/logs', async (req, res) => {
  const { id } = req.params;
  const { from, to, limit = '50' } = req.query as Record<string, string>;

  const conditions = [
    eq(drillingLogs.boreholeId, id),
    eq(drillingLogs.tenantId, req.tenantId),
  ];

  if (from) conditions.push(gte(drillingLogs.logDate, new Date(from)));
  if (to) conditions.push(lte(drillingLogs.logDate, new Date(to)));

  const logs = await db
    .select()
    .from(drillingLogs)
    .where(and(...conditions))
    .orderBy(asc(drillingLogs.logDate))
    .limit(Math.min(parseInt(limit), 500));

  res.json(logs);
});

// GET /api/boreholes/aging-summary (used by Carina financial tool)
router.get('/aging-summary', async (req, res) => {
  // Redirect to invoices aging endpoint; this is a convenience alias
  res.redirect('/api/invoices/aging-summary');
});

export default router;
```

### 4. Register routes in app

In `abbis/apps/api/src/index.ts`, add:
```typescript
import boreholesRouter from './routes/boreholes.js';
app.use('/api/boreholes', boreholesRouter);
```

### 5. Vitest test

`abbis/apps/api/src/routes/boreholes.test.ts`:
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../index.js';
import { db, boreholes } from '@abbis/db';

describe('Boreholes API', () => {
  const tenantId = 'test-tenant-id';
  const authHeader = { Authorization: 'Bearer test-token' };

  it('creates a new borehole project', async () => {
    const res = await request(app)
      .post('/api/boreholes')
      .set(authHeader)
      .send({
        projectCode: 'BH-TEST-001',
        clientName: 'Ghana Water Authority',
        siteName: 'Accra Test Site',
        region: 'greater_accra',
      });
    expect(res.status).toBe(201);
    expect(res.body.projectCode).toBe('BH-TEST-001');
    expect(res.body.status).toBe('planning');
  });

  it('lists boreholes filtered by status', async () => {
    const res = await request(app)
      .get('/api/boreholes?status=planning')
      .set(authHeader);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('submits a drilling log and updates current depth', async () => {
    // First create a project
    const create = await request(app)
      .post('/api/boreholes')
      .set(authHeader)
      .send({ projectCode: 'BH-LOG-001', clientName: 'Test', siteName: 'Site', region: 'eastern' });

    const logRes = await request(app)
      .post(`/api/boreholes/${create.body.id}/logs`)
      .set(authHeader)
      .send({ depthStartM: 0, depthEndM: 20, formationCode: 'laterite', fluidReturns: 'good' });

    expect(logRes.status).toBe(201);

    // Verify depth updated
    const detail = await request(app).get(`/api/boreholes/${create.body.id}`).set(authHeader);
    expect(detail.body.currentDepthM).toBe(20);
  });
});
```

## Expected behavior

```bash
# Create a project
curl -X POST http://localhost:3000/api/boreholes \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"projectCode":"BH-GA-2024-001","clientName":"GWCL","siteName":"Adenta Site","region":"greater_accra","targetDepthM":90}'

# Submit a drilling log
curl -X POST http://localhost:3000/api/boreholes/{id}/logs \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"depthStartM":0,"depthEndM":18,"formationCode":"laterite","fluidReturns":"good","drillBit":"PDC 6-inch"}'

# List active projects
curl http://localhost:3000/api/boreholes?status=drilling -H "Authorization: Bearer $TOKEN"
```

## Pitfalls

- `create_hypertable` will fail if TimescaleDB extension is not loaded. The Docker
  Compose uses `timescale/timescaledb-ha:pg16` which includes the extension; run
  `CREATE EXTENSION IF NOT EXISTS timescaledb;` at the top of the migration if it
  is not automatically activated
- Tenant isolation: every query MUST filter by `tenantId`. Missing this filter is a
  data leak between tenants. The `requireTenant` middleware must set `req.tenantId`
  before any route handler runs
- The drilling log hypertable requires `(id, log_date)` as composite PK; Drizzle's
  `primaryKey()` on a single column will not satisfy TimescaleDB's requirement that the
  partition column be part of the primary key
