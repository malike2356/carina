# Carina Ops Sprint 3.3: Carina Ops customer API router

## Goal

Create `carina-ops-routes.ts` for customer product APIs at `/api/carina-ops/*`, separate from operator `ops-routes.ts`.

## Context

**Critical:** `src/api/ops-routes.ts` is the operator machine API (`CARINA_OPS_TOKEN`). Do not modify it for customer features.

Customer router uses hosted session + org RBAC + plan gates.

## Dependencies

- `04-org-member-middleware.md`
- `13-plan-gates-module.md`

## Files to create

- `core.carinaai.uk/src/api/carina-ops-routes.ts`
- `core.carinaai.uk/src/api/carina-ops-routes.test.ts`

## Files to modify

- `core.carinaai.uk/src/gateway/web.ts` (mount router)

## Step-by-step

1. Create router with skeleton endpoints:

```typescript
export function mountCarinaOpsRoutes(app: Express): void {
  if (!config.carinaOps.productEnabled) return;
  const router = express.Router();
  router.use(requireHostedSession);
  router.use(requireOpsPlan('carina_ops_starter'));

  router.get('/overview', requireOrgMember('usage.read'), overviewHandler);
  router.get('/health', (_req, res) => res.json({ ok: true, product: 'carina-ops' }));

  app.use('/api/carina-ops', router);
}
```

2. `overviewHandler` returns:

```json
{
  "org": { "id", "name", "plan" },
  "usage": { "tokensToday", "costEstimateToday" },
  "members": 1,
  "onboarding": { "hasByok": false, "hasWorkbenchRun": false }
}
```

3. Mount in `web.ts` after hosted routes:

```typescript
import { mountCarinaOpsRoutes } from '../api/carina-ops-routes.js';
mountCarinaOpsRoutes(app);
```

4. Update `web-auth.ts` `isPublicHostedPath` if needed; `/api/carina-ops/health` may stay public.

5. Tests:

- 401 without session
- 402 for free plan on `/overview`
- 200 for starter with mocked org

## Expected behavior

- `/api/carina-ops/overview` works for paid org session
- `/api/ops/skill-packs` still requires CARINA_OPS_TOKEN (unchanged)

## Test

```bash
cd core.carinaai.uk && pnpm test src/api/carina-ops-routes.test.ts
```
