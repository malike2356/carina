# TB-001: Canonical Platform Event Schema and Emitter

**Sprint:** Tollbooth platform infrastructure
**Phase:** 1 - Instrument the road
**Blocks:** TB-002, TB-003, TB-004 (nothing can charge until this records)
**Target repo:** `02-backends/core.carinaai.uk`
**Agent:** Claude Code

---

## Context

Carina's long-term revenue model depends on metering every AI action and attributing it to
a partner workspace. The foundation for this is a `platform_event` table in the core
PostgreSQL database and an emitter service that every channel adapter, tool call, and skill
invocation calls after completing work.

Right now `hosted-migrations.ts` already has `partner_accounts`, `organizations`, and
`custom_domains`. Events are not recorded per-action at the infrastructure level.
`margin-report.ts` exists and tracks gross margin at the org level using `MARGIN_FLOOR = 0.65`.
We need the granular event data that feeds that calculation and enables future per-event billing.

`src/memory/db.js` exports the `pool` (pg Pool). Use it.
`src/api/hosted-migrations.ts` is the migration file. Add new tables here.

---

## Task

### 1. Add the migration

In `src/api/hosted-migrations.ts`, add to the `MIGRATIONS` array (after the last existing entry):

```sql
CREATE TABLE IF NOT EXISTS platform_events (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID        REFERENCES organizations(id) ON DELETE SET NULL,
  partner_id    UUID        REFERENCES partner_accounts(id) ON DELETE SET NULL,
  event_type    TEXT        NOT NULL,
  model         TEXT,
  provider      TEXT,
  tokens_in     INTEGER     NOT NULL DEFAULT 0,
  tokens_out    INTEGER     NOT NULL DEFAULT 0,
  tool_calls    INTEGER     NOT NULL DEFAULT 0,
  skill_calls   INTEGER     NOT NULL DEFAULT 0,
  memory_ops    INTEGER     NOT NULL DEFAULT 0,
  latency_ms    INTEGER,
  scout_verified BOOLEAN    NOT NULL DEFAULT false,
  fee_pence     INTEGER     NOT NULL DEFAULT 0,
  metadata      JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_events_org
  ON platform_events (org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_platform_events_partner
  ON platform_events (partner_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_platform_events_type
  ON platform_events (event_type, created_at DESC);
```

Valid `event_type` values (document these as a comment above the SQL):
`'message'`, `'tool_call'`, `'skill_invocation'`, `'memory_read'`, `'memory_write'`,
`'scout_audit'`, `'webhook_delivery'`, `'channel_connect'`

### 2. Create the emitter service

Create `src/billing/platform-event-emitter.ts`:

```typescript
import { pool } from '../memory/db.js';

export interface PlatformEventInput {
  orgId?: string | null;
  partnerId?: string | null;
  eventType: 'message' | 'tool_call' | 'skill_invocation' | 'memory_read' |
             'memory_write' | 'scout_audit' | 'webhook_delivery' | 'channel_connect';
  model?: string;
  provider?: string;
  tokensIn?: number;
  tokensOut?: number;
  toolCalls?: number;
  skillCalls?: number;
  memoryOps?: number;
  latencyMs?: number;
  scoutVerified?: boolean;
  feePence?: number;
  metadata?: Record<string, unknown>;
}

export async function emitPlatformEvent(input: PlatformEventInput): Promise<void> {
  await pool.query(
    `INSERT INTO platform_events
       (org_id, partner_id, event_type, model, provider,
        tokens_in, tokens_out, tool_calls, skill_calls, memory_ops,
        latency_ms, scout_verified, fee_pence, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb)`,
    [
      input.orgId ?? null,
      input.partnerId ?? null,
      input.eventType,
      input.model ?? null,
      input.provider ?? null,
      input.tokensIn ?? 0,
      input.tokensOut ?? 0,
      input.toolCalls ?? 0,
      input.skillCalls ?? 0,
      input.memoryOps ?? 0,
      input.latencyMs ?? null,
      input.scoutVerified ?? false,
      input.feePence ?? 0,
      input.metadata ? JSON.stringify(input.metadata) : null,
    ],
  );
}
```

The function must NEVER throw. Wrap the `pool.query` in try/catch and log errors with
`console.error('[platform-event]', err)` but do not re-throw. A billing emit failure
must never take down an AI session.

### 3. Wire the emitter into the LLM response path

In `src/brain/provider-registry.ts` (or wherever the LLM call completes and token
counts are known), import `emitPlatformEvent` and call it after each successful
completion. Do not block the response on the emit: fire and continue.

```typescript
// After successful LLM response
void emitPlatformEvent({
  orgId:       context.orgId,
  partnerId:   context.partnerId,
  eventType:   'message',
  model:       completionModel,
  provider:    completionProvider,
  tokensIn:    usage.promptTokens,
  tokensOut:   usage.completionTokens,
  latencyMs:   latencyMs,
  scoutVerified: scoutVerified,
}).catch(() => {});
```

The `context.partnerId` must be resolved from the org's `partner_id` FK before this
call. Add a helper `getPartnerIdForOrg(orgId)` in `src/hosted/partner-service.ts`
that queries `SELECT partner_id FROM organizations WHERE id = $1` and returns null
if not found.

### 4. Wire into Scout audit events

In `src/security/scout-client.ts`, after writing a Scout event, emit:

```typescript
void emitPlatformEvent({ orgId, partnerId, eventType: 'scout_audit', scoutVerified: true });
```

### 5. Add a query helper for the operator dashboard

In `src/billing/platform-event-emitter.ts`, also export:

```typescript
export async function getPlatformEventSummary(options: {
  partnerId?: string;
  orgId?: string;
  fromDate: Date;
  toDate: Date;
}): Promise<{
  totalEvents: number;
  totalTokensIn: number;
  totalTokensOut: number;
  totalToolCalls: number;
  totalSkillCalls: number;
  totalFeePence: number;
  byType: Record<string, number>;
}> { ... }
```

Use a single `GROUP BY event_type` query with `SUM` aggregates. Cast the result
rows carefully (pg returns strings for bigint). Return zeros for all fields if no
rows found.

---

## What NOT to do

- Do not create a separate event queue, Redis stream, or background worker.
  Direct pg insert is correct for now. Add async queue only when insert latency
  causes measurable response time regression.
- Do not add event_type values beyond the eight listed. Premature expansion
  makes the billing logic inconsistent.
- Do not modify `usage_events` in `app.carinaai.uk`. That is a separate table in
  a separate database (Drizzle/PostgreSQL on the Next.js side). `platform_events`
  lives in `core.carinaai.uk`'s pg pool.

---

## Done when

- [ ] `platform_events` table created by migration (run `pnpm` or check `hosted-migrations.ts` auto-runs at startup)
- [ ] `emitPlatformEvent` exported from `src/billing/platform-event-emitter.ts`
- [ ] Function never throws, errors logged only
- [ ] LLM completion path calls `emitPlatformEvent` with correct fields
- [ ] Scout audit path calls `emitPlatformEvent` with `scout_audit` type
- [ ] `getPlatformEventSummary` returns correct aggregates from a test query
- [ ] `pnpm test` passes (add vitest unit tests for the summary query with mocked pool)
- [ ] `pnpm build` compiles without TypeScript errors
