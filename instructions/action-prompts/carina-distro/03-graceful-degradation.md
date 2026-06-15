# Carina Distro Prompt 03: Graceful degradation when Carina is unavailable

## Goal

Make the ABBIS API aware of Carina's health at all times. When Carina is down or
restarting, AI-powered endpoints return a clear, non-breaking degraded response instead of
a 500 error. All non-AI endpoints (CRM, boreholes, invoices, association) continue working
without any change in behavior.

## Context

Carina is an AI service, not the application backbone. The ABBIS platform must remain
fully functional if Carina crashes. The design rule:

- A user logging a borehole record should never see an error because Carina is down
- A user using the AI chat or requesting an AI drilling cost estimate should see a clear
  "AI temporarily unavailable" message, not a 500 or an empty screen
- The ABBIS API should never throw an unhandled exception because the HTTP call to Carina
  timed out

Implementation uses three pieces:
1. A `CarinaClient` service class that wraps all HTTP calls to Carina and handles errors
2. A `carinaHealthMiddleware` that checks Carina status on every request and attaches
   `req.carinaAvailable: boolean` to the request object
3. A `requireCarina` guard middleware that returns a 503 with a user-facing message on
   AI-only endpoints

## Dependencies

`01-pin-carina-dependency.md`, `02-docker-sidecar.md`

## Files to create

```
abbis/apps/api/src/services/carina-client.ts
abbis/apps/api/src/middleware/carina-health.ts
abbis/apps/api/src/middleware/require-carina.ts
abbis/apps/api/src/routes/health.ts
```

## Step-by-step

### 1. CarinaClient service

`abbis/apps/api/src/services/carina-client.ts`:
```typescript
const CARINA_URL = process.env.CARINA_INTERNAL_URL ?? 'http://carina:4500';
const CARINA_API_KEY = process.env.CARINA_API_KEY ?? '';
const HEALTH_TIMEOUT_MS = 3000;
const REQUEST_TIMEOUT_MS = 30000;

export type CarinaStatus = 'healthy' | 'degraded' | 'unreachable';

let cachedStatus: CarinaStatus = 'unreachable';
let lastChecked = 0;
const CACHE_TTL_MS = 10_000;

export async function checkCarinaHealth(): Promise<CarinaStatus> {
  const now = Date.now();
  if (now - lastChecked < CACHE_TTL_MS) return cachedStatus;

  try {
    const res = await fetch(`${CARINA_URL}/health`, {
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
      headers: { Authorization: `Bearer ${CARINA_API_KEY}` },
    });
    cachedStatus = res.ok ? 'healthy' : 'degraded';
  } catch {
    cachedStatus = 'unreachable';
  }

  lastChecked = now;
  return cachedStatus;
}

export async function carinaChat(payload: {
  message: string;
  sessionId: string;
  userId: string;
}): Promise<{ reply: string }> {
  const res = await fetch(`${CARINA_URL}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${CARINA_API_KEY}`,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!res.ok) {
    throw new Error(`Carina chat failed: ${res.status}`);
  }

  return res.json() as Promise<{ reply: string }>;
}

export async function carinaToolCall(payload: {
  tool: string;
  args: Record<string, unknown>;
  sessionId: string;
}): Promise<unknown> {
  const res = await fetch(`${CARINA_URL}/api/tool`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${CARINA_API_KEY}`,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!res.ok) {
    throw new Error(`Carina tool call failed: ${res.status} ${payload.tool}`);
  }

  return res.json();
}
```

Key design decisions:
- Health check result is cached for 10 seconds to avoid a network call on every request
- `AbortSignal.timeout()` is used instead of a manual timeout wrapper
- Errors from Carina propagate as typed exceptions; callers decide whether to degrade or throw
- Endpoint paths (`/health`, `/api/chat`, `/api/tool`) must match the actual Carina API;
  read `core.carinaai.uk/src/gateway/` to confirm paths before finalizing

### 2. Health middleware

`abbis/apps/api/src/middleware/carina-health.ts`:
```typescript
import type { Request, Response, NextFunction } from 'express';
import { checkCarinaHealth } from '../services/carina-client.js';

declare global {
  namespace Express {
    interface Request {
      carinaAvailable: boolean;
    }
  }
}

