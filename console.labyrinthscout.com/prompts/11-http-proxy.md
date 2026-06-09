# Prompt 11 - HTTP Proxy Mode

Build the transparent HTTP proxy mode for Labyrinth Scout. This allows third-party agents
(OpenClaw, Hermes, AutoGPT, or any OpenAI-compatible client) to be secured by Scout without
any code changes to the agent itself. The agent points its `OPENAI_BASE_URL` at Scout; Scout
intercepts, scans, and forwards.

**Stack:** Node.js 22, TypeScript 5, Express 5, PostgreSQL 16, Redis 7. No PHP.

**Repo root:** `/opt/lampp/htdocs/VERLOX/Carina-ai/`

**Scout source:** `labyrinthscout/src/`

**Carina source:** `src/`

---

## Architecture overview

```
Third-party agent
    |
    | POST http://labyrinth-scout:8080/v1/chat/completions
    v
Scout OpenAI-compatible proxy (port 8080)
    | 1. Authenticate proxy request (X-Scout-Proxy-Key)
    | 2. Run PromptGuard on last user message
    | 3. Check Authorization Bearer key against honeypots
    | 4. Validate upstream target against egress allowlist
    | 5. Forward to real upstream (api.openai.com or X-Scout-Target)
    | 6. Stream or buffer response back to agent
    | 7. Scan response body (log only, no blocking)
    | 8. Log interaction as security_event
    v
Real LLM upstream (api.openai.com, api.anthropic.com, etc.)
```

The proxy is disabled by default. Set `SCOUT_PROXY_ENABLED=true` to activate it.

---

## Files to create or modify

### 1. `labyrinthscout/src/proxy/openai-proxy.ts` (new file)

Export an Express `Router` and a `startProxyServer` function.

```typescript
import express, { Router, Request, Response } from 'express';
import { promptGuard } from '../security/prompt-guard.js';
import { egressFilter } from '../security/egress-filter.js';
import { honeypotManager } from '../security/honeypot-manager.js';
import { pool } from '../db/pool.js';

const PROXY_KEY = process.env.SCOUT_PROXY_KEY ?? '';

export const openAiProxyRouter = Router();
```

#### Authentication middleware (apply to all proxy routes)

```typescript
function requireProxyKey(req: Request, res: Response, next: Function): void {
  const provided = req.headers['x-scout-proxy-key'];
  if (!PROXY_KEY || provided !== PROXY_KEY) {
    res.status(401).json({ error: { message: 'Unauthorized', type: 'authentication_error' } });
    return;
  }
  next();
}

openAiProxyRouter.use(requireProxyKey);
```

Return OpenAI-format errors throughout (object with `error.message` and `error.type`) so agents
that parse OpenAI responses do not break.

#### Agent detection helper

```typescript
function detectAgent(userAgent: string | undefined): string {
  if (!userAgent) return 'unknown';
  if (userAgent.startsWith('OpenClaw/')) return 'openclaw';
  if (userAgent.startsWith('Hermes-Agent/')) return 'hermes';
  if (userAgent.startsWith('AutoGPT/')) return 'autogpt';
  return 'unknown';
}
```

#### `POST /v1/chat/completions`

This is the main interception point. Implement fully as described below.

**Step 1 - Parse body.**
Express body parser (JSON) has already parsed `req.body`. Extract:
- `messages: Array<{ role: string; content: string }>` - required
- `stream: boolean` - optional, default false
- All other fields pass through to upstream unchanged.

Validate `messages` is a non-empty array. Return 400 on invalid:
```json
{ "error": { "message": "messages must be a non-empty array", "type": "invalid_request_error" } }
```

**Step 2 - PromptGuard scan.**
Find the last message where `role === 'user'`. If none, skip guard. Otherwise:

