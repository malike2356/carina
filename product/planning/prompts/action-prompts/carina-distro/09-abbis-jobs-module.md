# Carina Distro Prompt 09: ABBIS Jobs module

## Goal

Build the jobs and project management module: database schema and REST API for tracking
borehole project jobs, milestones, expenses, and crew assignments. Jobs sit on top of
borehole records and provide the financial and operational tracking layer.

## Context

A "borehole" in ABBIS is the physical asset being drilled. A "job" is the contract to
drill it: it has a budget, milestones, crew assignments, and expenses. One borehole has
one job. The job record links the borehole to the invoice and P&L.

Milestones represent payment-triggering stages (e.g., "Completed 30m depth", "Casing
installed", "Pump commissioned"). Each milestone has a value in GHS. When a client
approves a milestone, it triggers an invoice line item.

## Dependencies

`07-abbis-boreholes-module.md` (boreholes table must exist; jobs reference it)
`08-abbis-crm-module.md` (contacts table must exist; job.clientId references it)

## Files to create

```
abbis/packages/db/src/schema/jobs.ts
abbis/packages/db/src/migrations/0004_jobs_milestones_expenses.sql
abbis/apps/api/src/routes/jobs.ts
abbis/apps/api/src/routes/jobs.test.ts
```

## Step-by-step

### 1. Database schema

`abbis/packages/db/src/schema/jobs.ts`:
```typescript
import {
  pgTable, uuid, text, numeric, integer, timestamp,
  pgEnum, boolean,
} from 'drizzle-orm/pg-core';
import { boreholes } from './boreholes.js';
import { contacts } from './crm.js';

export const jobStatusEnum = pgEnum('job_status', [
  'draft', 'active', 'on_hold', 'completed', 'cancelled',
]);

export const milestoneStatusEnum = pgEnum('milestone_status', [
  'pending', 'reached', 'client_approved', 'invoiced', 'paid',
]);

export const jobs = pgTable('jobs', {
  id:               uuid('id').primaryKey().defaultRandom(),
  tenantId:         uuid('tenant_id').notNull(),
  boreholeId:       uuid('borehole_id').notNull().references(() => boreholes.id),
  clientId:         uuid('client_id').references(() => contacts.id),
  jobNumber:        text('job_number').notNull().unique(),
  title:            text('title').notNull(),
  status:           jobStatusEnum('status').notNull().default('draft'),
  contractValueGhs: numeric('contract_value_ghs', { precision: 12, scale: 2 }).notNull(),
  budgetGhs:        numeric('budget_ghs', { precision: 12, scale: 2 }),
  startDate:        timestamp('start_date', { withTimezone: true }),
  targetEndDate:    timestamp('target_end_date', { withTimezone: true }),
  completedAt:      timestamp('completed_at', { withTimezone: true }),
  notes:            text('notes'),
  createdAt:        timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:        timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const jobMilestones = pgTable('job_milestones', {
  id:               uuid('id').primaryKey().defaultRandom(),
  jobId:            uuid('job_id').notNull().references(() => jobs.id),
  tenantId:         uuid('tenant_id').notNull(),
  title:            text('title').notNull(),
  description:      text('description'),
  valueGhs:         numeric('value_ghs', { precision: 12, scale: 2 }).notNull(),
  status:           milestoneStatusEnum('status').notNull().default('pending'),
  targetDepthM:     integer('target_depth_m'),
  reachedAt:        timestamp('reached_at', { withTimezone: true }),
  approvedAt:       timestamp('approved_at', { withTimezone: true }),
  approvedBy:       text('approved_by'),
  sortOrder:        integer('sort_order').notNull().default(0),
  createdAt:        timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:        timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const expenseCategoryEnum = pgEnum('expense_category', [
  'fuel', 'materials', 'crew_wages', 'rig_hire', 'transport',
  'accommodation', 'permits', 'maintenance', 'other',
]);

export const jobExpenses = pgTable('job_expenses', {
  id:          uuid('id').primaryKey().defaultRandom(),
  jobId:       uuid('job_id').notNull().references(() => jobs.id),
  tenantId:    uuid('tenant_id').notNull(),
  category:    expenseCategoryEnum('category').notNull(),
  description: text('description').notNull(),
  amountGhs:   numeric('amount_ghs', { precision: 12, scale: 2 }).notNull(),
  receiptRef:  text('receipt_ref'),
  expenseDate: timestamp('expense_date', { withTimezone: true }).notNull().defaultNow(),
  recordedBy:  uuid('recorded_by'),
  createdAt:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const jobCrewAssignments = pgTable('job_crew_assignments', {
  id:          uuid('id').primaryKey().defaultRandom(),
  jobId:       uuid('job_id').notNull().references(() => jobs.id),
  tenantId:    uuid('tenant_id').notNull(),
  userId:      uuid('user_id').notNull(),
  role:        text('role').notNull(),
  dailyRateGhs: numeric('daily_rate_ghs', { precision: 10, scale: 2 }),
  assignedFrom: timestamp('assigned_from', { withTimezone: true }),
  assignedTo:   timestamp('assigned_to', { withTimezone: true }),
  createdAt:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Job = typeof jobs.$inferSelect;
export type JobMilestone = typeof jobMilestones.$inferSelect;
export type JobExpense = typeof jobExpenses.$inferSelect;
```

### 2. Migration SQL

`abbis/packages/db/src/migrations/0004_jobs_milestones_expenses.sql`:
```sql
CREATE TYPE job_status AS ENUM ('draft', 'active', 'on_hold', 'completed', 'cancelled');
CREATE TYPE milestone_status AS ENUM ('pending', 'reached', 'client_approved', 'invoiced', 'paid');
CREATE TYPE expense_category AS ENUM (
  'fuel', 'materials', 'crew_wages', 'rig_hire', 'transport',
  'accommodation', 'permits', 'maintenance', 'other'
);

CREATE TABLE jobs (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID NOT NULL,
  borehole_id        UUID NOT NULL REFERENCES boreholes(id),
  client_id          UUID REFERENCES contacts(id),
  job_number         TEXT NOT NULL UNIQUE,
  title              TEXT NOT NULL,
  status             job_status NOT NULL DEFAULT 'draft',
  contract_value_ghs NUMERIC(12, 2) NOT NULL,
  budget_ghs         NUMERIC(12, 2),
  start_date         TIMESTAMPTZ,
  target_end_date    TIMESTAMPTZ,
  completed_at       TIMESTAMPTZ,
  notes              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE job_milestones (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id         UUID NOT NULL REFERENCES jobs(id),
  tenant_id      UUID NOT NULL,
  title          TEXT NOT NULL,
  description    TEXT,
  value_ghs      NUMERIC(12, 2) NOT NULL,
  status         milestone_status NOT NULL DEFAULT 'pending',
  target_depth_m INTEGER,
  reached_at     TIMESTAMPTZ,
  approved_at    TIMESTAMPTZ,
  approved_by    TEXT,
  sort_order     INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE job_expenses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id       UUID NOT NULL REFERENCES jobs(id),
  tenant_id    UUID NOT NULL,
  category     expense_category NOT NULL,
  description  TEXT NOT NULL,
  amount_ghs   NUMERIC(12, 2) NOT NULL,
  receipt_ref  TEXT,
  expense_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  recorded_by  UUID,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE job_crew_assignments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id         UUID NOT NULL REFERENCES jobs(id),
  tenant_id      UUID NOT NULL,
  user_id        UUID NOT NULL,
  role           TEXT NOT NULL,
  daily_rate_ghs NUMERIC(10, 2),
  assigned_from  TIMESTAMPTZ,
  assigned_to    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_jobs_tenant    ON jobs (tenant_id);
CREATE INDEX idx_jobs_borehole  ON jobs (borehole_id);
CREATE INDEX idx_jobs_status    ON jobs (tenant_id, status);
CREATE INDEX idx_milestones_job ON job_milestones (job_id, sort_order);
CREATE INDEX idx_expenses_job   ON job_expenses (job_id, expense_date DESC);
```

### 3. API routes

`abbis/apps/api/src/routes/jobs.ts`:
```typescript
import { Router } from 'express';
import { db } from '@abbis/db';
import { jobs, jobMilestones, jobExpenses, jobCrewAssignments } from '@abbis/db/schema/jobs.js';
import { eq, and, sum, desc } from 'drizzle-orm';
import { requireAuth } from '../middleware/require-auth.js';
import { requireTenant } from '../middleware/require-tenant.js';
import { z } from 'zod';

const router = Router();
router.use(requireAuth, requireTenant);

const createJobSchema = z.object({
  boreholeId:       z.string().uuid(),
  clientId:         z.string().uuid().optional(),
  jobNumber:        z.string().min(1).max(50),
  title:            z.string().min(1),
  contractValueGhs: z.number().positive(),
  budgetGhs:        z.number().positive().optional(),
  startDate:        z.string().datetime().optional(),
  targetEndDate:    z.string().datetime().optional(),
  notes:            z.string().optional(),
  milestones:       z.array(z.object({
    title:        z.string(),
    description:  z.string().optional(),
    valueGhs:     z.number().positive(),
    targetDepthM: z.number().int().optional(),
    sortOrder:    z.number().int().optional(),
  })).optional(),
});

// GET /api/jobs
router.get('/', async (req, res) => {
  const { status, limit = '20', offset = '0' } = req.query as Record<string, string>;

  const rows = await db
    .select()
    .from(jobs)
    .where(
      and(
        eq(jobs.tenantId, req.tenantId),
        status ? eq(jobs.status, status as typeof jobs.status._.data) : undefined,
      ),
    )
    .orderBy(desc(jobs.createdAt))
    .limit(Math.min(parseInt(limit), 100))
    .offset(parseInt(offset));

  res.json(rows);
});

// GET /api/jobs/:id - job with milestones and cost summary
router.get('/:id', async (req, res) => {
  const [job] = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.id, req.params.id), eq(jobs.tenantId, req.tenantId)));

  if (!job) { res.status(404).json({ error: 'not_found' }); return; }

  const milestones = await db
    .select()
    .from(jobMilestones)
    .where(eq(jobMilestones.jobId, job.id))
    .orderBy(jobMilestones.sortOrder);

  const [expenseAgg] = await db
    .select({ total: sum(jobExpenses.amountGhs) })
    .from(jobExpenses)
    .where(eq(jobExpenses.jobId, job.id));

  const totalExpenses = parseFloat(expenseAgg?.total ?? '0');
  const contractValue = parseFloat(job.contractValueGhs);
  const margin = contractValue - totalExpenses;

  res.json({
    ...job,
    milestones,
    costSummary: {
      contractValueGhs: contractValue,
      totalExpensesGhs: totalExpenses,
      marginGhs: margin,
      marginPct: contractValue > 0 ? ((margin / contractValue) * 100).toFixed(1) : null,
    },
  });
});

// POST /api/jobs - create job (optionally with milestones)
router.post('/', async (req, res) => {
  const parsed = createJobSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'validation', details: parsed.error.flatten() }); return; }

  const { milestones, ...jobData } = parsed.data;

  const [created] = await db
    .insert(jobs)
    .values({ ...jobData, tenantId: req.tenantId })
    .returning();

  if (milestones && milestones.length > 0) {
    await db.insert(jobMilestones).values(
      milestones.map((m, i) => ({
        ...m,
        jobId: created.id,
        tenantId: req.tenantId,
        sortOrder: m.sortOrder ?? i,
      })),
    );
  }

  res.status(201).json(created);
});

// PATCH /api/jobs/:id/milestones/:milestoneId - mark milestone reached or approved
router.patch('/:id/milestones/:milestoneId', async (req, res) => {
  const { id, milestoneId } = req.params;
  const { action } = req.body as { action: 'reach' | 'approve' };

  const [milestone] = await db
    .select()
    .from(jobMilestones)
    .where(and(eq(jobMilestones.id, milestoneId), eq(jobMilestones.jobId, id)));

  if (!milestone) { res.status(404).json({ error: 'not_found' }); return; }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (action === 'reach') {
    updates.status = 'reached';
    updates.reachedAt = new Date();
  } else if (action === 'approve') {
    updates.status = 'client_approved';
    updates.approvedAt = new Date();
    updates.approvedBy = req.user.id;
  } else {
    res.status(400).json({ error: 'invalid_action', message: 'action must be reach or approve' });
    return;
  }

  const [updated] = await db
    .update(jobMilestones)
    .set(updates)
    .where(eq(jobMilestones.id, milestoneId))
    .returning();

  res.json(updated);
});

// POST /api/jobs/:id/expenses - record an expense
router.post('/:id/expenses', async (req, res) => {
  const { id } = req.params;

  const [job] = await db
    .select({ id: jobs.id })
    .from(jobs)
    .where(and(eq(jobs.id, id), eq(jobs.tenantId, req.tenantId)));

  if (!job) { res.status(404).json({ error: 'not_found' }); return; }

  const expenseSchema = z.object({
    category:    z.enum(['fuel', 'materials', 'crew_wages', 'rig_hire', 'transport', 'accommodation', 'permits', 'maintenance', 'other']),
    description: z.string().min(1),
    amountGhs:   z.number().positive(),
    receiptRef:  z.string().optional(),
    expenseDate: z.string().datetime().optional(),
  });

  const parsed = expenseSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'validation', details: parsed.error.flatten() }); return; }

  const [expense] = await db
    .insert(jobExpenses)
    .values({
      ...parsed.data,
      jobId: id,
      tenantId: req.tenantId,
      recordedBy: req.user.id,
      expenseDate: parsed.data.expenseDate ? new Date(parsed.data.expenseDate) : new Date(),
    })
    .returning();

  res.status(201).json(expense);
});

// GET /api/jobs/:id/expenses
router.get('/:id/expenses', async (req, res) => {
  const expenses = await db
    .select()
    .from(jobExpenses)
    .where(and(eq(jobExpenses.jobId, req.params.id), eq(jobExpenses.tenantId, req.tenantId)))
    .orderBy(desc(jobExpenses.expenseDate));

  res.json(expenses);
});

export default router;
```

### 4. Register routes

In `abbis/apps/api/src/index.ts`:
```typescript
import jobsRouter from './routes/jobs.js';
app.use('/api/jobs', jobsRouter);
```

### 5. Vitest test

`abbis/apps/api/src/routes/jobs.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../index.js';

describe('Jobs API', () => {
  const auth = { Authorization: 'Bearer test-token' };
  let jobId: string;

  it('creates a job with milestones', async () => {
    const res = await request(app)
      .post('/api/jobs')
      .set(auth)
      .send({
        boreholeId: 'test-borehole-id',
        jobNumber: 'JOB-2024-001',
        title: 'Adenta 90m Borehole',
        contractValueGhs: 25000,
        milestones: [
          { title: '30m depth reached', valueGhs: 8000, targetDepthM: 30, sortOrder: 0 },
          { title: 'Casing installed', valueGhs: 10000, sortOrder: 1 },
          { title: 'Pump commissioned', valueGhs: 7000, sortOrder: 2 },
        ],
      });
    expect(res.status).toBe(201);
    jobId = res.body.id;
  });

  it('returns job detail with milestones and cost summary', async () => {
    const res = await request(app).get(`/api/jobs/${jobId}`).set(auth);
    expect(res.status).toBe(200);
    expect(res.body.milestones).toHaveLength(3);
    expect(res.body.costSummary.contractValueGhs).toBe(25000);
  });

  it('marks milestone as reached', async () => {
    const detail = await request(app).get(`/api/jobs/${jobId}`).set(auth);
    const milestoneId = detail.body.milestones[0].id;

    const res = await request(app)
      .patch(`/api/jobs/${jobId}/milestones/${milestoneId}`)
      .set(auth)
      .send({ action: 'reach' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('reached');
  });

  it('records an expense and updates cost summary', async () => {
    await request(app)
      .post(`/api/jobs/${jobId}/expenses`)
      .set(auth)
      .send({ category: 'fuel', description: 'Diesel for rig', amountGhs: 1200 });

    const detail = await request(app).get(`/api/jobs/${jobId}`).set(auth);
    expect(parseFloat(detail.body.costSummary.totalExpensesGhs)).toBe(1200);
  });
});
```

## Expected behavior

```bash
# Create a job with milestone-based contract
curl -X POST http://localhost:3000/api/jobs \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "boreholeId": "...",
    "jobNumber": "JOB-GA-2024-001",
    "title": "90m Borehole - Adenta Community",
    "contractValueGhs": 25000,
    "milestones": [
      {"title": "30m depth", "valueGhs": 8000, "targetDepthM": 30},
      {"title": "Casing installed", "valueGhs": 10000},
      {"title": "Pump commissioned", "valueGhs": 7000}
    ]
  }'

# Mark milestone reached when depth logged
curl -X PATCH http://localhost:3000/api/jobs/{jobId}/milestones/{milestoneId} \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"action": "reach"}'
```

## Pitfalls

- The cost summary margin calculation uses `SUM(amount_ghs)` from all expenses; if no
  expenses are recorded yet, `expenseAgg.total` is `null` and must be defaulted to `'0'`
  before calling `parseFloat` (already done in the route above - verify on your Drizzle
  version)
- Milestones should only move forward in status (pending -> reached -> client_approved ->
  invoiced -> paid). Add a guard that rejects backwards transitions if the data model
  requires it
- `job_crew_assignments` routes are not implemented here; add them in a follow-up when
  the user/staff management module is built
