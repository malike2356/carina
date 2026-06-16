# Carina Distro Prompt 13: Auth, JWT, and multi-tenant foundation

## Goal

Build JWT authentication, tenant records, user accounts, and the `requireAuth` /
`requireTenant` middleware that domain module prompts 07-11 depend on. After this prompt,
every protected API route validates a real JWT and scopes data to the caller's tenant.

## Context

Prompts 07-11 import `requireAuth` and `requireTenant` from middleware files that do not
exist yet. Prompt 12 (deployment validation) assumes a bearer token is available for smoke
tests. Prompt 05's admin UI stores a token in `localStorage` but nothing issues one.

Current state in `/opt/lampp/htdocs/verlox/abbis/`:
- `require-admin.ts` accepts `ADMIN_API_KEY` or `JWT_SECRET` as a static bearer (stub)
- No `users` or `tenants` tables
- No register/login endpoints
- Vitest tests in prompts 07-11 use `Authorization: Bearer test-token` (will not work
  against real middleware without this prompt)

### Run order note

This prompt was added after prompts 07-11 were written. **Run it after prompt 05 and
before prompts 07-11** when building from scratch. If you already implemented 07-11 with
a stub auth bypass, run this prompt now to replace the stub with real JWT auth, then
re-run domain module tests.

Source references:
- `abbis/strategy/11-access-control.md` (tier and subscription fields on the user record)
- `abbis/strategy/05-pricing-model.md` (plan tiers: seeker, vendor, operator, association)

## Dependencies

`00-distro-workspace-scaffold.md`, `05-admin-update-ui.md`

## Files to create

```
abbis/packages/db/src/schema/auth.ts
abbis/packages/db/src/migrations/0000_tenants_and_users.sql
abbis/packages/shared/src/auth-types.ts
abbis/apps/api/src/lib/jwt.ts
abbis/apps/api/src/middleware/require-auth.ts
abbis/apps/api/src/middleware/require-tenant.ts
abbis/apps/api/src/middleware/subscription-guard.ts
abbis/apps/api/src/routes/auth.ts
abbis/apps/api/src/routes/auth.test.ts
abbis/apps/api/src/types/express.d.ts
abbis/.env.test
```

## Files to modify

```
abbis/packages/db/src/schema/index.ts          (export auth schema)
abbis/packages/shared/src/index.ts             (re-export auth types)
abbis/apps/api/src/index.ts                    (mount auth routes; export app for tests)
abbis/apps/api/src/middleware/require-admin.ts (accept JWT with role platform_admin)
abbis/apps/web/src/lib/auth.ts                 (login helper calling /api/auth/login)
abbis/.env.example                             (document TEST_AUTH_TOKEN)
```

## Step-by-step

### 1. Shared auth types

`abbis/packages/shared/src/auth-types.ts`:
```typescript
export type PlanTier = 'seeker' | 'vendor' | 'operator' | 'association';
export type SubscriptionStatus = 'active' | 'grace' | 'suspended' | 'trial';
export type UserRole = 'owner' | 'admin' | 'staff' | 'member' | 'platform_admin';

export interface JwtPayload {
  sub: string;
  tenantId: string | null;
  role: UserRole;
  planTier: PlanTier;
  subscriptionStatus: SubscriptionStatus;
  email: string;
  iat?: number;
  exp?: number;
}

export interface AuthUser {
  id: string;
  tenantId: string | null;
  email: string;
  fullName: string;
  role: UserRole;
  planTier: PlanTier;
  subscriptionStatus: SubscriptionStatus;
  phone: string | null;
}
```

Re-export from `abbis/packages/shared/src/index.ts`.

### 2. Database schema

