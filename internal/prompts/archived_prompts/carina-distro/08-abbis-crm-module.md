# Carina Distro Prompt 08: ABBIS CRM module

## Goal

Build the CRM contacts module: database schema and REST API for managing clients,
vendors, contractors, and associations that ABBIS companies interact with. The CRM is
referenced by borehole projects (client), invoices (client), and marketplace orders
(vendor).

## Context

The CRM in ABBIS is a contact store, not a full sales pipeline. It stores:
- Clients (companies or individuals who commission boreholes)
- Vendors (materials suppliers in the marketplace)
- Contractors (subcontractors, service providers)
- Associations (GBDA membership bodies)

Each contact belongs to a tenant. Contacts link to borehole projects and invoices via
foreign key references. The CRM does not need a pipeline or deal stage model for Phase 1.

## Dependencies

`00-distro-workspace-scaffold.md`

## Files to create

```
abbis/packages/db/src/schema/crm.ts
abbis/packages/db/src/migrations/0003_crm_contacts.sql
abbis/apps/api/src/routes/crm.ts
abbis/apps/api/src/routes/crm.test.ts
```

## Step-by-step

### 1. Database schema

`abbis/packages/db/src/schema/crm.ts`:
```typescript
import {
  pgTable, uuid, text, timestamp, pgEnum, boolean, jsonb,
} from 'drizzle-orm/pg-core';

export const contactTypeEnum = pgEnum('contact_type', [
  'client', 'vendor', 'contractor', 'association', 'government', 'other',
]);

export const contacts = pgTable('contacts', {
  id:           uuid('id').primaryKey().defaultRandom(),
  tenantId:     uuid('tenant_id').notNull(),
  type:         contactTypeEnum('type').notNull(),
  displayName:  text('display_name').notNull(),
  companyName:  text('company_name'),
  phone:        text('phone'),
  email:        text('email'),
  region:       text('region'),
  district:     text('district'),
  address:      text('address'),
  notes:        text('notes'),
  tags:         text('tags').array(),
  metadata:     jsonb('metadata'),
  isActive:     boolean('is_active').notNull().default(true),
  createdAt:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:    timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Contact = typeof contacts.$inferSelect;
export type NewContact = typeof contacts.$inferInsert;
```

### 2. Migration SQL

`abbis/packages/db/src/migrations/0003_crm_contacts.sql`:
```sql
CREATE TYPE contact_type AS ENUM (
  'client', 'vendor', 'contractor', 'association', 'government', 'other'
);

CREATE TABLE contacts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL,
  type         contact_type NOT NULL,
  display_name TEXT NOT NULL,
  company_name TEXT,
  phone        TEXT,
  email        TEXT,
  region       TEXT,
  district     TEXT,
  address      TEXT,
  notes        TEXT,
  tags         TEXT[],
  metadata     JSONB,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_contacts_tenant       ON contacts (tenant_id);
CREATE INDEX idx_contacts_type         ON contacts (tenant_id, type);
CREATE INDEX idx_contacts_search       ON contacts USING GIN (to_tsvector('english', display_name || ' ' || coalesce(company_name, '')));
```

### 3. API routes

