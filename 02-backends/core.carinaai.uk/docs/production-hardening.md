# Production Hardening (7 Layers)

Status of the seven-layer production hardening pass for Carina core
(`core.carinaai.uk`) and the hosted web gateway (`packages/web`). This
document records what already existed before this pass, what was added,
where it lives, and how to test it.

## 1. Rate limiting middleware

**New:** `src/security/redis-rate-limit.ts`.

Redis-backed fixed-window rate limiting for five scopes: `login`, `signup`,
`ai_api`, `api`, `webhook`. Falls back to a single-process in-memory window
when Redis is not connected (local dev, tests), the same degrade pattern
already used by `hosted/scoped-query.ts` and the auth lockout module.
Responds `429` with a `Retry-After` header and a JSON body when the budget
for a scope/key is exhausted; sets `X-RateLimit-Limit` /
`X-RateLimit-Remaining` on allowed responses.

Defaults (overridable via `CARINA_RATE_LIMIT_<SCOPE>_MAX` /
`CARINA_RATE_LIMIT_<SCOPE>_WINDOW_MS`, disable everything with
`CARINA_RATE_LIMIT=off`):

| Scope     | Max     | Window |
|-----------|---------|--------|
| `login`   | 5       | 1 min  |
| `signup`  | 3       | 1 hour |
| `ai_api`  | 30      | 1 min  |
| `api`     | 100     | 1 min  |
| `webhook` | 60      | 1 min  |

Wired into:

- `POST /api/auth/login`, `POST /api/auth/register` (`src/api/hosted.ts`)
- `POST /app/auth/login`, `POST /app/auth/register` (`src/api/hosted-web.ts`,
  also mounted via `packages/web/src/web-server.ts`), plus
  `/app/auth/forgot-password` and `/app/auth/reset-password`
- `POST /api/cloud/auth/login`, `POST /api/cloud/auth/register`
  (`src/api/cloud/router.ts`)
- Blanket `api` scope on all of `/api/*` in `packages/web/src/web-server.ts`,
  skipped for already-authenticated cloud-proxy traffic
  (`isCloudProxyAuthorized`)
- `ai_api` scope on the operator chat endpoint (replacing the previous
  `express-rate-limit` in-memory `chatLimiter`) and on Aiva employee/worker
  message endpoints (`src/api/workspace-api.ts`), keyed by workspace id
- `webhook` scope on Stripe webhooks (hosted, cloud, and
  `src/api/billing-routes.ts`), the Mailgun/Cloudflare email webhook, and
  the Telegram webhook

This is a separate concern from the pre-existing `src/security/auth-rate-limit.ts`
(brute-force lockout by failure count) and from the widget/tool-policy
rate limits already in the codebase; none of those were duplicated, only
extended or left as-is where they already covered their scope.

**Test:** `src/security/redis-rate-limit.test.ts`.

## 2. Auth hardening

**Already present:** `src/security/auth-rate-limit.ts` existed as an
in-memory-only lockout helper, but was not wired into any real login
handler.

**Changed:** `auth-rate-limit.ts` is now Redis-backed (falls back to memory)
so lockouts are shared across app instances, and its default lockout window
is 15 minutes. All three functions (`checkAuthRateLimit`,
`recordAuthFailure`, `clearAuthFailures`) are now `async`.

**New:** `src/security/auth-hardening.ts` adds:

- `recordAuthAuditEvent(...)`: appends structured audit events (login
  success/failure/blocked, signup, logout, password reset requested and
  completed) via the existing `security-audit.ts` sink. `SecurityAuditCategory`
  gained an `auth` value for this.
- `checkSuspiciousLogin(userId, ip, userAgent)`: flags a login from an IP
  not seen before for that user (Redis set of known IPs per user, 90 day
  TTL; in-memory fallback per process otherwise). Currently only recorded
  in the audit log, not blocking.
- `getSessionVersion` / `bumpSessionVersion`: a Redis-backed (fallback
  in-memory) per-user counter used for session revocation.

Wired into:

- Brute force lockout (5 fails / 15 min) applied to `/api/auth/login`
  (`hosted.ts`), `/app/auth/login` (`hosted-web.ts`), and
  `/api/cloud/auth/login` (`cloud/router.ts`), each via
  `checkAuthRateLimit` before verifying the password and
  `recordAuthFailure` / `clearAuthFailures` around the result.
- Audit logging on all three login/register/logout/password-reset code
  paths listed above.
