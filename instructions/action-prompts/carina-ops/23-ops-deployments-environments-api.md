# Carina Ops Sprint 4.7: Deployments and environments API (Team tier)

## Goal

Team-plan endpoints for deployment and environment tracking, ported from ops AI platform.

## Context

- P1 features gated to `carina_ops_team`
- Read-only v1: list and create; no CI integration yet
- Reference `ops.carinaai.uk/lib/ai-platform.ts` deployments/environments sections

## Dependencies

- `17-ai-platform-migrations-core.md`
- `13-plan-gates-module.md`
- `15-carina-ops-api-router.md`

## Files to create

- `core.carinaai.uk/src/hosted/deployments-service.ts`

## Files to modify

- `core.carinaai.uk/src/api/carina-ops-routes.ts`
- `core.carinaai.uk/src/gateway/web/ops/index.html` (team-only nav link)

## Step-by-step

1. Routes (all require `carina_ops_team` via `requireFeature('deployments')`):

| Method | Path | Action |
|--------|------|--------|
| GET | `/deployments` | list |
| POST | `/deployments` | create `{ name, environmentId, notes }` |
| GET | `/environments` | list |
| POST | `/environments` | create `{ name, slug }` |

2. RBAC: `deployments.read` for GET; `org.settings.write` for POST (admin+).

3. Audit: `deployment.created`, `environment.created`.

4. Starter plan receives 402 on these routes.

5. UI: simple tables on overview or dedicated section in settings (minimal v1).

## Expected behavior

- Team org can create environment then deployment linked to it
- Starter receives upgrade_required response
- All rows scoped by org_id

## Test

```bash
cd core.carinaai.uk && pnpm test src/hosted/deployments-service.test.ts
```

## Exit criteria

Sprint 4 complete: customer connects BYOK, runs workbench, sees usage and audit without ops.carinaai.uk.