`abbis/packages/db/src/schema/auth.ts`:
```typescript
import {
  pgTable, uuid, text, timestamp, pgEnum, boolean,
} from 'drizzle-orm/pg-core';

export const planTierEnum = pgEnum('plan_tier', [
  'seeker', 'vendor', 'operator', 'association',
]);

export const subscriptionStatusEnum = pgEnum('subscription_status', [
  'active', 'grace', 'suspended', 'trial',
]);

export const userRoleEnum = pgEnum('user_role', [
  'owner', 'admin', 'staff', 'member', 'platform_admin',
]);

export const tenants = pgTable('tenants', {
  id:              uuid('id').primaryKey().defaultRandom(),
  name:            text('name').notNull(),
  slug:            text('slug').notNull().unique(),
  planTier:        planTierEnum('plan_tier').notNull().default('operator'),
  subscriptionStatus: subscriptionStatusEnum('subscription_status')
    .notNull()
    .default('trial'),
  subscriptionExpiresAt: timestamp('subscription_expires_at', { withTimezone: true }),
  region:          text('region'),
  isActive:        boolean('is_active').notNull().default(true),
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:       timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable('users', {
  id:                  uuid('id').primaryKey().defaultRandom(),
  tenantId:            uuid('tenant_id').references(() => tenants.id),
  email:               text('email').notNull().unique(),
  passwordHash:        text('password_hash').notNull(),
  fullName:            text('full_name').notNull(),
  phone:               text('phone'),
  role:                userRoleEnum('role').notNull().default('owner'),
  planTier:            planTierEnum('plan_tier').notNull().default('operator'),
  subscriptionStatus:  subscriptionStatusEnum('subscription_status')
    .notNull()
    .default('trial'),
  subscriptionExpiresAt: timestamp('subscription_expires_at', { withTimezone: true }),
  isActive:            boolean('is_active').notNull().default(true),
  lastLoginAt:         timestamp('last_login_at', { withTimezone: true }),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Tenant = typeof tenants.$inferSelect;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
```

Export from `abbis/packages/db/src/schema/index.ts`.

### 3. Migration SQL

`abbis/packages/db/src/migrations/0000_tenants_and_users.sql`:

This migration must run **before** `0001_add_system_notifications.sql`. If your database
already has migrations 0001-0006 applied, name this file
`0007_tenants_and_users.sql` instead and skip re-running earlier migrations.

```sql
CREATE TYPE plan_tier AS ENUM ('seeker', 'vendor', 'operator', 'association');
CREATE TYPE subscription_status AS ENUM ('active', 'grace', 'suspended', 'trial');
CREATE TYPE user_role AS ENUM ('owner', 'admin', 'staff', 'member', 'platform_admin');

CREATE TABLE tenants (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                     TEXT NOT NULL,
  slug                     TEXT NOT NULL UNIQUE,
  plan_tier                plan_tier NOT NULL DEFAULT 'operator',
  subscription_status      subscription_status NOT NULL DEFAULT 'trial',
  subscription_expires_at  TIMESTAMPTZ,
  region                   TEXT,
  is_active                BOOLEAN NOT NULL DEFAULT TRUE,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE users (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                UUID REFERENCES tenants(id),
  email                    TEXT NOT NULL UNIQUE,
  password_hash            TEXT NOT NULL,
  full_name                TEXT NOT NULL,
  phone                    TEXT,
  role                     user_role NOT NULL DEFAULT 'owner',
  plan_tier                plan_tier NOT NULL DEFAULT 'operator',
  subscription_status      subscription_status NOT NULL DEFAULT 'trial',
  subscription_expires_at  TIMESTAMPTZ,
  is_active                BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at            TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_tenant  ON users (tenant_id);
CREATE INDEX idx_users_email   ON users (email);
CREATE INDEX idx_tenants_slug  ON tenants (slug);
```

Run migration:
```bash
cd /opt/lampp/htdocs/verlox/abbis
pnpm db:migrate
```

### 4. JWT helpers

`abbis/apps/api/src/lib/jwt.ts`:
```typescript
import jwt from 'jsonwebtoken';
import type { JwtPayload } from '@abbis/shared';

const JWT_SECRET = process.env.JWT_SECRET ?? '';
const ACCESS_TTL_SECONDS = 60 * 60; // 1 hour
const REFRESH_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

function requireSecret(): string {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured');
  }
  return JWT_SECRET;
}

export function signAccessToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, requireSecret(), { expiresIn: ACCESS_TTL_SECONDS });
}

export function signRefreshToken(userId: string): string {
  return jwt.sign({ sub: userId, type: 'refresh' }, requireSecret(), {
    expiresIn: REFRESH_TTL_SECONDS,
  });
}

export function verifyAccessToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, requireSecret());
  if (typeof decoded === 'string' || !decoded || typeof decoded !== 'object') {
    throw new Error('Invalid token payload');
  }
  return decoded as JwtPayload;
}

export function verifyRefreshToken(token: string): { sub: string } {
  const decoded = jwt.verify(token, requireSecret());
  if (typeof decoded === 'string' || !decoded || typeof decoded !== 'object') {
    throw new Error('Invalid refresh token');
  }
  const payload = decoded as { sub?: string; type?: string };
  if (payload.type !== 'refresh' || !payload.sub) {
    throw new Error('Invalid refresh token type');
  }
  return { sub: payload.sub };
}
```

