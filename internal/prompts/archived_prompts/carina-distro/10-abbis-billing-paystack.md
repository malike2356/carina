# Carina Distro Prompt 10: ABBIS Billing and Paystack integration

## Goal

Build the invoices module and Paystack payment integration: database schema, REST API for
invoices, Paystack webhook handler, subscription plan enforcement, and per-tier feature
gating. This is ABBIS's revenue collection layer.

## Context

ABBIS billing has two dimensions:

1. **Project invoices**: Invoices sent to ABBIS's own clients (borehole commissioners)
   for completed milestones. Paystack collects payment on behalf of ABBIS companies.

2. **ABBIS subscription**: Billing for the ABBIS platform itself. Tenants pay VERLOX
   for ABBIS access on a tier-based plan (Seeker GHS 30, Vendor GHS 60, Operator GHS 150,
   Association GHS 200). See `abbis/strategy/03-pricing.md` for tier details.

This prompt covers both. Implement project invoices first; subscription billing second.

## Dependencies

`08-abbis-crm-module.md` (contacts), `09-abbis-jobs-module.md` (milestones trigger invoices)
Paystack test keys from `.env`

## Files to create

```
abbis/packages/db/src/schema/billing.ts
abbis/packages/db/src/migrations/0005_invoices_and_subscriptions.sql
abbis/apps/api/src/routes/invoices.ts
abbis/apps/api/src/routes/paystack-webhook.ts
abbis/apps/api/src/services/paystack.ts
abbis/apps/api/src/routes/invoices.test.ts
```

## Step-by-step

### 1. Database schema

`abbis/packages/db/src/schema/billing.ts`:
```typescript
import {
  pgTable, uuid, text, numeric, timestamp, integer,
  pgEnum, boolean, jsonb,
} from 'drizzle-orm/pg-core';
import { contacts } from './crm.js';

export const invoiceStatusEnum = pgEnum('invoice_status', [
  'draft', 'sent', 'partial', 'paid', 'overdue', 'cancelled', 'void',
]);

export const invoices = pgTable('invoices', {
  id:               uuid('id').primaryKey().defaultRandom(),
  tenantId:         uuid('tenant_id').notNull(),
  invoiceNumber:    text('invoice_number').notNull().unique(),
  clientId:         uuid('client_id').references(() => contacts.id),
  clientName:       text('client_name').notNull(),
  clientEmail:      text('client_email'),
  status:           invoiceStatusEnum('status').notNull().default('draft'),
  subtotalGhs:      numeric('subtotal_ghs', { precision: 12, scale: 2 }).notNull(),
  taxPct:           numeric('tax_pct', { precision: 5, scale: 2 }).default('0'),
  taxGhs:           numeric('tax_ghs', { precision: 12, scale: 2 }).default('0'),
  totalGhs:         numeric('total_ghs', { precision: 12, scale: 2 }).notNull(),
  amountPaidGhs:    numeric('amount_paid_ghs', { precision: 12, scale: 2 }).default('0'),
  dueDate:          timestamp('due_date', { withTimezone: true }),
  issuedAt:         timestamp('issued_at', { withTimezone: true }),
  paidAt:           timestamp('paid_at', { withTimezone: true }),
  paystackReference: text('paystack_reference').unique(),
  paystackData:     jsonb('paystack_data'),
  notes:            text('notes'),
  createdAt:        timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:        timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const invoiceLines = pgTable('invoice_lines', {
  id:          uuid('id').primaryKey().defaultRandom(),
  invoiceId:   uuid('invoice_id').notNull().references(() => invoices.id),
  description: text('description').notNull(),
  quantity:    numeric('quantity', { precision: 10, scale: 2 }).notNull().default('1'),
  unitPriceGhs: numeric('unit_price_ghs', { precision: 12, scale: 2 }).notNull(),
  totalGhs:    numeric('total_ghs', { precision: 12, scale: 2 }).notNull(),
  milestoneId: uuid('milestone_id'),
  sortOrder:   integer('sort_order').notNull().default(0),
});

export const subscriptionTierEnum = pgEnum('subscription_tier', [
  'seeker', 'vendor', 'operator', 'association',
]);

export const tenantSubscriptions = pgTable('tenant_subscriptions', {
  id:                uuid('id').primaryKey().defaultRandom(),
  tenantId:          uuid('tenant_id').notNull().unique(),
  tier:              subscriptionTierEnum('tier').notNull().default('seeker'),
  status:            text('status').notNull().default('active'),
  monthlyAmountGhs:  numeric('monthly_amount_ghs', { precision: 8, scale: 2 }).notNull(),
  currentPeriodStart: timestamp('current_period_start', { withTimezone: true }),
  currentPeriodEnd:  timestamp('current_period_end', { withTimezone: true }),
  paystackCustomerCode: text('paystack_customer_code'),
  paystackPlanCode:  text('paystack_plan_code'),
  cancelledAt:       timestamp('cancelled_at', { withTimezone: true }),
  createdAt:         timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:         timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Invoice = typeof invoices.$inferSelect;
export type TenantSubscription = typeof tenantSubscriptions.$inferSelect;
```

