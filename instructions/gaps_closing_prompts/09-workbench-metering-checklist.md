# Prompt: Workbench Metering, Estimate API, Credits UI, and Margin Guardrails

**Status: done (2026-06-14)**
**Effort: 3-5 days**
**Depends on:** `06-metering-and-credit-billing.md` (backend primitives), `08-carina-ops-metering-model-switching.md` (product spec)

## What this builds

Close the remaining Carina Ops metering gaps after prompt 06 landed the billing primitives. Prompt 08 defined the full product vision; this prompt is the **executable checklist** for the work that is still open:

1. Wire credit gate and ledger into the workbench execution path.
2. Add a pre-run estimate API and surface it in the customer workbench UI.
3. Replace token-based quota copy with weighted credits and model class language.
4. Implement margin reporting and guardrails for VERLOX admin and managed inference safety.

Work in `core.carinaai.uk/`. The VERLOX internal panel (`ops.carinaai.uk/`) is only for admin margin views; customer UI lives under `packages/web/assets/web/ops/`.

---

## What already exists (do not rebuild)

Read before editing:

- `src/billing/rate-card.ts` - model classification, weighted credits, versioned rate cards
- `src/billing/credit-gate.ts` - plan class entitlements, allowance checks
- `src/billing/credit-ledger.ts` - debits, top-ups, monthly balance, model mix
- `src/billing/ops-metering-service.ts` - `getOpsCreditUsageSummary`, `getOpsModelMetering`
- `src/agents/carina.ts` - reference implementation for pre-call gate and post-call debit (lines ~435-487)
- `src/api/carina-ops-routes.ts` - `GET /models`, `GET /usage`, `GET /credits`, `POST /topup`
- `src/brain/llm.ts` - directional tokens on provider responses
- `src/memory/migrations.ts` - `ops_model_rate_cards`, `ops_credit_ledger`, `ops_plan_model_classes`
- Tests: `rate-card.test.ts`, `credit-gate.test.ts`, `credit-ledger.test.ts`, `metering-flow.test.ts`

---

## What is still wrong (starting state)

- `src/hosted/workbench-service.ts` uses flat `checkOrgUsageQuota` and estimates tokens from text length, not provider metadata.
- Credit gate and `debitCredits` are not called from the workbench path.
- No `POST /workbench/estimate` (or equivalent) for pre-run burn preview.
- Customer UI (`workbench.html`, `usage.html`, `layout.js`) still speaks in tokens and USD cost, not credits and model class.
- No margin report module or admin view; 65% floor is documented but not enforced on all entry points.

---

## BYOK rule (non-negotiable)

Workbench auto-selects inference mode per provider:

- **BYOK** when a Vault key exists: enforce plan **model class** only; **do not** debit billable credits; record `byok_usage` with `provider_cost_usd`.
- **Managed** when no Vault key and `CARINA_OPS_MANAGED_WORKBENCH_ENABLED=true` with platform keys configured: full `checkCreditGate` (including margin floor); `debitCredits` after run; persist `credits_billed` on the run row.

Implementation: `src/hosted/workbench-inference.ts`, `resolveWorkbenchInferenceMode()`, managed runner uses platform keys only (no tenant override).

---

## Phase 1: Wire credit gate and ledger into workbench

**Status: done (2026-06-14)**

### 1.1 Extend LLM runner to return directional tokens

| File | Task |
|------|------|
| `src/hosted/workbench-service.ts` | Change `WorkbenchLlmRunner` return type to include `tokensIn`, `tokensOut`, `tokensCached`, `tokensUsed`. |
| Same | Update `defaultLlmRunner` to pass through fields from `LLMRouter.chat()`. |
| Same | Use `estimateTokensFromText` only as fallback when provider returns zeros. |

### 1.2 Pre-run gate (replace flat token quota)

| File | Task |
|------|------|
| `src/hosted/workbench-service.ts` | Import billing helpers: `getOrgPlan`, `checkCreditGate`, `getAllowedModelClasses`, `classifyModel`, `highestAllowedModelClass`, `getCurrentRateCard`, `estimateCreditsForCall`. |
| Same | Replace `checkOrgUsageQuota` with: resolve plan; classify model; downgrade disallowed class; estimate credits from prompt plus default output budget (e.g. 1000 tokens, same as agent); call `checkCreditGate`. |
| Same | Add `WorkbenchCreditsError` (429) with `{ used, limit, remaining, modelClass, reason }`; migrate callers off `WorkbenchQuotaError` or alias it. |
| Same | On gate failure: mark run `failed` in DB; do not leave rows stuck in `running`. |

### 1.3 Post-run ledger and internal cost

| File | Task |
|------|------|
| `src/hosted/workbench-service.ts` | After LLM: `computeBillableCredits` from real token fields. |
| Same | BYOK: ledger row with `provider_cost_usd` from `estimateCost()` and `credits: 0`, or call new `recordByokUsage()` helper. |
| Same | Keep `recordOrgUsage()` for backward compat with real token counts; note deprecation in comment. |
| `src/billing/credit-ledger.ts` | Optional: add `recordByokUsage()` if BYOK rows should not go through `debitCredits`. |