`abbis/apps/api/src/routes/crm.ts`:
```typescript
import { Router } from 'express';
import { db } from '@abbis/db';
import { contacts } from '@abbis/db/schema/crm.js';
import { eq, and, ilike, or, desc } from 'drizzle-orm';
import { requireAuth } from '../middleware/require-auth.js';
import { requireTenant } from '../middleware/require-tenant.js';
import { z } from 'zod';

const router = Router();
router.use(requireAuth, requireTenant);

const contactSchema = z.object({
  type:        z.enum(['client', 'vendor', 'contractor', 'association', 'government', 'other']),
  displayName: z.string().min(1).max(200),
  companyName: z.string().optional(),
  phone:       z.string().optional(),
  email:       z.string().email().optional(),
  region:      z.string().optional(),
  district:    z.string().optional(),
  address:     z.string().optional(),
  notes:       z.string().optional(),
  tags:        z.array(z.string()).optional(),
});

// GET /api/crm - list with search and type filter
router.get('/', async (req, res) => {
  const { type, q, limit = '20', offset = '0' } = req.query as Record<string, string>;

  const conditions = [
    eq(contacts.tenantId, req.tenantId),
    eq(contacts.isActive, true),
  ];

  if (type) conditions.push(eq(contacts.type, type as typeof contacts.type._.data));
  if (q) {
    conditions.push(
      or(
        ilike(contacts.displayName, `%${q}%`),
        ilike(contacts.companyName, `%${q}%`),
        ilike(contacts.phone, `%${q}%`),
      )!,
    );
  }

  const rows = await db
    .select()
    .from(contacts)
    .where(and(...conditions))
    .orderBy(desc(contacts.updatedAt))
    .limit(Math.min(parseInt(limit), 100))
    .offset(parseInt(offset));

  res.json(rows);
});

// GET /api/crm/:id
router.get('/:id', async (req, res) => {
  const [contact] = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.id, req.params.id), eq(contacts.tenantId, req.tenantId)));

  if (!contact) { res.status(404).json({ error: 'not_found' }); return; }
  res.json(contact);
});

// POST /api/crm
router.post('/', async (req, res) => {
  const parsed = contactSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'validation', details: parsed.error.flatten() }); return; }

  const [created] = await db
    .insert(contacts)
    .values({ ...parsed.data, tenantId: req.tenantId })
    .returning();

  res.status(201).json(created);
});

// PATCH /api/crm/:id
router.patch('/:id', async (req, res) => {
  const parsed = contactSchema.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'validation', details: parsed.error.flatten() }); return; }

  const [updated] = await db
    .update(contacts)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(and(eq(contacts.id, req.params.id), eq(contacts.tenantId, req.tenantId)))
    .returning();

  if (!updated) { res.status(404).json({ error: 'not_found' }); return; }
  res.json(updated);
});

// DELETE /api/crm/:id - soft delete only
router.delete('/:id', async (req, res) => {
  const [updated] = await db
    .update(contacts)
    .set({ isActive: false, updatedAt: new Date() })
    .where(and(eq(contacts.id, req.params.id), eq(contacts.tenantId, req.tenantId)))
    .returning({ id: contacts.id });

  if (!updated) { res.status(404).json({ error: 'not_found' }); return; }
  res.json({ ok: true });
});

export default router;
```

### 4. Register routes

In `abbis/apps/api/src/index.ts`:
```typescript
import crmRouter from './routes/crm.js';
app.use('/api/crm', crmRouter);
```

### 5. Vitest test

`abbis/apps/api/src/routes/crm.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../index.js';

describe('CRM API', () => {
  const auth = { Authorization: 'Bearer test-token' };

  it('creates a client contact', async () => {
    const res = await request(app)
      .post('/api/crm')
      .set(auth)
      .send({ type: 'client', displayName: 'GWCL Accra', phone: '0244000001' });
    expect(res.status).toBe(201);
    expect(res.body.type).toBe('client');
  });

  it('searches by display name', async () => {
    const res = await request(app).get('/api/crm?q=GWCL').set(auth);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('soft deletes a contact', async () => {
    const create = await request(app)
      .post('/api/crm')
      .set(auth)
      .send({ type: 'vendor', displayName: 'Test Vendor' });
    const del = await request(app).delete(`/api/crm/${create.body.id}`).set(auth);
    expect(del.status).toBe(200);

    // Should not appear in list
    const list = await request(app).get('/api/crm?type=vendor').set(auth);
    expect(list.body.find((c: { id: string }) => c.id === create.body.id)).toBeUndefined();
  });
});
```

## Expected behavior

```bash
# Create client
curl -X POST http://localhost:3000/api/crm \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type":"client","displayName":"Greater Accra District Assembly","phone":"030-664-4351","region":"greater_accra"}'

# Search clients
curl "http://localhost:3000/api/crm?type=client&q=Accra" -H "Authorization: Bearer $TOKEN"

# Update contact
curl -X PATCH http://localhost:3000/api/crm/{id} \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email":"info@gada.gov.gh"}'
```

## Pitfalls

- The full-text GIN index uses English stemming; this is fine for company names in English
  but will not stem Twi or Ga names. For V2, switch to `simple` dictionary
- `ilike` (case-insensitive LIKE) does not use the GIN index; it does a sequential scan.
  For large contact lists, switch to `to_tsvector` full-text search with `plainto_tsquery`
- Tags stored as `TEXT[]` support filtering with Postgres `@>` (contains) operator via
  Drizzle's `arrayContains`; add that query param when users request tag filtering
