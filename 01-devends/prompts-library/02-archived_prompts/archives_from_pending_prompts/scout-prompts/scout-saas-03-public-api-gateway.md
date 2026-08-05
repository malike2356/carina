# Scout SaaS -- Prompt 3 of 6: Public API Gateway
**Status: COMPLETED 2026-07-27**

**What was built:** Public /v1 router, standalone PromptGuard, rate limits, plan enforce

# Build Phase: API Layer
# Depends on: Prompt 2 (multi-tenant DB)
# Blocks: Prompt 4 (dashboard), Prompt 6 (SDK)
# Estimated time: 5-6 hours

## Context

Internal routes already live under `/api/v1` (scan engine) and `/api/v1/events` (event server). Customers need a stable public contract under `/v1` (or `/api/public/v1`) with org API-key auth, rate limits, plan checks, and prompt filtering.

**Important:** 3-layer prompt distillation is NOT in scout-engine today. Canonical PromptGuard is at:

`propreneur/propreneur-v2/02-backends/console.labyrinthscout.com/src/security/prompt-guard.ts`

Copy or adapt a self-contained PromptGuard module into `scout/scout-engine/src/security/prompt-guard.ts` (and any small helpers it needs). Do not leave a runtime import into Propreneur.

## Task

### Step 1: Public router

Create `src/api/public/v1/index.ts` and mount at `/v1` (preferred) with tenant middleware:

```
POST   /v1/agents/register
POST   /v1/prompts/filter
GET    /v1/agents/:id/status
POST   /v1/events
GET    /v1/health
```

### Step 2: Agent registration

`POST /v1/agents/register` inserts into `connected_agents` (not a fictional `agents` table):

Request: `{ name, type, tools[], metadata? }`  
Response 201: `{ agent_id, monitoring_token, status, created_at }`

Generate ids as `agt_` + nanoid/uuid. Store tools in metadata or a JSON column via settings. Enforce plan agent caps (see rate/plan section).

### Step 3: Prompt filter

`POST /v1/prompts/filter` runs PromptGuard and returns:

```json
{
  "verdict": "allowed|flagged|blocked",
  "filtered_prompt": "...",
  "risk_level": "low|medium|high|critical",
  "distillation": { "layer_1": "...", "layer_2": "...", "layer_3": "..." },
  "finding_id": null
}
```

On flagged/blocked, optionally create a finding or security_event scoped to the org.

### Step 4: Events + status + health

- `POST /v1/events` batch-insert into `agent_events` (and/or forward to existing event ingest). Response 202: `{ accepted, rejected }`.
- `GET /v1/agents/:id/status` from `connected_agents` (+ last event / score if available). Must verify agent belongs to `req.organizationId`.
- `GET /v1/health` returns version + status (public, no auth).

### Step 5: Rate limits (Redis)

`src/lib/rate-limiter.ts` per org per minute:

| Plan | Req/min | Max agents |
|------|---------|------------|
| free | 100 | 1 |
| monitor | 1000 | 5 |
| govern | 3000 | 20 |
| team | 5000 | 50 |

Headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.

### Step 6: Plan enforcement

`src/api/middleware/plan-enforce.ts`: agent count caps; killswitch / WhatsApp-style alerts require monitor+ (or govern/team per product rules). Return standardized errors.

### Step 7: Error shape

```json
{ "error": "unauthorized|forbidden|rate_limited|not_found|plan_limit|internal", "message": "...", "retry_after": 30 }
```

## Acceptance Criteria

- Register / filter / events / status / health behave as above
- Org isolation on agent status and events
- Rate limit + plan limits enforced
- PromptGuard runs inside scout-engine with no Propreneur import
- No em dashes/en dashes; no emojis

## Files to Reference

- PromptGuard source: `propreneur/.../console.labyrinthscout.com/src/security/prompt-guard.ts`
- Event ingest: `scout/scout-engine/src/agents/event-ingest.ts`
- Kill control: `scout/scout-engine/src/control/instance-control.ts`
- Stripe plan names: `.stripe-credentials-and-price-id.md` (Monitor/Govern/Team)

## Post-build (MANDATORY)

Follow POST-BUILD-CHECKLIST. Batch-archive when all 6 are done.