### 1.4 Schema (additive only)

| File | Task |
|------|------|
| `src/memory/migrations.ts` or `src/api/hosted-migrations.ts` | Add to `ai_platform_workbench_runs`: `model_class TEXT`, `credits_billed NUMERIC(18,6)`, `tokens_cached INT DEFAULT 0`. |

### 1.5 API error handling and response shape

| File | Task |
|------|------|
| `src/api/carina-ops-routes.ts` | Handle `WorkbenchCreditsError`: 429 with `credits_exhausted` or `model_class_blocked`, plus `remaining`, `modelClass`. |
| Same | Extend workbench run JSON with `modelClass`, `creditsBilled`, `tokensCached`. |

### 1.6 Tests

| File | Task |
|------|------|
| `src/hosted/workbench-service.test.ts` | Gate blocks frontier on starter; BYOK run writes ledger with zero credits; directional tokens from runner; failed run leaves clean state. |
| `src/billing/__tests__/metering-flow.test.ts` | Optional workbench-shaped scenario. |

---

## Phase 2: Pre-run estimate endpoint and workbench UI

**Status: done (2026-06-14)**

### 2.1 Shared estimate helper

| File | Task |
|------|------|
| `src/billing/ops-metering-service.ts` | Add `estimateWorkbenchUsage({ orgId, planId, provider, model, prompt, estimatedOutputTokens? })` returning `{ modelClass, allowed, gateReason?, estimatedCredits, estimatedProviderCostUsd, remainingCredits, percentUsed }`. |

### 2.2 Route

| File | Task |
|------|------|
| `src/api/carina-ops-routes.ts` | Add `POST /workbench/estimate` with body `{ prompt, provider, model }`; auth `requireOrgMember('workbench.run')`. |
| `src/api/carina-ops-routes.test.ts` | Test success shape, blocked class, over-limit estimate. |

### 2.3 Workbench UI

| File | Task |
|------|------|
| `packages/web/assets/web/ops/workbench.html` | Panel: model class, est. credits, remaining, allowed or blocked reason. |
| Same | Debounced estimate on model change and prompt input (`POST /api/carina-ops/workbench/estimate`). |
| Same | Disable Run when `allowed === false`. |
| Same | After run: show actual credits billed (0 for BYOK), model class, tokens in/out/cached. |
| `src/hosted/ai-platform-models.ts` | Optional: attach `modelClass` per model in list response. |

### 2.4 Model switching by class (UI)

| File | Task |
|------|------|
| `packages/web/assets/web/ops/workbench.html` | Optional routing class control (`mini` / `balanced` / `premium`) filtering dropdown to cheapest allowed model in class. |

---

## Phase 3: Replace token quota UI with credits and model class

**Status: done (2026-06-14)**

### 3.1 Credits status API

| File | Task |
|------|------|
| `src/hosted/usage-service.ts` | Extend `CreditsStatus` with `unit: 'credits'`, `modelMix`, `allowedClasses`; prefer ledger when `includedCredits !== null`. |
| Same | `maybeNotifyUsageWarning` should use credit balance, not flat token quota, on credit plans. |
| `src/hosted/usage-warning-email.ts` | Copy says credits, not tokens. |

### 3.2 Usage page

| File | Task |
|------|------|
| `packages/web/assets/web/ops/usage.html` | Credits bar (used / included + topups); progress colours at 75/90%; model mix table by class. |
| Same | Fix quota banner to credits language. |
| Same | Top up button to `POST /api/carina-ops/topup`. |

### 3.3 Global layout

| File | Task |
|------|------|
| `packages/web/assets/web/ops/layout.js` | `renderCreditsBanner()` from `/api/carina-ops/credits` on all ops pages when warning. |
| `packages/web/assets/web/ops/index.html` | Overview cards: credits remaining, active model class. |

### 3.4 Deprecate flat token path

| File | Task |
|------|------|
| `src/api/hosted-billing.ts` | `checkOrgUsageQuota` delegates to `getMonthlyBalance` when plan has `includedCredits`. |
| `src/billing/usage-meter.ts` | Document legacy; thin wrapper over ledger where possible. |

### 3.5 Tests

| File | Task |
|------|------|
| `src/hosted/usage-service.test.ts` | Credits-only status; 80% warning. |
| `src/hosted/usage-warning-email.test.ts` | Email uses credit wording. |

---

## Phase 4: Margin reporting and guardrails

**Status: done (2026-06-14)**

### 4.1 Margin math module

| File | Task |
|------|------|
| **Create** `src/billing/margin-report.ts` | `impliedGrossMargin`, `MARGIN_FLOOR = 0.65`, `getOrgMarginSummary`, `getPlatformMarginSummary`. |
| **Create** `src/billing/margin-report.test.ts` | Unit tests for margin calc and edge cases. |