export async function carinaHealthMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const status = await checkCarinaHealth();
  req.carinaAvailable = status === 'healthy';
  next();
}
```

Register this middleware in the root Express app. It runs on every request and attaches
the availability flag. Route handlers that use AI features read `req.carinaAvailable`
to decide whether to call Carina or return a degraded response.

### 3. Guard middleware for AI-only endpoints

`abbis/apps/api/src/middleware/require-carina.ts`:
```typescript
import type { Request, Response, NextFunction } from 'express';

export function requireCarina(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!req.carinaAvailable) {
    res.status(503).json({
      error: 'ai_unavailable',
      message: 'AI features are temporarily unavailable. Your data is safe. Please try again in a moment.',
      retryAfterSeconds: 30,
    });
    return;
  }
  next();
}
```

Apply this middleware only to routes that genuinely require Carina. Do NOT apply it to:
- `/api/boreholes` - manual logging works without AI
- `/api/crm` - contact management works without AI
- `/api/jobs` - job tracking works without AI
- `/api/invoices` - billing works without AI
- `/api/auth` - authentication works without AI

Apply it to:
- `/api/chat` - Carina conversational interface
- `/api/ai/drilling-cost` - AI-powered cost estimation
- `/api/ai/market-intelligence` - AI market data queries
- `/api/whatsapp/voice` - WhatsApp voice note processing

### 4. Health routes

`abbis/apps/api/src/routes/health.ts`:
```typescript
import { Router } from 'express';
import { checkCarinaHealth } from '../services/carina-client.js';

const router = Router();

router.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'abbis-api',
    timestamp: new Date().toISOString(),
  });
});

router.get('/carina', async (_req, res) => {
  const status = await checkCarinaHealth();
  const httpStatus = status === 'healthy' ? 200 : 503;
  res.status(httpStatus).json({
    carina: status,
    timestamp: new Date().toISOString(),
  });
});

export default router;
```

Register in root Express app:
```typescript
import healthRouter from './routes/health.js';
app.use('/api/health', healthRouter);
```

### 5. Example AI route using the guards

```typescript
import { Router } from 'express';
import { requireCarina } from '../middleware/require-carina.js';
import { carinaChat } from '../services/carina-client.js';

const router = Router();

router.post('/chat', requireCarina, async (req, res) => {
  const { message, sessionId } = req.body as { message: string; sessionId: string };

  try {
    const result = await carinaChat({
      message,
      sessionId,
      userId: req.user.id,
    });
    res.json(result);
  } catch (err) {
    console.error('Carina chat error:', err);
    res.status(503).json({
      error: 'ai_unavailable',
      message: 'AI is temporarily unavailable. Please try again.',
      retryAfterSeconds: 15,
    });
  }
});

export default router;
```

## Expected behavior

| Scenario | Non-AI endpoint | AI endpoint |
|----------|-----------------|-------------|
| Carina healthy | 200 OK | 200 OK with AI response |
| Carina restarting (30-60s window) | 200 OK | 503 with `ai_unavailable` message |
| Carina crash loop | 200 OK | 503 with `ai_unavailable` message |
| Carina removed entirely | 200 OK | 503 with `ai_unavailable` message |

The web dashboard should handle `503 ai_unavailable` gracefully by showing an inline
banner ("AI features are temporarily unavailable") rather than a broken screen.

## Test

```bash
# With Carina running:
curl -s http://localhost:3000/api/health/carina
# {"carina":"healthy","timestamp":"..."}

# Kill Carina:
docker compose stop carina

# Non-AI endpoint still works:
curl -s http://localhost:3000/api/health
# {"status":"ok","service":"abbis-api",...}

# AI endpoint returns 503:
curl -s -w "\n%{http_code}" http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"hello","sessionId":"test"}'
# {"error":"ai_unavailable","message":"..."} \n 503

# Restart Carina:
docker compose start carina

# Wait ~30s for health check cache to expire, then AI returns:
curl -s http://localhost:3000/api/health/carina
# {"carina":"healthy",...}
```

## Pitfalls

- The 10-second health cache means there is up to a 10-second window where a restarted
  Carina appears unavailable to the API; this is acceptable for an AI feature
- Do not use the cached status for non-AI features; non-AI routes must never check Carina
- The `AbortSignal.timeout()` built-in requires Node.js 18+; confirmed fine for Node.js 22
- If Carina's actual health endpoint path differs from `/health`, read
  `core.carinaai.uk/src/gateway/` and update `CarinaClient` accordingly