```typescript
const lastUser = [...messages].reverse().find(m => m.role === 'user');
if (lastUser) {
  const guardResult = await promptGuard.scan(lastUser.content);
  if (guardResult.blocked) {
    await logProxyEvent(req, 'injection_blocked', 'critical', {
      agentType, reason: guardResult.reason
    });
    res.status(400).json({
      error: {
        message: `Request blocked by Labyrinth Scout: ${guardResult.reason}`,
        type: 'invalid_request_error',
        code: 'prompt_injection_detected',
      }
    });
    return;
  }
}
```

**Step 3 - Honeypot key check.**
Extract the Bearer token from `Authorization` header:

```typescript
const authHeader = req.headers.authorization ?? '';
const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
const apiKey = bearerMatch?.[1] ?? '';

if (apiKey) {
  // Do NOT block if it is a honeypot - that would tip off the attacker.
  // Fire-and-forget: log the hit and continue forwarding.
  void honeypotManager.checkApiKey(apiKey, {
    agentType, ip: req.ip, tool: 'proxy'
  });
}
```

**Step 4 - Upstream target validation.**
Read the `X-Scout-Target` header. Default to `https://api.openai.com`. Build the upstream URL:

```typescript
const targetHost = req.headers['x-scout-target'] as string | undefined;
const upstreamBase = targetHost
  ? (targetHost.startsWith('http') ? targetHost : `https://${targetHost}`)
  : 'https://api.openai.com';

const upstreamUrl = `${upstreamBase}/v1/chat/completions`;

if (!egressFilter.isAllowed(upstreamUrl)) {
  await logProxyEvent(req, 'proxy_egress_blocked', 'critical', { upstreamUrl, agentType });
  res.status(400).json({
    error: {
      message: `Upstream host not in Labyrinth allowlist: ${upstreamBase}`,
      type: 'invalid_request_error',
    }
  });
  return;
}
```

**Step 5 - Forward the request.**
Forward with the original body (minus any Scout-specific headers). Pass through all original
headers except `host` and `x-scout-proxy-key` and `x-scout-target`.

```typescript
const upstreamRes = await fetch(upstreamUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': authHeader,
    'User-Agent': 'Labyrinth-Scout-Proxy/1.0',
  },
  body: JSON.stringify(req.body),
  signal: AbortSignal.timeout(120_000),
});
```

**Step 6 - Stream or buffer the response.**

If `stream === true` OR `upstreamRes.headers.get('content-type')?.includes('text/event-stream')`:

```typescript
res.setHeader('Content-Type', 'text/event-stream');
res.setHeader('Cache-Control', 'no-cache');
res.setHeader('Connection', 'keep-alive');

const reader = upstreamRes.body!.getReader();
const decoder = new TextDecoder();
let accumulated = '';

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  const chunk = decoder.decode(value, { stream: true });
  accumulated += chunk;
  res.write(chunk); // stream chunk to client immediately
}
res.end();

// Scan accumulated content AFTER streaming - cannot un-send, just log.
void egressFilter.checkResponse(upstreamUrl, accumulated).catch(() => {});
void logProxyEvent(req, 'proxy_request', 'info', {
  agentType, upstreamUrl, streaming: true,
  responseLength: accumulated.length,
});
```

If non-streaming:

```typescript
const responseText = await upstreamRes.text();
void egressFilter.checkResponse(upstreamUrl, responseText).catch(() => {});

res.status(upstreamRes.status)
   .set('Content-Type', upstreamRes.headers.get('content-type') ?? 'application/json')
   .send(responseText);