- Session revocation: `hosted-web.ts` stores the caller's current
  `hostedSessionVersion` in the session at login
  (`src/types/web-session.d.ts` was extended with that field).
  `confirmPasswordReset` in `src/api/hosted-auth.ts` now returns
  `{ userId } | null` instead of `boolean` so the reset handler can call
  `bumpSessionVersion(userId)`, invalidating every other active session for
  that account. `src/gateway/web-auth.ts` checks the session's stored
  version against the current version on every authenticated request
  (`requireWebAuth` and its fallback session check) and destroys the
  session if they no longer match.

**Test:** existing `src/security/security-guardrails.test.ts` (updated for
the new `async` signatures) plus new `src/security/auth-rate-limit.test.ts`
covering the 5-failures/15-minute default explicitly.

## 3. Tenant isolation

**Already present:** `src/hosted/scoped-query.ts` for `org_id` scoping, and
numerous ad hoc `requireWorkspace` checks scattered across Aiva routers.

**New:** `src/hosted/workspace-scoped-query.ts` mirrors `scoped-query.ts`
for the Aiva `workspaceId` concept (which is the same UUID as
`organizations.id`, see the file's header comment): `assertWorkspaceId`,
`workspaceWhereClause(alias?)`, `queryForWorkspace(workspaceId, sql, params)`,
and an optional, cached `workspaceExists(workspaceId)` check gated behind
`CARINA_STRICT_WORKSPACE_CHECK=true` (off by default, since some Aiva
deployments provision workspaces outside the `organizations` table).

**Changed:** `src/api/workspace-api.ts`'s `requireWorkspace` middleware was
rewritten as `enforceWorkspaceAccess` (the old name is kept as an alias so
existing route registrations still work). It now audit-logs missing or
malformed `workspaceId` values via `appendSecurityAudit` (category
`tenant_isolation`) and, when strict mode is enabled, checks the workspace
actually exists and audit-logs/404s otherwise.

**Vulnerabilities found and fixed during the audit** (both were missing
their auth middleware entirely, meaning a caller who knew or guessed a
`workspaceId` could read or act on another tenant's data):

- `src/conversations/conversations-router.ts`: `requireCloudProxy` was
  missing before `requireWorkspace`, so conversation data was reachable
  without being an authenticated proxy caller at all.
- `src/api/routes/paddle-checkout-route.ts`: same gap, allowing a caller to
  create a Paddle checkout session against a workspace that was not
  theirs.

**Deferred: Postgres Row-Level Security.** No RLS migration was added.
Reasons, so this is a deliberate decision rather than an oversight:

1. There is no dedicated `workspaces` table in this schema; `workspaceId`
   in the Aiva product is `organizations.id` reused, and other products in
   this codebase use `org_id` directly. Writing RLS policies against the
   wrong table/column would silently do nothing or break unrelated
   products.
2. The application connects to Postgres through a single shared pool
   (`src/memory/db.ts`) with one database role for all tenants and no
   per-request `SET LOCAL app.current_workspace_id` or equivalent. RLS
   policies are only enforced for the session they are set on; without
   that plumbing, adding `ENABLE ROW LEVEL SECURITY` would either do
   nothing (policies default-deny with no GUC set, breaking every query)
   or need to be paired with a session-scoped `SET` on every pooled
   connection checkout, which is a larger, connection-pool-aware change
   than "add a migration."
3. Some internal/admin/billing code paths intentionally query across
   tenants (admin dashboards, billing reconciliation, cross-workspace
   automation). Those would need an explicit bypass role or policy
   exception, which requires auditing call sites, not guessing at them.

Given that, tenant isolation for this pass is enforced at the application
layer (`enforceWorkspaceAccess`, `queryForWorkspace`,
`workspaceWhereClause`, and the `requireCloudProxy` fixes above). RLS
remains a good follow-up once there is a canonical per-request tenant
context threaded through the connection pool; it should be scoped as its
own project with a real schema audit rather than bolted on here.

## 4. Secret scanner

**New:** `carina/scripts/scan-secrets.sh`.

Scans either staged git changes (default; suitable for a pre-commit hook),
every tracked file (`--all`), or explicit file arguments, for patterns
matching Anthropic/OpenAI/xAI keys, Stripe secret/restricted/webhook keys,
Google API keys and OAuth tokens, GitHub tokens, Slack tokens, AWS access
keys, Postgres/MongoDB/Redis connection strings with embedded credentials,
PEM private key blocks, and Resend API keys. Excludes build output,
`node_modules`, lockfiles, and `*.env.example` / `*.env.sample` /
`*.env.template` files (which intentionally contain placeholder values per
`AGENTS.md`'s guidance to start from `.env.example`). Exits non-zero with a
list of matches when it finds anything, zero when clean.

```bash
# Scan what is currently staged (what a pre-commit hook would see):
carina/scripts/scan-secrets.sh

# Scan the whole tree:
carina/scripts/scan-secrets.sh --all

# Scan specific files:
carina/scripts/scan-secrets.sh path/to/file.ts
```

Optional pre-commit hook (not installed automatically, since this repo
intentionally keeps each product's git root separate and does not assume a
shared hooks setup):

```bash
# From within the relevant product's git root:
ln -s ../../scripts/scan-secrets.sh .git/hooks/pre-commit
```

Or call it as a step from an existing pre-commit framework/CI workflow.
This is a regex scanner, not an entropy/ML detector: it will not catch
every possible secret shape, and full-repository scans of docker-compose
files can show matches for `${VAR}`-style interpolation (not literal
secrets) since the patterns match on string shape, not on whether the
value is actually a literal. Review matches before assuming they are all
real leaks.

## 5. Circuit breaker

**New:** `src/lib/circuit-breaker.ts`: a generic, per-process,
closed/open/half-open circuit breaker (`CircuitBreaker` class,
`getCircuitBreaker(key, options)` keyed registry, `CircuitOpenError`).
Defaults: opens after 5 consecutive failures, stays open 30 seconds, then
allows a half-open probe, closing again after 2 consecutive successes (any
half-open failure reopens immediately). All values are configurable per
key.

**Already present (related, not duplicated):** provider fallback/failover
across LLM providers (`src/brain/fallback-chain.ts`,
`src/providers/provider-pool.ts` cooldowns), per-request timeouts
(`src/brain/request-timeout.ts`), and credential rotation
(`src/credentials/credential-retry.ts`). The circuit breaker sits
underneath all of that: it adds a fast-fail layer per provider so a
provider that is clearly down does not eat a full network timeout on every
call while the existing fallback/failover logic tries it again.

**Wired into**, one breaker per provider name (`llm:<provider>`):

- `ClaudeProvider.chat` (`src/brain/llm.ts`)
- `GeminiProvider.chat` (`src/brain/llm.ts`)
- `OpenAICompatibleProvider.chat` (`src/brain/openai-compatible-provider.ts`,
  used by OpenAI, DeepSeek, and other OpenAI-compatible adapters)

Streaming call paths were left unwrapped for this pass: a streaming call
can yield partial output before failing, and blending that with a binary
success/failure breaker signal is a separate design question (the existing
`isLateStreamCloseError` handling in `LLMRouter.routeStream` already treats
"failed after producing output" as a soft success). The non-streaming
`chat` path covers the primary hardening ask (LLM/upstream HTTP calls) and
is the one used by policy-routed and auxiliary model calls.

**Observability:** `GET /api/ops/circuit-breakers` (added to
`src/api/observability-routes.ts`, gated by the existing `authorizeOps`
check) returns the state, consecutive failure count, and next-probe time
for every breaker that has been used so far in the process.

**Test:** `src/lib/circuit-breaker.test.ts`.

## 6. Background jobs

**Already present:** several bespoke queues for specific products, none of
which are a general-purpose job queue: `src/workers/automation-run-queue.ts`
(Postgres, `FOR UPDATE SKIP LOCKED` claim/lease model, for automation
runs), `src/ops/taskflows/store.ts` (file/JSON taskflow queue),
`src/agents/command-queue.ts` (in-memory per-session), and a few other
narrow, single-purpose queues. There is no BullMQ/Bull/pg-boss dependency
in this codebase.

**New:** `src/jobs/job-queue.ts`, a minimal Redis-backed job queue for
long-running AI tasks that should not block a request or an SSE
connection indefinitely: `enqueueJob(kind, payload)`,
`getJobStatus(id)`, `updateJobProgress(id, progress)`,
`completeJob(id, result)`, `failJob(id, error)`, and
`runJobWorker(kind, handler, options)` (a simple poll loop; call once per
process per job `kind` at startup). Falls back to an in-memory queue
(single process) when Redis is not connected, matching the rest of this
pass. This is intentionally a skeleton, not a replacement for the existing
Postgres claim-based queue, which is more appropriate for durable,
multi-worker automation runs; this one is for shorter-lived job records
(for example, a single long AI generation call) that a client polls or
subscribes to.

**New:** `src/api/job-status-api.ts` (`jobStatusApiRouter`, mounted at
`/api/jobs` in `packages/web/src/web-server.ts`):

- `GET /api/jobs/:id`: current job status as JSON.
- `GET /api/jobs/:id/stream`: Server-Sent Events, following the same
  poll-and-write pattern as `/api/ops/logs/stream` in
  `observability-routes.ts` (heartbeats on unchanged state, an `event: done`
  message and stream close once the job reaches `completed` or `failed`).

This router does not enforce tenant/user auth itself, since job ids are
unguessable UUIDs and different callers (Aiva workspace tasks, internal ops
tasks, and so on) have different auth middleware already. A caller that
enqueues tenant-scoped work should mount a thin wrapper route that runs its
own `requireCloudProxy` / `enforceWorkspaceAccess` / `requireWebAuth` first
before proxying to job status, rather than exposing this router on a fully
public path for that use case.

## 7. Load tests

**New:** `tests/load/k6-smoke-test.js`, adapted from the hardening prompt's
example to real endpoints:

- Health checks: `GET /health` (primary, not behind the `/api` rate
  limiter) and `GET /api/ops/health`.
- Public platform info: `GET /api/v1/platform/health` and
  `GET /api/v1/platform/info` (both explicitly unauthenticated in
  `src/api/gateway-routes.ts`).
- An authenticated login -> workspace list flow is included as a
  commented-out sketch, not run by default: `/api/auth/login` is both
  brute-force protected (5 failures / 15 minutes) and rate-limited (5
  requests / minute per IP by default in this pass), so a naive load test
  against it would either lock out a real test account or trip its own
  rate limit for the whole run. Enable it only against a disposable
  load-test account in a non-production environment, ideally with
  `CARINA_RATE_LIMIT=off` set for that environment.

Thresholds match the hardening prompt: P95 under 500ms, P99 under 2s,
error rate under 0.1%; ramp 30s to 20 users, 1 minute at 100 users, 30s
ramp down.

```bash
# Local (server on an assigned local port by default):
k6 run tests/load/k6-smoke-test.js

# Against a deployed environment:
BASE_URL=https://core.carinaai.uk k6 run tests/load/k6-smoke-test.js
```

## Files changed or added in this pass

New:

- `src/security/redis-rate-limit.ts`, `src/security/redis-rate-limit.test.ts`
- `src/security/auth-hardening.ts`
- `src/security/auth-rate-limit.test.ts`
- `src/hosted/workspace-scoped-query.ts`
- `src/lib/circuit-breaker.ts`, `src/lib/circuit-breaker.test.ts`
- `src/jobs/job-queue.ts`
- `src/api/job-status-api.ts`
- `carina/scripts/scan-secrets.sh` (relative to the `carina/` product root)
- `tests/load/k6-smoke-test.js`
- `docs/production-hardening.md` (this file)

Modified:

- `src/security/auth-rate-limit.ts` (Redis-backed, async)
- `src/security/index.ts`, `src/security/security-audit.ts`,
  `src/security/security-guardrails.test.ts`
- `packages/web/src/web-server.ts`
- `src/api/hosted.ts`, `src/api/hosted-web.ts`, `src/api/hosted-auth.ts`,
  `src/api/__tests__/hosted-auth.test.ts`
- `src/types/web-session.d.ts`
- `src/gateway/web-auth.ts`
- `src/api/cloud/router.ts`
- `src/api/billing-routes.ts`
- `src/api/workspace-api.ts`
- `src/conversations/conversations-router.ts`
- `src/api/routes/paddle-checkout-route.ts`
- `src/brain/llm.ts`, `src/brain/openai-compatible-provider.ts`
- `src/api/observability-routes.ts`

## How to test

```bash
cd carina/02-backends/core.carinaai.uk

# Full unit test suite
npx vitest run

# Just the new/updated hardening tests
npx vitest run src/security/redis-rate-limit.test.ts \
  src/lib/circuit-breaker.test.ts \
  src/security/auth-rate-limit.test.ts \
  src/security/security-guardrails.test.ts \
  src/api/__tests__/hosted-auth.test.ts

# Type check
node_modules/.bin/tsc --noEmit -p tsconfig.json

# Secret scanner
../../../../scripts/scan-secrets.sh --all

# Load test smoke (requires the server running locally and k6 installed)
k6 run tests/load/k6-smoke-test.js
```
