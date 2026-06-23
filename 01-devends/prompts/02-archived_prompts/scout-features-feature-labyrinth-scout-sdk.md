# Labyrinth Scout SDK

Build a standalone npm package (`labyrinth-scout-sdk`) that lets any external AI agent
(LangChain, OpenAI Assistants, Hermes, custom agents) connect to a remote Scout instance
for governance, policy enforcement, kill switch reception, and audit logging.

## Problem statement

The existing Scout integration code in `console.labyrinthscout.com/src/integration/` calls
`inspectRequest()` from `security-pipeline.ts`, which directly queries Scout's Postgres
database. External agents can't run this code. They need an HTTP client that talks to
Scout's existing REST API over the network.

The server-side APIs already exist:
- `POST /api/events` - emit audit events
- `POST /api/heartbeat` - register and keep-alive
- `GET /api/instances/:id/status` - poll suspension state
- `POST /api/policy/evaluate` - pre-action policy check
- `POST /api/policy/context` - input/content screening
- `POST /api/policy/output` - output protection check
- `GET /api/stream` - SSE stream (broadcasts `kill_switch_status` events)
- `X-Scout-Key` header for auth on all routes

The SDK wraps these endpoints into a typed, ergonomic client. Nothing new needed on the
Scout server except one endpoint (see Piece 4 below).

## Where to build

New directory at the repo root (sibling of `console.labyrinthscout.com/`):

```
labyrinth-scout-sdk/
  src/
    client.ts
    kill-switch.ts
    wrap.ts
    middleware.ts
    adapters/         (copied from console.labyrinthscout.com/src/integration/adapters/)
    agent-adapter.interface.ts  (copied from integration/)
    types.ts
    index.ts
  src/__tests__/
    client.test.ts
    kill-switch.test.ts
    wrap.test.ts
    middleware.test.ts
  package.json
  tsconfig.json
  vitest.config.ts
  README.md
```

## Piece 1: `src/types.ts`

Shared types extracted from Scout's existing `types.ts` and `security/policy-decisions.ts`.
No logic, pure types.

```typescript
export type Severity = 'info' | 'warning' | 'critical' | 'breach';
export type InstanceStatus = 'active' | 'suspended' | 'offline';

export type PolicyActionType =
  | 'shell' | 'http' | 'file_write' | 'email' | 'messaging' | 'tool_chain' | 'credential';

export type PolicyDecisionKind =
  | 'allow' | 'block' | 'require_approval' | 'dry_run' | 'quarantine_session';

export type ContextSourceType =
  | 'user_prompt' | 'tool_output' | 'web_fetch' | 'email_body'
  | 'attachment_text' | 'rag_chunk' | 'imported_doc';

export type ShieldMode = 'observe' | 'guard' | 'restrict' | 'quarantine';

export interface ScoutEvent {
  severity: Severity;
  source: string;
  event_type: string;
  description: string;
  metadata?: Record<string, unknown>;
  session_id?: string;
  instance_id?: string;
}

export interface PolicyEvaluateRequest {
  session_id: string;
  instance_id?: string;
  tool_name?: string;
  action_type?: PolicyActionType;
  params?: Record<string, unknown>;
  content?: string;
  context_type?: ContextSourceType;
  confirmed?: boolean;
}

export interface PolicyDecision {
  decision: PolicyDecisionKind;
  actionType: PolicyActionType;
  reason: string;
  riskScore: number;
  shieldMode: ShieldMode;
  metadata?: Record<string, unknown>;
  filteredContent?: string;
}

export interface ContextFirewallResult {
  action: 'pass' | 'redact' | 'annotate' | 'downgrade_trust' | 'block' | 'isolate';
  content: string;
  reason: string;
}

export interface InstanceStatusResponse {
  suspended: boolean;
  reason?: string;
}

export interface KillSwitchStatus {
  armed: boolean;
  triggered: boolean;
  triggered_by: string | null;
  reason: string | null;
  agents_active: number;
}

export interface RegisterResponse {
  instance_id: string;
}
```

## Piece 2: `src/client.ts` - typed HTTP client

