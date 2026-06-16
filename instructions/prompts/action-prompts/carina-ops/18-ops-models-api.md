# Carina Ops Sprint 4.2: Models catalog API

## Goal

Expose `GET /api/carina-ops/models` returning org-scoped model catalog for workbench.

## Context

- Tables from prompt 17
- Port read logic from `ops.carinaai.uk/lib/ai-platform.ts` `listModels()`

## Dependencies

- `15-carina-ops-api-router.md`
- `17-ai-platform-migrations-core.md`

## Files to create

- `core.carinaai.uk/src/hosted/ai-platform-models.ts`

## Files to modify

- `core.carinaai.uk/src/api/carina-ops-routes.ts`
- `core.carinaai.uk/src/gateway/web/ops/workbench.html` (populate model dropdown)

## Step-by-step

1. Implement:

```typescript
export async function listModelsForOrg(orgId: string): Promise<AiPlatformModel[]>;
```

2. Route:

```typescript
router.get('/models', requireOrgMember('usage.read'), async (req, res) => {
  const models = await listModelsForOrg(orgContext(req).orgId);
  res.json({ models });
});
```

3. Response shape:

```json
{
  "models": [
    { "id", "provider", "model", "tier", "inputPrice", "outputPrice", "isDefault", "status" }
  ]
}
```

4. Workbench HTML: fetch models on load; populate `<select id="model">`.

5. RBAC: all roles with `usage.read` can list models.

## Expected behavior

- Org A and Org B see only their model rows
- Default model flagged `isDefault: true`

## Test

Add to `carina-ops-routes.test.ts`: models endpoint returns array, 403 for wrong org injection.

```bash
cd core.carinaai.uk && pnpm test src/api/carina-ops-routes.test.ts
```