### 5. Express type augmentation

`abbis/apps/api/src/types/express.d.ts`:
```typescript
import type { JwtPayload } from '@abbis/shared';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      tenantId?: string;
    }
  }
}

export {};
```

Ensure `tsconfig.json` includes `"src/types/express.d.ts"` in the `include` array.

### 6. Auth middleware

`abbis/apps/api/src/middleware/require-auth.ts`:
```typescript
import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../lib/jwt.js';

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const testToken = process.env.TEST_AUTH_TOKEN;
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';

  if (process.env.NODE_ENV === 'test' && testToken && token === testToken) {
    req.user = {
      sub: 'test-user-id',
      tenantId: 'test-tenant-id',
      role: 'owner',
      planTier: 'operator',
      subscriptionStatus: 'active',
      email: 'test@abbis360.com',
    };
    next();
    return;
  }

  if (!token) {
    res.status(401).json({ error: 'unauthorized', message: 'Bearer token required' });
    return;
  }

  try {
    req.user = verifyAccessToken(token);
    next();
  } catch {
    res.status(401).json({ error: 'unauthorized', message: 'Invalid or expired token' });
  }
}
```

`abbis/apps/api/src/middleware/require-tenant.ts`:
```typescript
import type { Request, Response, NextFunction } from 'express';

export function requireTenant(req: Request, res: Response, next: NextFunction): void {
  const tenantId = req.user?.tenantId;
  if (!tenantId) {
    res.status(403).json({
      error: 'tenant_required',
      message: 'This endpoint requires a tenant-scoped account',
    });
    return;
  }
  req.tenantId = tenantId;
  next();
}
```

`abbis/apps/api/src/middleware/subscription-guard.ts`:
```typescript
import type { Request, Response, NextFunction } from 'express';

export function subscriptionGuard(req: Request, res: Response, next: NextFunction): void {
  const status = req.user?.subscriptionStatus;
  if (status === 'suspended') {
    res.status(403).json({
      error: 'subscription_suspended',
      message: 'Your subscription has lapsed. Renew via Mobile Money to continue.',
    });
    return;
  }
  if (status === 'grace' && req.method !== 'GET') {
    res.status(402).json({
      error: 'subscription_grace',
      message: 'Your subscription is in a grace period. Writing is paused until renewal.',
    });
    return;
  }
  next();
}
```

Apply `subscriptionGuard` after `requireAuth` on write routes in domain modules (optional
in this prompt; domain prompts can add it later). At minimum, export it for reuse.

### 7. Auth routes