```typescript
import type {
  ScoutEvent, PolicyEvaluateRequest, PolicyDecision,
  ContextFirewallResult, InstanceStatusResponse, KillSwitchStatus,
  RegisterResponse,
} from './types.js';

export interface ScoutClientOptions {
  url: string;
  apiKey: string;
  timeoutMs?: number;
}

export class ScoutClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;

  constructor(options: ScoutClientOptions) {
    this.baseUrl = options.url.replace(/\/+$/, '');
    this.apiKey = options.apiKey;
    this.timeoutMs = options.timeoutMs ?? 5000;
  }

  private headers(): Record<string, string> {
    return { 'Content-Type': 'application/json', 'X-Scout-Key': this.apiKey };
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Scout ${path} ${res.status}: ${text}`);
      }
      return res.json() as Promise<T>;
    } finally {
      clearTimeout(timer);
    }
  }

  private async get<T>(path: string): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        headers: this.headers(),
        signal: controller.signal,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Scout ${path} ${res.status}: ${text}`);
      }
      return res.json() as Promise<T>;
    } finally {
      clearTimeout(timer);
    }
  }

  async emit(event: ScoutEvent): Promise<void> {
    await this.post('/api/events', event);
  }

  async heartbeat(instanceId: string, name: string): Promise<void> {
    await this.post('/api/heartbeat', { instance_id: instanceId, name });
  }

  async register(name: string, agentType?: string): Promise<RegisterResponse> {
    return this.post<RegisterResponse>('/api/instances/register', { name, agent_type: agentType });
  }

  async instanceStatus(instanceId: string): Promise<InstanceStatusResponse> {
    return this.get<InstanceStatusResponse>(`/api/instances/${instanceId}/status`);
  }

  async policyEvaluate(request: PolicyEvaluateRequest): Promise<PolicyDecision> {
    return this.post<PolicyDecision>('/api/policy/evaluate', request);
  }

  async policyContext(
    content: string,
    sessionId: string,
    options?: { contextType?: string; toolName?: string },
  ): Promise<ContextFirewallResult> {
    return this.post<ContextFirewallResult>('/api/policy/context', {
      content,
      session_id: sessionId,
      context_type: options?.contextType,
      tool_name: options?.toolName,
    });
  }

  async killSwitchStatus(): Promise<KillSwitchStatus> {
    return this.get<KillSwitchStatus>('/api/killswitch/status');
  }

  streamUrl(): string {
    return `${this.baseUrl}/api/stream`;
  }

  streamHeaders(): Record<string, string> {
    return { 'X-Scout-Key': this.apiKey };
  }
}
```

## Piece 3: `src/kill-switch.ts`

Two modes: polling (always works) and SSE (real-time, optional). SSE is preferred when
the runtime supports it. Polling is the fallback.

```typescript
import type { ScoutClient } from './client.js';

export interface KillSwitchWatcherOptions {
  instanceId: string;
  pollIntervalMs?: number;
  onKill: (reason: string | null) => void | Promise<void>;
  onResume?: () => void | Promise<void>;
}

export class KillSwitchWatcher {
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private wasTriggered = false;
  private stopped = false;

  constructor(
    private readonly scout: ScoutClient,
    private readonly options: KillSwitchWatcherOptions,
  ) {}

  start(): void {
    if (this.stopped) return;
    const interval = this.options.pollIntervalMs ?? 5000;

    this.pollTimer = setInterval(async () => {
      if (this.stopped) return;
      try {
        const status = await this.scout.killSwitchStatus();
        if (status.triggered && !this.wasTriggered) {
          this.wasTriggered = true;
          await this.options.onKill(status.reason);
        } else if (!status.triggered && this.wasTriggered) {
          this.wasTriggered = false;
          if (this.options.onResume) await this.options.onResume();
        }
      } catch {
        // Scout temporarily unreachable - do not kill
      }
    }, interval);
  }

  stop(): void {
    this.stopped = true;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }
}
```

SSE-based watcher as a separate export. Use only when `EventSource` or `eventsource` is
available (Node 22+ has native `EventSource`; add `eventsource` as an optional peerDep for older runtimes):