### 2. Migration SQL

`abbis/packages/db/src/migrations/0005_invoices_and_subscriptions.sql`:
```sql
CREATE TYPE invoice_status AS ENUM ('draft','sent','partial','paid','overdue','cancelled','void');
CREATE TYPE subscription_tier AS ENUM ('seeker','vendor','operator','association');

CREATE TABLE invoices (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL,
  invoice_number      TEXT NOT NULL UNIQUE,
  client_id           UUID REFERENCES contacts(id),
  client_name         TEXT NOT NULL,
  client_email        TEXT,
  status              invoice_status NOT NULL DEFAULT 'draft',
  subtotal_ghs        NUMERIC(12,2) NOT NULL,
  tax_pct             NUMERIC(5,2) DEFAULT 0,
  tax_ghs             NUMERIC(12,2) DEFAULT 0,
  total_ghs           NUMERIC(12,2) NOT NULL,
  amount_paid_ghs     NUMERIC(12,2) DEFAULT 0,
  due_date            TIMESTAMPTZ,
  issued_at           TIMESTAMPTZ,
  paid_at             TIMESTAMPTZ,
  paystack_reference  TEXT UNIQUE,
  paystack_data       JSONB,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE invoice_lines (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id     UUID NOT NULL REFERENCES invoices(id),
  description    TEXT NOT NULL,
  quantity       NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price_ghs NUMERIC(12,2) NOT NULL,
  total_ghs      NUMERIC(12,2) NOT NULL,
  milestone_id   UUID,
  sort_order     INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE tenant_subscriptions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID NOT NULL UNIQUE,
  tier                    subscription_tier NOT NULL DEFAULT 'seeker',
  status                  TEXT NOT NULL DEFAULT 'active',
  monthly_amount_ghs      NUMERIC(8,2) NOT NULL,
  current_period_start    TIMESTAMPTZ,
  current_period_end      TIMESTAMPTZ,
  paystack_customer_code  TEXT,
  paystack_plan_code      TEXT,
  cancelled_at            TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_invoices_tenant  ON invoices (tenant_id);
CREATE INDEX idx_invoices_status  ON invoices (tenant_id, status);
CREATE INDEX idx_invoices_due     ON invoices (due_date) WHERE status NOT IN ('paid','void','cancelled');
```

### 3. Paystack service

