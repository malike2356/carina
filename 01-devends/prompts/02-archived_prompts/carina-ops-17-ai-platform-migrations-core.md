# Carina Ops Sprint 4.1: AI platform migrations in core

## Goal

Port org-scoped AI platform tables from `ops.carinaai.uk/lib/ai-platform.ts` into core migrations.

## Context

- Ops prototype has tables: `ai_platform_orgs`, `ai_platform_models`, `ai_platform_workbench_runs`, `ai_platform_assets`, `ai_platform_agents`, `ai_platform_sessions`, `ai_platform_deployments`, `ai_platform_environments`
- Customer product uses `organizations` table; do not duplicate `ai_platform_orgs` long term
- v1: add `org_id` to all platform tables referencing `organizations(id)`

## Dependencies

- `01-org-migrations-schema.md`
- `08-org-context-helper.md`

## Files to create

- `core.carinaai.uk/src/hosted/ai-platform-schema.ts`
- `core.carinaai.uk/src/hosted/ai-platform-migrate.ts`

## Files to modify

- `core.carinaai.uk/src/api/hosted-migrations.ts`
- Read reference: `ops.carinaai.uk/lib/ai-platform.ts` (lines 255-400 approx)

## Step-by-step

1. Extract CREATE TABLE statements from ops `ensureAiPlatformTables()`; rewrite with `org_id UUID NOT NULL REFERENCES organizations(id)`.

2. Tables for v1 launch:

- `ai_platform_models` (org_id, provider, model, tier, prices, status)
- `ai_platform_workbench_runs` (org_id, prompt, response, tokens, cost)
- `ai_platform_deployments` (org_id, name, status, environment_id)
- `ai_platform_environments` (org_id, name, slug, status)

Defer agents/sessions/assets to post-90-day backlog unless trivial.

3. Seed default models on org create:

```typescript
export async function seedDefaultModelsForOrg(orgId: string): Promise<void>;
```

Copy defaults from ops `seedDefaultModels()`.

4. Call `seedDefaultModelsForOrg` from `createOrgForUser()`.

5. Do not create `ai_platform_orgs`; use `organizations` for credit balance fields later.

## Expected behavior

- Migration creates tables idempotently
- New org gets default model catalog rows
- All tables have `org_id` column and index

## Test

```bash
cd core.carinaai.uk && pnpm test src/hosted/ai-platform-migrate.test.ts
```

## Pitfalls

- Keep ops prototype tables untouched; core is source of truth for customer product