`abbis/apps/api/src/routes/auth.ts`:
```typescript
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '@abbis/db';
import { users, tenants } from '@abbis/db/schema/auth.js';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../lib/jwt.js';
import { requireAuth } from '../middleware/require-auth.js';

const router = Router();
const BCRYPT_ROUNDS = 12;

const registerSchema = z.object({
  companyName: z.string().min(2).max(200),
  fullName:  z.string().min(2).max(200),
  email:     z.string().email(),
  password:  z.string().min(8).max(128),
  phone:     z.string().optional(),
  region:    z.string().optional(),
  planTier:  z.enum(['seeker', 'vendor', 'operator']).default('operator'),
});

const loginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
});

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

// POST /api/auth/register - creates tenant + owner user (operator signup flow)
router.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'validation_error', details: parsed.error.flatten() });
    return;
  }

  const { companyName, fullName, email, password, phone, region, planTier } = parsed.data;

  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (existing.length > 0) {
    res.status(409).json({ error: 'email_taken' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const slug = `${slugify(companyName)}-${Date.now().toString(36)}`;
  const trialExpires = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  const [tenant] = await db
    .insert(tenants)
    .values({
      name: companyName,
      slug,
      planTier,
      subscriptionStatus: 'trial',
      subscriptionExpiresAt: trialExpires,
      region: region ?? null,
    })
    .returning();

  if (!tenant) {
    res.status(500).json({ error: 'tenant_create_failed' });
    return;
  }

  const [user] = await db
    .insert(users)
    .values({
      tenantId: tenant.id,
      email,
      passwordHash,
      fullName,
      phone: phone ?? null,
      role: 'owner',
      planTier,
      subscriptionStatus: 'trial',
      subscriptionExpiresAt: trialExpires,
    })
    .returning({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
      role: users.role,
      planTier: users.planTier,
      subscriptionStatus: users.subscriptionStatus,
      tenantId: users.tenantId,
    });

  if (!user) {
    res.status(500).json({ error: 'user_create_failed' });
    return;
  }

  const accessToken = signAccessToken({
    sub: user.id,
    tenantId: user.tenantId,
    role: user.role,
    planTier: user.planTier,
    subscriptionStatus: user.subscriptionStatus,
    email: user.email,
  });
  const refreshToken = signRefreshToken(user.id);

  res.status(201).json({
    user,
    tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
    accessToken,
    refreshToken,
  });
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'validation_error' });
    return;
  }

  const { email, password } = parsed.data;
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  if (!user || !user.isActive) {
    res.status(401).json({ error: 'invalid_credentials' });
    return;
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    res.status(401).json({ error: 'invalid_credentials' });
    return;
  }

  await db
    .update(users)
    .set({ lastLoginAt: new Date(), updatedAt: new Date() })
    .where(eq(users.id, user.id));

  const accessToken = signAccessToken({
    sub: user.id,
    tenantId: user.tenantId,
    role: user.role,
    planTier: user.planTier,
    subscriptionStatus: user.subscriptionStatus,
    email: user.email,
  });
  const refreshToken = signRefreshToken(user.id);

  res.json({
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      planTier: user.planTier,
      subscriptionStatus: user.subscriptionStatus,
      tenantId: user.tenantId,
    },
  });
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res) => {
  const refreshToken = String(req.body?.refreshToken ?? '');
  if (!refreshToken) {
    res.status(400).json({ error: 'refresh_token_required' });
    return;
  }

  try {
    const { sub } = verifyRefreshToken(refreshToken);
    const [user] = await db.select().from(users).where(eq(users.id, sub)).limit(1);
    if (!user || !user.isActive) {
      res.status(401).json({ error: 'invalid_refresh_token' });
      return;
    }

    const accessToken = signAccessToken({
      sub: user.id,
      tenantId: user.tenantId,
      role: user.role,
      planTier: user.planTier,
      subscriptionStatus: user.subscriptionStatus,
      email: user.email,
    });

    res.json({ accessToken });
  } catch {
    res.status(401).json({ error: 'invalid_refresh_token' });
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req, res) => {
  const userId = req.user?.sub;
  if (!userId) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }

  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
      role: users.role,
      planTier: users.planTier,
      subscriptionStatus: users.subscriptionStatus,
      tenantId: users.tenantId,
      phone: users.phone,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    res.status(404).json({ error: 'user_not_found' });
    return;
  }

  res.json({ user });
});

export default router;
```

### 8. Update requireAdmin

Update `abbis/apps/api/src/middleware/require-admin.ts` to accept either:
1. `ADMIN_API_KEY` bearer (VERLOX platform ops), or
2. A valid JWT whose payload has `role: 'platform_admin'`

Keep the existing `ADMIN_API_KEY` path for backward compatibility with prompt 05.

### 9. Mount routes and export app for tests

Update `abbis/apps/api/src/index.ts`:
```typescript
import authRouter from './routes/auth.js';

app.use('/api/auth', authRouter);

export { app };
```

Refactor `start()` so tests can import `app` without listening on a port. Pattern:
```typescript
const app = express();
// ... middleware and routes ...
export { app };

async function start(): Promise<void> {
  // queue worker setup
  app.listen(port, () => { ... });
}

if (process.env.VITEST !== 'true') {
  start().catch(...);
}
```

Set `VITEST=true` in `vitest.config.ts` env.

### 10. Test environment

`abbis/.env.test`:
```bash
NODE_ENV=test
JWT_SECRET=test-jwt-secret-for-vitest-only
TEST_AUTH_TOKEN=test-token
DATABASE_URL=postgresql://abbis:changeme@localhost:5432/abbis_test
```

`abbis/apps/api/vitest.config.ts` - add:
```typescript
env: {
  VITEST: 'true',
  NODE_ENV: 'test',
  JWT_SECRET: 'test-jwt-secret-for-vitest-only',
  TEST_AUTH_TOKEN: 'test-token',
},
```

This makes `Authorization: Bearer test-token` work in domain module tests (prompts 07-11)
without hitting the database.

### 11. Web login helper