void logProxyEvent(req, 'proxy_request', 'info', {
  agentType, upstreamUrl, streaming: false,
  responseLength: responseText.length,
  statusCode: upstreamRes.status,
});
```

**Error handling for upstream failures:**
Wrap the entire forward block in try/catch. On error:

```typescript
console.error('[Proxy] Upstream error:', err);
res.status(502).json({
  error: { message: 'Upstream request failed', type: 'api_error' }
});
```

#### `POST /v1/embeddings`

Pass through to upstream with logging only. No injection scan. No blocking.
Log as `event_type: 'proxy_embeddings'`, `severity: 'info'`.

```typescript
openAiProxyRouter.post('/v1/embeddings', requireProxyKey, async (req, res) => {
  const upstreamBase = (req.headers['x-scout-target'] as string | undefined) ?? 'https://api.openai.com';
  const upstreamUrl = `${upstreamBase}/v1/embeddings`;

  if (!egressFilter.isAllowed(upstreamUrl)) {
    res.status(400).json({ error: { message: 'Upstream not allowed', type: 'invalid_request_error' } });
    return;
  }

  const upstreamRes = await fetch(upstreamUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': req.headers.authorization ?? '' },
    body: JSON.stringify(req.body),
    signal: AbortSignal.timeout(30_000),
  });
  const body = await upstreamRes.text();
  void logProxyEvent(req, 'proxy_embeddings', 'info', { agentType: detectAgent(req.headers['user-agent']) });
  res.status(upstreamRes.status).send(body);
});
```

#### `GET /v1/models`

Pass through to upstream without scanning:

```typescript
openAiProxyRouter.get('/v1/models', requireProxyKey, async (req, res) => {
  const upstreamRes = await fetch('https://api.openai.com/v1/models', {
    headers: { 'Authorization': req.headers.authorization ?? '' },
    signal: AbortSignal.timeout(10_000),
  });
  const body = await upstreamRes.text();
  res.status(upstreamRes.status)
     .set('Content-Type', 'application/json')
     .send(body);
});
```

#### `logProxyEvent` helper (private)

```typescript
async function logProxyEvent(
  req: Request,
  eventType: string,
  severity: string,
  meta: Record<string, unknown>
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO security_events (instance_id, event_type, severity, metadata, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [
        req.headers['x-scout-instance-id'] ?? 'proxy-unknown',
        eventType,
        severity,
        JSON.stringify({ ip: req.ip, userAgent: req.headers['user-agent'], ...meta }),
      ]
    );
  } catch (err) {
    console.error('[Proxy] Failed to log event:', err);
  }
}
```

---

### 2. `labyrinthscout/src/index.ts` (modify existing)

Conditionally mount and start the proxy. Add after the main Scout Express app setup:

```typescript
import { openAiProxyRouter } from './proxy/openai-proxy.js';

const PROXY_ENABLED = process.env.SCOUT_PROXY_ENABLED === 'true';
const PROXY_PORT = parseInt(process.env.SCOUT_PROXY_PORT ?? '8080', 10);

if (PROXY_ENABLED) {
  const proxyApp = express();
  proxyApp.use(express.json({ limit: '10mb' }));
  proxyApp.use('/', openAiProxyRouter);

  proxyApp.listen(PROXY_PORT, () => {
    console.log(`[Scout] OpenAI-compatible proxy listening on port ${PROXY_PORT}`);
  });
} else {
  console.log('[Scout] Proxy mode disabled (SCOUT_PROXY_ENABLED != true)');
}
```

Use a separate Express application instance for the proxy on a separate port. Do not mount the
proxy router on the same app as the Scout control API (port 4444). This keeps the security
control plane separate from the interception layer.

---

### 3. `labyrinthscout/.env.example` (modify existing)

```
# Proxy mode (disabled by default)
SCOUT_PROXY_ENABLED=false
SCOUT_PROXY_PORT=8080
SCOUT_PROXY_KEY=change-me-in-production
```

---

### 4. Docker Compose example for OpenClaw (add as comment block in `docker-compose.yml`)

Add a comment block at the top of the root `docker-compose.yml` (or `labyrinthscout/docker-compose.yml`)
showing the integration pattern. This is documentation, not active config:

```yaml
# To use Labyrinth Scout proxy with OpenClaw or any OpenAI-compatible agent:
#
# services:
#   openclaw:
#     image: your-agent-image
#     environment:
#       - OPENAI_BASE_URL=http://labyrinth-scout:8080/v1
#       - OPENAI_API_KEY=your_real_openai_key
#       - X_SCOUT_PROXY_KEY=your_proxy_auth_key
#     depends_on:
#       - labyrinth-scout
#
#   hermes:
#     image: hermes-agent-image
#     environment:
#       - OPENAI_BASE_URL=http://labyrinth-scout:8080/v1
#       - OPENAI_API_KEY=your_real_openai_key
#
# The proxy transparently intercepts all LLM calls, applies PromptGuard,
# logs interactions, and forwards to the real provider.
# Agent detection uses the User-Agent header:
#   OpenClaw/x.x  -> agentType: openclaw
#   Hermes-Agent/x.x -> agentType: hermes
#   Anything else -> agentType: unknown
```

---

## Test cases

Write in `labyrinthscout/src/proxy/__tests__/openai-proxy.test.ts` using Vitest. Use
`supertest` for HTTP assertions. Mock `fetch` with `vi.stubGlobal`.

**Test 1 - Normal chat request forwarded and logged:**
Stub `fetch` to return `{ status: 200, body: JSON with choices }`. POST
`/v1/chat/completions` with valid `X-Scout-Proxy-Key` and a clean messages array. Assert
response status 200. Assert `fetch` called once with `https://api.openai.com/v1/chat/completions`.
Assert `security_events` INSERT called with `event_type: 'proxy_request'`.

