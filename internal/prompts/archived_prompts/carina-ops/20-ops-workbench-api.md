# Carina Ops Sprint 4.4: Workbench run API

## Goal

Let customers run prompts through the workbench and meter usage into `usage_records`.

## Context

- Port run logic from `ops.carinaai.uk/lib/ai-platform.ts` `createWorkbenchRun()` / `executeWorkbenchRun()`
- LLM: use existing `src/brain/llm.ts` router with org BYOK keys applied via `setTenant()`
- Table: `ai_platform_workbench_runs`

## Dependencies

- `17-ai-platform-migrations-core.md`
- `19-ops-vault-api.md`

## Files to create

- `core.carinaai.uk/src/hosted/workbench-service.ts`
- `core.carinaai.uk/src/hosted/workbench-service.test.ts`

## Files to modify

- `core.carinaai.uk/src/api/carina-ops-routes.ts`
- `core.carinaai.uk/src/gateway/web/ops/workbench.html`

## Step-by-step

1. `POST /api/carina-ops/workbench/run` body:

```json
{ "prompt": "...", "provider": "openai", "model": "gpt-4o", "title": "optional" }
```

2. Flow:

- Validate prompt length (max 32k chars)
- Load org BYOK key for provider; 400 if missing
- Insert run row status `running`
- Call LLM router with tenant context
- Update run with tokens, cost estimate, response text, status `completed`
- Insert `usage_records` row with org_id
- Audit: `workbench.run_started`, `workbench.run_completed`

3. `GET /api/carina-ops/workbench/runs?limit=20` for history (usage.read).

4. Redact prompt/response in audit details; store full text only in workbench table scoped by org.

5. `workbench.html`: textarea, model select, Run button, results panel, recent runs list.

## Expected behavior

- Run completes and returns `{ runId, responseText, tokensIn, tokensOut, costEstimate }`
- Usage visible on overview after run
- Operator can run; viewer cannot

## Test

```bash
cd core.carinaai.uk && pnpm test src/hosted/workbench-service.test.ts
```

Mock LLM call; assert usage row and audit events written.

## Success metric

Time to first prompt under 10 minutes once UI wired (manual check).