`abbis/apps/api/src/services/paystack.ts`:
```typescript
import crypto from 'crypto';

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY ?? '';
const PAYSTACK_BASE = 'https://api.paystack.co';

function paystackHeaders() {
  return {
    Authorization: `Bearer ${PAYSTACK_SECRET}`,
    'Content-Type': 'application/json',
  };
}

export async function initializePayment(params: {
  email: string;
  amountKobo: number;
  reference: string;
  callbackUrl?: string;
  metadata?: Record<string, unknown>;
}): Promise<{ authorizationUrl: string; reference: string }> {
  const res = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
    method: 'POST',
    headers: paystackHeaders(),
    body: JSON.stringify({
      email: params.email,
      amount: params.amountKobo,
      reference: params.reference,
      callback_url: params.callbackUrl,
      metadata: params.metadata,
    }),
  });

  const data = (await res.json()) as {
    status: boolean;
    data: { authorization_url: string; reference: string };
  };

  if (!data.status) throw new Error('Paystack initialization failed');
  return { authorizationUrl: data.data.authorization_url, reference: data.data.reference };
}

export async function verifyTransaction(reference: string): Promise<{
  status: string;
  amount: number;
  paidAt: string;
}> {
  const res = await fetch(`${PAYSTACK_BASE}/transaction/verify/${reference}`, {
    headers: paystackHeaders(),
  });
  const data = (await res.json()) as {
    status: boolean;
    data: { status: string; amount: number; paid_at: string };
  };
  if (!data.status) throw new Error('Paystack verification failed');
  return { status: data.data.status, amount: data.data.amount, paidAt: data.data.paid_at };
}

export function verifyWebhookSignature(body: string, signature: string): boolean {
  const hash = crypto
    .createHmac('sha512', PAYSTACK_SECRET)
    .update(body)
    .digest('hex');
  return hash === signature;
}

export function ghsToPesewas(ghs: number): number {
  return Math.round(ghs * 100);
}
```

### 4. Invoice routes

`abbis/apps/api/src/routes/invoices.ts`:
```typescript
import { Router } from 'express';
import { db } from '@abbis/db';
import { invoices, invoiceLines } from '@abbis/db/schema/billing.js';
import { eq, and, not, inArray, sum, desc } from 'drizzle-orm';
import { requireAuth } from '../middleware/require-auth.js';
import { requireTenant } from '../middleware/require-tenant.js';
import { initializePayment, ghsToPesewas } from '../services/paystack.js';
import { z } from 'zod';
import { randomUUID } from 'crypto';

const router = Router();
router.use(requireAuth, requireTenant);

const invoiceLineSchema = z.object({
  description:  z.string().min(1),
  quantity:     z.number().positive().default(1),
  unitPriceGhs: z.number().positive(),
  milestoneId:  z.string().uuid().optional(),
});

const createInvoiceSchema = z.object({
  clientId:    z.string().uuid().optional(),
  clientName:  z.string().min(1),
  clientEmail: z.string().email().optional(),
  lines:       z.array(invoiceLineSchema).min(1),
  taxPct:      z.number().min(0).max(100).default(0),
  dueDate:     z.string().datetime().optional(),
  notes:       z.string().optional(),
});

// GET /api/invoices
router.get('/', async (req, res) => {
  const { status, limit = '20', offset = '0' } = req.query as Record<string, string>;

  const rows = await db
    .select()
    .from(invoices)
    .where(
      and(
        eq(invoices.tenantId, req.tenantId),
        status ? eq(invoices.status, status as typeof invoices.status._.data) : undefined,
      ),
    )
    .orderBy(desc(invoices.createdAt))
    .limit(Math.min(parseInt(limit), 100))
    .offset(parseInt(offset));

  res.json(rows);
});

// GET /api/invoices/aging-summary
router.get('/aging-summary', async (req, res) => {
  const now = new Date();
  const d30 = new Date(now.getTime() - 30 * 86400000);
  const d60 = new Date(now.getTime() - 60 * 86400000);

  const unpaid = await db
    .select({
      id: invoices.id,
      totalGhs: invoices.totalGhs,
      amountPaidGhs: invoices.amountPaidGhs,
      dueDate: invoices.dueDate,
    })
    .from(invoices)
    .where(
      and(
        eq(invoices.tenantId, req.tenantId),
        not(inArray(invoices.status, ['paid', 'void', 'cancelled'])),
      ),
    );

  let current = 0, days30 = 0, days60 = 0, over60 = 0;

  for (const inv of unpaid) {
    const outstanding = parseFloat(inv.totalGhs) - parseFloat(inv.amountPaidGhs ?? '0');
    if (!inv.dueDate || inv.dueDate > now) current += outstanding;
    else if (inv.dueDate > d30) days30 += outstanding;
    else if (inv.dueDate > d60) days60 += outstanding;
    else over60 += outstanding;
  }

  res.json({
    totalOutstandingGhs: (current + days30 + days60 + over60).toFixed(2),
    aging: {
      currentGhs: current.toFixed(2),
      days1to30Ghs: days30.toFixed(2),
      days31to60Ghs: days60.toFixed(2),
      over60DaysGhs: over60.toFixed(2),
    },
  });
});

// POST /api/invoices
router.post('/', async (req, res) => {
  const parsed = createInvoiceSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'validation', details: parsed.error.flatten() }); return; }

  const { lines, taxPct, ...invoiceData } = parsed.data;

  const subtotal = lines.reduce((acc, l) => acc + l.quantity * l.unitPriceGhs, 0);
  const taxGhs = subtotal * (taxPct / 100);
  const total = subtotal + taxGhs;

  const invoiceNumber = `INV-${Date.now()}`;

  const [created] = await db
    .insert(invoices)
    .values({
      ...invoiceData,
      invoiceNumber,
      tenantId: req.tenantId,
      subtotalGhs: String(subtotal),
      taxPct: String(taxPct),
      taxGhs: String(taxGhs),
      totalGhs: String(total),
    })
    .returning();

  await db.insert(invoiceLines).values(
    lines.map((l, i) => ({
      invoiceId: created.id,
      description: l.description,
      quantity: String(l.quantity),
      unitPriceGhs: String(l.unitPriceGhs),
      totalGhs: String(l.quantity * l.unitPriceGhs),
      milestoneId: l.milestoneId,
      sortOrder: i,
    })),
  );

  res.status(201).json(created);
});

// POST /api/invoices/:id/payment-link - generate Paystack payment link
router.post('/:id/payment-link', async (req, res) => {
  const [inv] = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, req.params.id), eq(invoices.tenantId, req.tenantId)));

  if (!inv) { res.status(404).json({ error: 'not_found' }); return; }
  if (inv.status === 'paid') { res.status(400).json({ error: 'already_paid' }); return; }
  if (!inv.clientEmail) { res.status(400).json({ error: 'no_client_email', message: 'Invoice must have a client email to generate a payment link' }); return; }

  const outstanding = parseFloat(inv.totalGhs) - parseFloat(inv.amountPaidGhs ?? '0');
  const reference = inv.paystackReference ?? `ABBIS-${inv.invoiceNumber}-${randomUUID().slice(0, 8)}`;

  const { authorizationUrl } = await initializePayment({
    email: inv.clientEmail,
    amountKobo: ghsToPesewas(outstanding),
    reference,
    metadata: { invoiceId: inv.id, tenantId: req.tenantId, invoiceNumber: inv.invoiceNumber },
  });

  if (!inv.paystackReference) {
    await db.update(invoices).set({ paystackReference: reference }).where(eq(invoices.id, inv.id));
  }

  res.json({ paymentUrl: authorizationUrl, reference, amountGhs: outstanding });
});

export default router;
```