Define `CREDIT_USD_RATE` in `plans.ts` or env (plan price / included credits). Never expose raw provider economics to tenant UI.

### 4.2 Pre-call margin guard (managed inference)

| File | Task |
|------|------|
| `src/billing/credit-gate.ts` | For managed paths: reject if single-call implied margin would fall below 65% at current rate card. |

### 4.3 Admin margin API and UI (VERLOX only)

| File | Task |
|------|------|
| `src/api/carina-ops-routes.ts` | `GET /admin/margins` behind platform admin auth. |
| **Create** `ops.carinaai.uk/views/ai-platform/margins.ejs` | Per-org: credits billed, provider cost, margin %, red flag below 65%. |
| `ops.carinaai.uk/routes/ai-platform.ts` | Route and nav item for margins view. |

### 4.4 Guardrails checklist (must be in code)

| Rule | Where |
|------|-------|
| Block when `remainingCredits <= 0` | `credit-gate.ts`; verify workbench calls it |
| Hard cap: `includedCredits + maxTopupCredits` | `credit-gate.ts` using `plans.maxTopupCredits` |
| Frontier blocked except enterprise | DB seed in `migrations.ts` |
| Warnings at 80% and 95% | `usage-service.ts` plus post-debit hook |
| BYOK never debits billable credits | Explicit branch in `workbench-service.ts` |

### 4.5 Reconciliation (stretch)

**Status: done (2026-06-14)**

| File | Task |
|------|------|
| **Create** `src/billing/reconciliation-job.ts` | Compare ledger provider cost vs `model_usage` monthly; log drift above 5%. |
| **Create** `src/billing/reconciliation-scheduler.ts` | Opt-in schedule via `CARINA_OPS_RECONCILIATION_ENABLED=true` (default every 24h). |
| **Create** `src/billing/reconciliation-job.test.ts` | Unit tests for drift math, query wiring, scheduler. |
| `src/cli/commands/billing-cli.ts` | `carina billing reconcile [--org=ORG_ID]` for manual runs. |

---

## Execution order

```
Phase 1 (workbench gate + ledger + tests)
  -> Phase 2 (estimate API + workbench.html)
  -> Phase 3 (usage.html, layout.js, email copy)
  -> Phase 4 (margin-report.ts, admin UI, optional reconciliation)
```

Reference pattern throughout: `src/agents/carina.ts` agent loop.

---

## Files summary

**Modify:** `src/hosted/workbench-service.ts`, `workbench-service.test.ts`, `src/api/carina-ops-routes.ts`, `carina-ops-routes.test.ts`, `src/billing/ops-metering-service.ts`, `src/billing/credit-gate.ts`, `src/hosted/usage-service.ts`, `usage-service.test.ts`, `usage-warning-email.ts`, `src/api/hosted-billing.ts`, `packages/web/assets/web/ops/workbench.html`, `usage.html`, `layout.js`, `index.html`

**Create:** `src/billing/margin-report.ts`, `margin-report.test.ts`; optional `reconciliation-job.ts`; `ops.carinaai.uk/views/ai-platform/margins.ejs`; `src/hosted/workbench-inference.ts`

---

## Phase 5: Managed workbench inference

**Status: done (2026-06-14)**

| File | Task |
|------|------|
| `src/hosted/workbench-inference.ts` | `resolveWorkbenchInferenceMode()`; env `CARINA_OPS_MANAGED_WORKBENCH_ENABLED`. |
| `src/hosted/workbench-service.ts` | Managed pre-gate via `checkCreditGate` + margin; platform-key LLM runner; `debitCredits` post-run. |
| `src/api/carina-ops-routes.ts` | Estimate resolves mode; returns `inferenceMode`; run accepts optional `inferenceMode` preference. |
| `packages/web/assets/web/ops/workbench.html` | Show inference mode in estimate panel and result meta. |
| Tests | `workbench-service.test.ts`, `workbench-inference.test.ts`, `carina-ops-routes.test.ts`. |

---

## Validation

From `core.carinaai.uk/`:

```bash
pnpm test src/hosted/workbench-service.test.ts \
  src/billing/margin-report.test.ts \
  src/billing/credit-gate.test.ts \
  src/api/carina-ops-routes.test.ts
```

Manual smoke:

1. Starter org with BYOK in vault: workbench run completes; billable credits unchanged; usage or ledger reflects provider cost only.
2. Starter org without Vault key and managed enabled: estimate shows managed path; run debits credits.
3. Frontier model on starter: estimate blocked; Run disabled.
4. Usage page shows credits bar and model mix, not token quota wording.

---

## Deliverable

Workbench and customer Ops UI use the same weighted-credit metering as the agent path. Users see estimated burn before run and actual burn after run. VERLOX can monitor margin health per org. BYOK and managed inference stay economically separated.

Mark this prompt **done** when all phases (including managed inference) pass tests and manual smoke checks above.
