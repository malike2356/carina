# TB-003: Platform API Gateway (api.carinaai.uk)

**Sprint:** Tollbooth platform infrastructure
**Phase:** 2 - Open the road to partners
**Depends on:** TB-001 (events), TB-002 (partner API keys)
**Target repo:** `02-backends/core.carinaai.uk`
**Agent:** Claude Code

---

## Context

This is the public face of the tollbooth. `api.carinaai.uk` is the authenticated gateway
that certified partners call to route AI work through Carina. Every request is authenticated
with a partner API key (TB-002), attributed to a partner workspace, and generates a
`platform_event` (TB-001).

The Propreneur bridge (`src/api/hosted-migrations.ts` has the org structure) is the
first consumer. The gateway generalises that pattern so any certified partner can access
the same capabilities.

The gateway is served from the existing `core.carinaai.uk` Express server on the same
port. nginx routes `api.carinaai.uk` to the same upstream as `core.carinaai.uk` with
a separate `server` block in `docker/nginx/carina-prod.conf`.

---

## Task

### 1. Gateway auth middleware

Create `src/api/middleware/partner-gateway-auth.ts`:

```typescript
import type { Request, Response, NextFunction } from 'express';
import { resolvePartnerApiKey } from '../../hosted/partner-api-key-service.js';
import { getPartnerAccount } from '../../hosted/partner-service.js';

export interface GatewayRequest extends Request {
  partner?: {
    keyId: string;
    partnerId: string;
    partnerName: string;
    scopes: string[];
    revenueSharBps: number;
  };
}

export async function partnerGatewayAuth(
  req: GatewayRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'missing_bearer_token' });
    return;
  }
  const rawKey = authHeader.slice(7);
  const key = await resolvePartnerApiKey(rawKey);
  if (!key) {
    res.status(401).json({ error: 'invalid_api_key' });
    return;
  }
  const partner = await getPartnerAccount(key.partnerId);
  if (!partner || partner.status !== 'active') {
    res.status(403).json({ error: 'partner_account_inactive' });
    return;
  }
  req.partner = {
    keyId: key.id,
    partnerId: key.partnerId,
    partnerName: partner.name,
    scopes: key.scopes,
    revenueSharBps: key.revenueSharBps,
  };
  next();
}

export function requireScope(scope: string) {
  return (req: GatewayRequest, res: Response, next: NextFunction): void => {
    if (!req.partner?.scopes.includes(scope)) {
      res.status(403).json({ error: 'insufficient_scope', required: scope });
      return;
    }
    next();
  };
}
```

### 2. Gateway routes

Create `src/api/gateway-routes.ts`. Register these routes:

```
GET  /api/v1/platform/health
GET  /api/v1/platform/info
POST /api/v1/platform/session
POST /api/v1/platform/message
POST /api/v1/platform/memory
GET  /api/v1/platform/memory
GET  /api/v1/platform/skills
POST /api/v1/platform/skills/:skillId/invoke
GET  /api/v1/platform/usage
```

Every route except `/health` and `/info` uses `partnerGatewayAuth` middleware.

**GET /api/v1/platform/health**
No auth. Returns `{ status: 'ok', version: process.env.npm_package_version }`.
Used by `status.carinaai.uk` (TB-007) and partner uptime monitoring.

**GET /api/v1/platform/info**
No auth. Returns publicly documented API capabilities:
```json
{
  "api": "Carina Platform API",
  "version": "1",
  "docs": "https://docs.carinaai.uk/api",
  "scopes": ["session", "memory", "skills", "analytics"],
  "rateLimiting": "per key, see docs"
}
```

**POST /api/v1/platform/session** (scope: `session`)
Creates or resolves an AI session for a partner workspace.
Body: `{ workspaceId: string, userId?: string, context?: object }`
Response: `{ sessionId: string, expiresAt: string }`
Emits `platform_event` with `event_type: 'channel_connect'`.