**Test 2 - Injection in user message returns 400:**
Stub `promptGuard.scan` to return `{ blocked: true, reason: 'jailbreak detected' }`. POST
with a messages array containing a jailbreak attempt. Assert 400. Assert response body
`error.code === 'prompt_injection_detected'`. Assert `fetch` not called.

**Test 3 - Honeypot API key does not block request:**
Stub `honeypotManager.checkApiKey` to resolve (trigger fires silently). POST with a honeypot
key in Authorization header. Assert `fetch` IS called (request not blocked). Assert
`honeypotManager.checkApiKey` called with the key value.

**Test 4 - Disallowed upstream via X-Scout-Target blocked:**
Set `X-Scout-Target: http://evil.com`. Stub `egressFilter.isAllowed` to return `false` for
that host. Assert 400 with message containing `not in Labyrinth allowlist`.

**Test 5 - Missing or wrong proxy key returns 401:**
POST without `X-Scout-Proxy-Key`. Assert 401 with `error.type: 'authentication_error'`.

**Test 6 - SCOUT_PROXY_ENABLED=false means proxy port not opened:**
Set `process.env.SCOUT_PROXY_ENABLED = 'false'`. Assert the proxy `listen` call is not made
(spy on `express().listen`).

**Test 7 - Streaming response piped through correctly:**
Stub `fetch` to return a `ReadableStream` of SSE chunks. POST with `stream: true`. Assert
response has `Content-Type: text/event-stream`. Assert all chunks received by client.
Assert `logProxyEvent` called with `streaming: true` after stream ends.

**Test 8 - Upstream fetch timeout returns 502:**
Stub `fetch` to reject with a `TimeoutError`. Assert 502 with
`error.message: 'Upstream request failed'`. Assert no unhandled rejection.

---

## Acceptance criteria

- `SCOUT_PROXY_ENABLED=false`: proxy port not opened, no router mounted.
- `SCOUT_PROXY_ENABLED=true`: proxy listens on `SCOUT_PROXY_PORT` (default 8080).
- Requests without valid `X-Scout-Proxy-Key` get 401 in OpenAI error format.
- User messages with injection triggers get 400 with `code: 'prompt_injection_detected'`.
- Honeypot API key triggers the honeypot silently; request still forwarded.
- Requests to disallowed upstreams get 400 before any network call is made.
- Streaming responses reach the client chunk-by-chunk; accumulated text logged after.
- All intercepted requests produce a `security_events` row with correct agent_type.
- TypeScript strict mode: zero `any` types.