```typescript
export class KillSwitchSseWatcher {
  private es: EventSource | null = null;
  private stopped = false;

  constructor(
    private readonly scout: ScoutClient,
    private readonly options: Omit<KillSwitchWatcherOptions, 'pollIntervalMs'>,
  ) {}

  start(): void {
    if (this.stopped) return;
    const url = `${this.scout.streamUrl()}?key=${encodeURIComponent((this.scout as any).apiKey)}`;
    this.es = new EventSource(url);

    this.es.addEventListener('kill_switch_status', async (e: MessageEvent) => {
      if (this.stopped) return;
      try {
        const data = JSON.parse(e.data as string) as { data?: { event_type?: string } };
        const eventType = data?.data?.event_type;
        if (eventType === 'kill_switch_activated') {
          await this.options.onKill(null);
        } else if (eventType === 'kill_switch_resumed' && this.options.onResume) {
          await this.options.onResume();
        }
      } catch { /* malformed event - ignore */ }
    });

    this.es.onerror = () => {
      if (this.stopped) return;
      this.es?.close();
      setTimeout(() => { if (!this.stopped) this.start(); }, 10_000);
    };
  }

  stop(): void {
    this.stopped = true;
    this.es?.close();
    this.es = null;
  }
}
```

Note on SSE auth: `GET /api/stream` currently does NOT use `requireApiKey` in server.ts
(check the mount list - it's not present). If it does require auth, add a query-string
token approach or a one-time token endpoint. For now, pass the key as `?key=` param and
handle it in the SSE route. If the route is open, no change needed.

## Piece 4: New Scout server endpoint `POST /api/instances/register`

Add to `console.labyrinthscout.com/src/api/instances.ts`:

```typescript
instancesRouter.post('/register', async (req: Request, res: Response): Promise<void> => {
  const body = req.body as Record<string, unknown>;
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const agentType = typeof body.agent_type === 'string' ? body.agent_type.trim() : 'generic';

  if (!name || name.length > 80) {
    res.status(400).json({ error: 'name is required and must be under 80 characters' });
    return;
  }

  const { randomUUID } = await import('crypto');
  const instanceId = agentType.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + randomUUID().slice(0, 8);

  try {
    const accountId = req.scoutAuth?.kind === 'account' ? req.scoutAuth.accountId : null;
    await pool.query(
      `INSERT INTO carina_instances (id, name, api_key, status, account_id, last_heartbeat)
       VALUES ($1, $2, $3, 'active', $4, NOW())
       ON CONFLICT (id) DO UPDATE SET last_heartbeat = NOW(), name = EXCLUDED.name`,
      [instanceId, name, '', accountId],
    );
    res.status(201).json({ instance_id: instanceId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[scout:instances] register failed:', msg);
    res.status(500).json({ error: 'Database error' });
  }
});
```

Mount: `instancesRouter` is already at `app.use('/api/instances', requireApiKey, instancesRouter)`.
No additional server.ts change needed.

## Piece 5: `src/wrap.ts` - HTTP-based `scoutWrap`

This replaces the internal `inspectRequest()` call with an HTTP call to `POST /api/policy/evaluate`.
The adapters (in `src/adapters/`) handle parsing raw LLM client arguments into a normalized request.

```typescript
import type { ScoutClient } from './client.js';
import { resolveAdapter } from './adapters/adapter-registry.js';

export interface ScoutWrapOptions {
  scout: ScoutClient;
  provider: string;
  instanceId?: string;
  sessionId?: string;
}

function wrapFunction<T extends (...args: unknown[]) => unknown>(
  fn: T,
  scout: ScoutClient,
  provider: string,
  instanceId?: string,
  sessionId?: string,
): T {
  return (async (...args: Parameters<T>) => {
    const adapter = resolveAdapter(provider);
    const normalized = adapter.parseRequest(args[0]);
    if (normalized.prompt) {
      const decision = await scout.policyEvaluate({
        session_id: sessionId ?? normalized.sessionId ?? 'sdk-session',
        instance_id: instanceId,
        action_type: 'http',
        content: normalized.prompt,
      });
      if (decision.decision === 'block') {
        throw new Error(`Labyrinth Scout blocked request: ${decision.reason}`);
      }
    }
    return fn(...args);
  }) as T;
}

function wrapObject<T extends object>(target: T, options: ScoutWrapOptions): T {
  return new Proxy(target, {
    get(obj, prop, receiver) {
      const value = Reflect.get(obj, prop, receiver) as unknown;
      if (typeof value === 'function') {
        return wrapFunction(
          value as (...args: unknown[]) => unknown,
          options.scout,
          options.provider,
          options.instanceId,
          options.sessionId,
        );
      }
      if (value && typeof value === 'object') {
        return wrapObject(value, options);
      }
      return value;
    },
  });
}

export function scoutWrap<T extends object>(client: T, options: ScoutWrapOptions): T {
  return wrapObject(client, options);
}
```

## Piece 6: `src/middleware.ts` - HTTP-based Express middleware

```typescript
import type { NextFunction, Request, Response } from 'express';
import type { ScoutClient } from './client.js';
import { resolveAdapter } from './adapters/adapter-registry.js';

export interface ScoutMiddlewareOptions {
  scout: ScoutClient;
  agentType: string;
  instanceId?: string;
}

export function scoutMiddleware(options: ScoutMiddlewareOptions) {
  const adapter = resolveAdapter(options.agentType);

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const normalized = adapter.parseRequest(req.body, {
      path: req.path,
      method: req.method,
      headers: req.headers as Record<string, string>,
    });

    if (!normalized.prompt) {
      next();
      return;
    }

    try {
      const decision = await options.scout.policyEvaluate({
        session_id: normalized.sessionId ?? 'sdk-session',
        instance_id: options.instanceId,
        action_type: 'http',
        content: normalized.prompt,
      });

      if (decision.decision === 'block') {
        res.status(403).json({
          error: {
            message: `Request blocked by Labyrinth Scout: ${decision.reason}`,
            type: 'policy_violation',
            code: 'policy_blocked',
            riskScore: decision.riskScore,
          },
        });
        return;
      }
    } catch {
      // Scout unreachable - fail open (do not block requests when Scout is down)
    }

    next();
  };
}
```

## Piece 7: `src/adapters/` - copy adapters from Scout server

Copy these files verbatim from `console.labyrinthscout.com/src/integration/adapters/`:
- `generic-adapter.ts`
- `openai-adapter.ts`
- `langchain-adapter.ts`
- `carina-adapter.ts`
- `hermes-adapter.ts`
- `openclaw-adapter.ts`

Also copy `console.labyrinthscout.com/src/integration/adapter-registry.ts` to
`src/adapters/adapter-registry.ts` and update import paths to be relative within the SDK.

Copy `console.labyrinthscout.com/src/integration/agent-adapter.interface.ts` to
`src/agent-adapter.interface.ts` and update import paths.

These files have no dependency on Scout's database or internal services. They are pure
parsing logic that can live in the SDK without modification.

## Piece 8: `src/index.ts`

```typescript
export { ScoutClient } from './client.js';
export { KillSwitchWatcher, KillSwitchSseWatcher } from './kill-switch.js';
export { scoutWrap } from './wrap.js';
export { scoutMiddleware } from './middleware.js';
export type {
  ScoutClientOptions, ScoutWrapOptions, ScoutMiddlewareOptions, KillSwitchWatcherOptions,
} from './client.js';
export type * from './types.js';
```

## Piece 9: `package.json`

```json
{
  "name": "labyrinth-scout-sdk",
  "version": "0.1.0",
  "description": "Governance SDK for connecting autonomous AI agents to Labyrinth Scout",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "dev": "tsx watch src/index.ts"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "vitest": "^2.0.0",
    "tsx": "^4.0.0"
  },
  "peerDependencies": {
    "express": ">=4.0.0"
  },
  "peerDependenciesMeta": {
    "express": { "optional": true }
  }
}
```

## Tests

File: `src/__tests__/client.test.ts`

Use `vi.hoisted` to mock `fetch`. Tests must not make real HTTP calls.

```typescript
const { mockFetch } = vi.hoisted(() => ({ mockFetch: vi.fn() }));
vi.stubGlobal('fetch', mockFetch);
```

Write these tests:

### `client.test.ts` (8 tests)

1. `emit: POST /api/events with correct headers and body`
2. `heartbeat: POST /api/heartbeat with instance_id and name`
3. `register: POST /api/instances/register returns instance_id`
4. `instanceStatus: GET /api/instances/:id/status returns suspended=false`
5. `policyEvaluate: POST /api/policy/evaluate with tool_name returns decision`
6. `policyEvaluate: throws when Scout returns non-ok status`
7. `policyContext: POST /api/policy/context with content and session_id`
8. `killSwitchStatus: GET /api/killswitch/status returns armed=true`

### `kill-switch.test.ts` (5 tests)

Mock `ScoutClient.killSwitchStatus`:

1. `start: calls onKill when status transitions to triggered=true`
2. `start: calls onResume when status transitions back to triggered=false`
3. `start: does not call onKill when Scout throws (fail-safe)`
4. `stop: clears poll timer and stops checking`
5. `stop: does not call onKill after stop() even if triggered`

### `wrap.test.ts` (4 tests)

Mock `ScoutClient.policyEvaluate`:

1. `scoutWrap: passes through when decision=allow`
2. `scoutWrap: throws before underlying call when decision=block`
3. `scoutWrap: wraps nested object methods (client.chat.completions.create)`
4. `scoutWrap: passes through when Scout throws (fail open)`

Wait - for governance, should wrap fail open or fail closed? Use fail closed for block
decisions (throw) and fail open only when Scout is unreachable (catch network error,
log warning, proceed). This matches middleware behaviour.

### `middleware.test.ts` (4 tests)

Use `supertest`:

1. `scoutMiddleware: passes request through when decision=allow`
2. `scoutMiddleware: returns 403 with policy_blocked code when decision=block`
3. `scoutMiddleware: passes through when Scout throws (fail open on network error)`
4. `scoutMiddleware: passes through when prompt is empty (nothing to evaluate)`

## Validation

```bash
cd labyrinth-scout-sdk
npm install
npm run build   # clean compile
npm test        # all 21 tests green

# Confirm Scout server still compiles (copying adapters must not break originals)
cd ../console.labyrinthscout.com
pnpm test       # all existing Scout tests still green
```

## Constraints

- No changes to `console.labyrinthscout.com/src/integration/scout-wrap.ts` or
  `scout-middleware.ts` - those are the co-located versions; the SDK is the remote version
- The SDK adapters are independent copies, not imports from Scout server
- `scoutMiddleware` fails open on Scout network errors (do not block agent requests when
  Scout is temporarily unreachable)
- `scoutWrap` throws on `decision=block` and fails open on Scout network errors
- `KillSwitchWatcher` never kills on Scout network errors (fail safe, not fail open)
- No em dashes. No emojis.

## Usage example to include in README

```typescript
import { ScoutClient, scoutWrap, KillSwitchWatcher } from 'labyrinth-scout-sdk';
import OpenAI from 'openai';

const scout = new ScoutClient({ url: 'https://scout.myorg.com', apiKey: process.env.SCOUT_API_KEY });

// Register this agent instance on startup
const { instance_id } = await scout.register('Customer Support Bot', 'openai');

// Send heartbeats every 30 seconds
setInterval(() => scout.heartbeat(instance_id, 'Customer Support Bot'), 30_000);

// Kill switch: gracefully stop if triggered
const watcher = new KillSwitchWatcher(scout, {
  instanceId: instance_id,
  onKill: async (reason) => {
    console.log('Scout kill switch triggered:', reason);
    process.exit(0);
  },
});
watcher.start();

// Wrap LLM client - all calls screened by Scout before execution
const openai = scoutWrap(new OpenAI(), { scout, provider: 'openai', instanceId: instance_id });

// Audit a completed action
await scout.emit({
  event_type: 'tool_call', severity: 'info',
  source: instance_id, description: 'Fetched customer record',
  metadata: { customerId: '12345' }, session_id: 'sess-abc',
});
```