Update `abbis/apps/web/src/lib/auth.ts`:
```typescript
export async function login(email: string, password: string): Promise<void> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    throw new Error('Login failed');
  }
  const data = await res.json() as {
    accessToken: string;
    user: { role: string; fullName: string };
  };
  localStorage.setItem('token', data.accessToken);
  localStorage.setItem('abbis_user', JSON.stringify({
    role: data.user.role,
    name: data.user.fullName,
  }));
}
```

Add a minimal login page at `apps/web/src/pages/LoginPage.tsx` and route `/login` in
`App.tsx`. The admin dashboard at `/admin` should redirect to `/login` when no token
is stored.

### 12. Vitest tests

`abbis/apps/api/src/routes/auth.test.ts`:
```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../index.js';

describe('Auth API', () => {
  let accessToken: string;
  const email = `owner-${Date.now()}@test.abbis360.com`;

  it('registers a tenant and owner user', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        companyName: 'Test Drilling Co',
        fullName: 'Test Owner',
        email,
        password: 'securepass123',
        region: 'greater_accra',
        planTier: 'operator',
      });
    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.tenant.slug).toBeTruthy();
    accessToken = res.body.accessToken;
  });

  it('rejects duplicate email on register', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        companyName: 'Another Co',
        fullName: 'Dup User',
        email,
        password: 'securepass123',
      });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('email_taken');
  });

  it('logs in with valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'securepass123' });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
    accessToken = res.body.accessToken;
  });

  it('returns current user from /me', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(email);
    expect(res.body.user.planTier).toBe('operator');
  });

  it('rejects /me without token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('accepts TEST_AUTH_TOKEN in test env for domain routes', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer test-token');
    expect(res.status).toBe(200);
  });
});
```

Note: the last test passes because `requireAuth` short-circuits on `TEST_AUTH_TOKEN` when
`NODE_ENV=test`. `/me` still needs a real user for a full integration test; the test-token
path is primarily for domain module route tests that only need `req.tenantId` set.

## Expected behavior

```bash
# Register a new operator tenant (14-day trial)
curl -s -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "companyName": "Accra Boreholes Ltd",
    "fullName": "Kwame Mensah",
    "email": "kwame@accra-boreholes.gh",
    "password": "changeme123",
    "region": "greater_accra",
    "planTier": "operator"
  }' | jq '.accessToken, .tenant.slug'

# Login
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"kwame@accra-boreholes.gh","password":"changeme123"}' \
  | jq -r '.accessToken')

# Verify identity
curl -s http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer $TOKEN" | jq '.user.fullName'
# Returns: "Kwame Mensah"

# Domain routes now work with real JWT (after prompts 07-11 are implemented)
curl -s http://localhost:3000/api/boreholes \
  -H "Authorization: Bearer $TOKEN"
```

## Test

```bash
cd /opt/lampp/htdocs/verlox/abbis
pnpm db:migrate
pnpm --filter @abbis/api test
```

Expected: all auth tests pass. Domain module tests using `Bearer test-token` pass when
`NODE_ENV=test` and `TEST_AUTH_TOKEN=test-token` are set.

Re-run prompt 12 deployment validation section 6 using a token from `/api/auth/login`
instead of a hardcoded stub.

## Pitfalls

- Migration order: `0000_tenants_and_users.sql` must run before domain migrations if
  starting fresh. Existing databases with 0001-0006 already applied need `0007_` instead.
- Never commit real passwords or production `JWT_SECRET` values. Use `.env` locally only.
- `TEST_AUTH_TOKEN` bypass is disabled outside `NODE_ENV=test`. Do not set `NODE_ENV=test`
  in production docker-compose.
- Seeker and vendor tiers have `tenantId: null` on the user record. Only operator and
  association tiers get a tenant on register. Tier 1/2 registration is a separate flow
  (future prompt); this prompt implements the operator signup path only.
- Rate-limit `/api/auth/login` and `/api/auth/register` in production (add express-rate-limit
  in a follow-up prompt). For now, document the requirement in code comments only.
- bcrypt with cost 12 is intentionally slow; do not lower the cost factor below 10.

## Dependencies for downstream prompts

Prompts 07-11 can import `requireAuth` and `requireTenant` once this prompt is complete.
Prompt 12 smoke tests should obtain tokens via `/api/auth/register` or `/api/auth/login`.
Prompt 10 (Paystack billing) can sync `subscription_status` on the user and tenant records
defined here.