### 5. Paystack webhook handler

`abbis/apps/api/src/routes/paystack-webhook.ts`:
```typescript
import { Router } from 'express';
import { db } from '@abbis/db';
import { invoices } from '@abbis/db/schema/billing.js';
import { eq } from 'drizzle-orm';
import { verifyWebhookSignature } from '../services/paystack.js';

const router = Router();

// Raw body required for HMAC verification - register BEFORE json middleware on this route
router.post('/', async (req, res) => {
  const signature = req.headers['x-paystack-signature'] as string;
  const rawBody = (req as unknown as { rawBody: string }).rawBody;

  if (!rawBody || !verifyWebhookSignature(rawBody, signature)) {
    res.status(401).json({ error: 'invalid_signature' });
    return;
  }

  const event = JSON.parse(rawBody) as {
    event: string;
    data: {
      reference: string;
      amount: number;
      status: string;
      paid_at: string;
    };
  };

  if (event.event === 'charge.success') {
    const { reference, amount, paid_at } = event.data;

    const [inv] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.paystackReference, reference));

    if (inv) {
      const paidAmountGhs = amount / 100;
      const totalGhs = parseFloat(inv.totalGhs);
      const newPaid = parseFloat(inv.amountPaidGhs ?? '0') + paidAmountGhs;
      const newStatus = newPaid >= totalGhs ? 'paid' : 'partial';

      await db
        .update(invoices)
        .set({
          status: newStatus,
          amountPaidGhs: String(newPaid),
          paidAt: newStatus === 'paid' ? new Date(paid_at) : undefined,
          paystackData: event.data,
          updatedAt: new Date(),
        })
        .where(eq(invoices.id, inv.id));
    }
  }

  res.json({ ok: true });
});

export default router;
```