**POST /api/v1/platform/message** (scope: `session`)
Routes a message through the Carina brain for the partner's workspace.
Body: `{ sessionId: string, message: string, model?: string }`
Response: `{ reply: string, tokensIn: number, tokensOut: number, model: string }`
Emits `platform_event` with `event_type: 'message'`, full token counts, latency.
This is the primary tollable event.

**POST /api/v1/platform/memory** (scope: `memory`)
Writes a memory entry for a partner workspace.
Body: `{ workspaceId: string, key: string, value: string, ttlSeconds?: number }`
Response: `{ id: string, stored: true }`
Emits `platform_event` with `event_type: 'memory_write'`.

**GET /api/v1/platform/memory** (scope: `memory`)
Retrieves memory entries. Query params: `workspaceId`, `key?`.
Emits `platform_event` with `event_type: 'memory_read'`.

**GET /api/v1/platform/skills** (scope: `skills`)
Lists skills available to the partner's workspace.
Returns the same response shape as the skills hub but filtered to
`pricing_tier: 'free'` plus any packs the partner has activated.

**POST /api/v1/platform/skills/:skillId/invoke** (scope: `skills`)
Invokes a named skill. Body: `{ input: object }`
Response: `{ output: object, latencyMs: number }`
Emits `platform_event` with `event_type: 'skill_invocation'`.

**GET /api/v1/platform/usage** (scope: `analytics`)
Returns event aggregates for the authenticated partner.
Query params: `from` (ISO date), `to` (ISO date)
Calls `getPlatformEventSummary({ partnerId: req.partner.partnerId, fromDate, toDate })`.

### 3. Register the router

In the main Express app (wherever other routers are registered), import and mount:

```typescript
import { gatewayRouter } from './api/gateway-routes.js';
app.use(gatewayRouter);
```

### 4. nginx configuration

In `docker/nginx/carina-prod.conf`, add a new `server` block for `api.carinaai.uk`
that proxies to the same upstream as `core.carinaai.uk`. The routes are served by the
same process; nginx just provides the separate subdomain TLS termination.

```nginx
server {
  listen 443 ssl;
  http2 on;
  server_name api.carinaai.uk;
  ssl_certificate     /etc/nginx/ssl/live/carinaai.uk/fullchain.pem;
  ssl_certificate_key /etc/nginx/ssl/live/carinaai.uk/privkey.pem;
  include /etc/nginx/conf.d/ssl-params.conf;
  ssl_dhparam         /etc/nginx/ssl/ssl-dhparams.pem;

  location / {
    proxy_pass http://carina-core:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 120s;
  }
}
```

---

## Error response format

All gateway errors must follow this shape so partners can parse them consistently:

```json
{
  "error": "snake_case_code",
  "message": "Human readable explanation.",
  "requestId": "uuid"
}
```

Add a `X-Request-Id` response header on every request (use `crypto.randomUUID()`).

---

## What NOT to do

- Do not implement OAuth token exchange or refresh tokens in this sprint. Bearer key is
  sufficient for certified partners and is the fastest path to a working gateway.
- Do not add versioning middleware or route negotiation. The `/api/v1/` prefix is
  sufficient. Version bumps will be additive routes, not middleware complexity.
- Do not proxy to `app.carinaai.uk` (the Next.js frontend). The gateway is a backend-only
  API. All routes live in `core.carinaai.uk`.

---

## Done when

- [ ] `GET /api/v1/platform/health` returns 200 with `{ status: 'ok' }` unauthenticated
- [ ] `POST /api/v1/platform/message` returns 401 without a valid key
- [ ] `POST /api/v1/platform/message` returns a response and emits a `platform_event`
- [ ] `requireScope('memory')` returns 403 if the key does not have that scope
- [ ] `GET /api/v1/platform/usage` returns correct aggregates for test events
- [ ] nginx block for `api.carinaai.uk` added to `carina-prod.conf`
- [ ] `pnpm build` compiles without TypeScript errors
- [ ] Manual curl test against local dev server passes for each route
