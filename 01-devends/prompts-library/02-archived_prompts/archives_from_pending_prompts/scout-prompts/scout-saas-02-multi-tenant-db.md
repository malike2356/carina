# Scout SaaS -- Prompt 2 of 6: Multi-Tenant Database
**Status: COMPLETED 2026-07-27**

**What was built:** Migrations 007-009, api-keys lib, tenant middleware, organization_id on tenant tables

# Build Phase: Data Layer
# Depends on: Prompt 1 (isolated engine)
# Blocks: Prompt 3 (public API)
# Estimated time: 4-5 hours

## Context

Scout-engine is workspace-scoped (`workspace_id`), not organization-scoped. SaaS billing and API keys need an `organizations` layer. Prefer mapping: one organization owns one or more workspaces; tenant isolation for public API uses `organization_id`, while existing engine tables keep `workspace_id` and gain `organization_id` where needed.

### Actual tables (do not invent agents/scans/alerts/scores)

From migrations 001-006 and event-server:

- `workspaces`, `targets`, `scan_runs`, `tool_executions`, `findings`, `discovered_assets`, `compliance_evidence`
- `scout_scores`, `score_alerts`
- `alert_rules`, `alert_history`, `alert_mutes`, `webhooks`, `report_cache`, `workspace_settings`
- `connected_agents`, `agent_events`
- Event-server: `security_events`, `kill_switch_state` (and its own alert tables)

There is no table named `agents`, `scans`, `alerts`, `scores`, `events`, or `reports`. Use the real names above.

## Task

### Step 1: Organizations and API keys

Create `src/db/migrations/007-organizations-api-keys.sql`:

```sql
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    plan TEXT NOT NULL DEFAULT 'free',
    -- plans: free | monitor | govern | team  (Stripe SoT amounts: Monitor £99, Govern £199, Team £399)
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    subscription_status TEXT DEFAULT 'inactive',
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    key_hash TEXT UNIQUE NOT NULL,
    key_prefix TEXT NOT NULL,
    name TEXT NOT NULL,
    scopes TEXT[] DEFAULT '{read,write}',
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_api_keys_org ON api_keys(organization_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys(key_prefix);
```

### Step 2: Add organization_id to tenant tables

Create `src/db/migrations/008-add-organization-id.sql`:

- Add `organization_id UUID REFERENCES organizations(id)` to: `workspaces`, `targets`, `scan_runs`, `findings`, `scout_scores`, `alert_rules`, `alert_history`, `connected_agents`, `agent_events`, `webhooks`, `report_cache`, `workspace_settings` (and other workspace-owned tables that store customer data).
- Seed default org `00000000-0000-0000-0000-000000000001` (`slug = default`).
- Backfill NULL rows to that org; then `SET NOT NULL` where safe.
- Add indexes `idx_<table>_org`.
- Optionally link default workspace to default org if a workspace with that UUID exists; otherwise create one.

Also update event-server migrations or a companion SQL file so `security_events` can store `organization_id` when present.

### Step 3: Tenant middleware + API key helpers

Create:

- `src/lib/api-keys.ts` - `createApiKey`, `getOrganizationFromApiKey` (bcrypt hash, prefix lookup, update `last_used_at`). Raw keys: `sk_live_<hex>`.
- `src/api/middleware/tenant-scope.ts` - resolve org from `Authorization: Bearer sk_live_...` or `X-Scout-Key`, attach `req.organizationId` / `req.organization`. Keep existing workspace auth for internal `/api/v1` routes; public routes (Prompt 3) must use this middleware.

Use `bcryptjs` (already a dependency), not `bcrypt`, unless you add bcrypt intentionally.

### Step 4: Scope writes/reads that create tenant data

Where agents, findings, events, scores, and alerts are inserted or listed for customer data, include `organization_id` (and keep `workspace_id`). Prefer a shared helper that resolves default workspace for an org.

Existing Carina integration: create a dedicated org API key documented in `.env.example` as `SCOUT_CARINA_ORG_API_KEY` (operator-generated), used by Carina's HTTP client.

## Edge Cases

- Existing rows without org: seeded to default org
- Org hard delete: cascade API keys; soft-delete or cascade workspace-owned data per product policy (cascade API keys at minimum)
- Plan enforcement is Prompt 3/5; migration only stores `plan`

## Acceptance Criteria

- Migrations apply on a fresh Postgres from docker-compose
- API key create/lookup works (`sk_live_...`)
- Customer-facing queries can filter by `organization_id`
- Org A key cannot read Org B `connected_agents` / `findings` / `agent_events`
- Default org keeps legacy workspace data working
- No em dashes/en dashes; no emojis

## Files to Reference

- Engine migrations: `/opt/lampp/htdocs/verlox/scout/scout-engine/src/db/migrations/`
- Auth: `/opt/lampp/htdocs/verlox/scout/scout-engine/src/api/auth-middleware.ts`
- Stripe SoT (plan names/amounts only): `/opt/lampp/htdocs/verlox/.access/.stripe-credentials-and-price-id.md` (never paste secrets)

## Post-build (MANDATORY)

Follow POST-BUILD-CHECKLIST. Batch-archive with sibling scout prompts when all 6 are done.