### 6. Register routes

In `abbis/apps/api/src/index.ts`:

```typescript
import express from 'express';
import invoicesRouter from './routes/invoices.js';
import paystackWebhookRouter from './routes/paystack-webhook.js';

// Paystack webhook needs raw body BEFORE json middleware
app.use('/api/paystack/webhook', express.raw({ type: 'application/json' }), (req, _res, next) => {
  (req as unknown as { rawBody: string }).rawBody = (req.body as Buffer).toString('utf8');
  next();
}, paystackWebhookRouter);

// Normal json parsing for everything else
app.use(express.json());
app.use('/api/invoices', invoicesRouter);
```

Note: the raw body middleware for Paystack must be registered BEFORE the global
`express.json()` middleware, otherwise `req.body` will already be parsed and the raw
string needed for HMAC verification will be lost.

### 7. Subscription tier gating middleware

`abbis/apps/api/src/middleware/require-tier.ts`:
```typescript
import type { Request, Response, NextFunction } from 'express';
import { db } from '@abbis/db';
import { tenantSubscriptions } from '@abbis/db/schema/billing.js';
import { eq } from 'drizzle-orm';

const TIER_LEVEL = { seeker: 0, vendor: 1, operator: 2, association: 3 } as const;

export function requireTier(minimum: keyof typeof TIER_LEVEL) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const [sub] = await db
      .select({ tier: tenantSubscriptions.tier, status: tenantSubscriptions.status })
      .from(tenantSubscriptions)
      .where(eq(tenantSubscriptions.tenantId, req.tenantId));

    if (!sub || sub.status !== 'active') {
      res.status(403).json({ error: 'subscription_required', message: 'Active subscription required' });
      return;
    }

    if (TIER_LEVEL[sub.tier] < TIER_LEVEL[minimum]) {
      res.status(403).json({
        error: 'tier_insufficient',
        message: `This feature requires the ${minimum} plan or higher`,
        currentTier: sub.tier,
        requiredTier: minimum,
      });
      return;
    }

    next();
  };
}
```

Usage: apply to routes that require a minimum plan:
```typescript
import { requireTier } from '../middleware/require-tier.js';

// Only Operator and Association tiers can access AI cost estimation
router.post('/ai/drilling-cost', requireCarina, requireTier('operator'), async (req, res) => { ... });
```

## Expected behavior

```bash
# Create invoice
curl -X POST http://localhost:3000/api/invoices \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "clientName": "Ghana Water Authority",
    "clientEmail": "finance@gwa.gov.gh",
    "lines": [{"description": "30m depth milestone","unitPriceGhs": 8000}]
  }'

# Generate payment link
curl -X POST http://localhost:3000/api/invoices/{id}/payment-link \
  -H "Authorization: Bearer $TOKEN"
# Returns: { "paymentUrl": "https://checkout.paystack.com/...", "reference": "...", "amountGhs": 8000 }
```

## Pitfalls

- Paystack amounts are in the smallest currency unit (pesewas for GHS). `ghsToPesewas`
  multiplies by 100 and rounds. Never send fractional pesewas; Paystack will reject
- The webhook route MUST receive the raw Buffer body for HMAC verification. If `express.json()`
  runs first, `req.body` is a parsed object and the HMAC will not match, causing all
  legitimate webhooks to 401
- Paystack webhooks can be delivered more than once for the same event (at-least-once
  delivery). The handler uses `paystackReference` as a unique key; the `UNIQUE` constraint
  on `paystack_reference` combined with the SELECT-then-UPDATE pattern prevents double-counting
  but does not prevent the DB write from being called twice - add an idempotency check if
  needed
- For production, set Paystack webhook URL in the Paystack dashboard to
  `https://abbis360.com/api/paystack/webhook`
