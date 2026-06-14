# Prompt: Carina Ops Metering and Credit-Based Billing

## What to build

Implement the weighted-credit metering system described in `instructions/strategy/Carina_OP_Metering.md`. The goal is to make Carina Ops commercially viable: customers pay a monthly subscription that includes a credit allowance, heavy or expensive-model usage burns credits faster, and the system hard-blocks (or auto-downgrades) when the allowance is exhausted. Margin must be maintained on managed inference.

**This is not a greenfield build.** Read what already exists before touching anything.

---

## What already exists - read all of these first

- `src/billing/plans.ts` - Plan definitions with flat `tokenLimit` per plan. This is the starting point for adding `includedCredits` and `allowedModelClasses`. Read fully (178 lines).
- `src/billing/usage-meter.ts` - `UsageMeter` class: `recordUsage(tenantId, tokensUsed, model)` into `usage_records` table, `status()` with 80% flat-token warning. The flat-token approach is what we are replacing with weighted credits. Read fully (103 lines).
- `src/brain/cost-tracker.ts` - `recordUsage(sessionId, provider, tokensUsed, model)` into `model_usage` table with `estimateCost()` using per-provider USD rates. This tracks Carina's own provider cost (your internal cost, not what is billed to customers). Read fully (127 lines).
- `src/brain/llm.ts` lines 148-152 - where `tokensUsed` is currently computed as `input_tokens + output_tokens` (direction collapsed). This is where we need to capture `input_tokens`, `output_tokens`, and `cache_read_input_tokens` separately before they are collapsed.
- `src/billing/stripe-service.ts` and `src/billing/subscription-manager.ts` - existing Stripe checkout and webhook handling. Do not break these.
- `src/hosted/usage-service.ts` - `getUsageQuota()` for the ops hosted product. Read fully (163 lines).
- `src/hosted/plan-features.ts` and `src/hosted/plan-gates.ts` - plan-based feature enforcement. Read before adding model class gates.

---

## Core concepts

**Credit** - your commercial billing unit, not a raw token. One credit is priced above your blended provider cost.

**Model class** - groups models by cost tier:
- `mini` - GPT-4o mini, Claude Haiku, DeepSeek-lite equivalents. Lowest burn rate.
- `balanced` - GPT-4o, Claude Sonnet, DeepSeek-V3 equivalents. Default.
- `premium` - Claude Opus, GPT-4.5, frontier-equivalent. Higher burn rate.
- `frontier` - most expensive; blocked on lower tiers unless BYOK.

**Billable credits formula** (applied per LLM call):
```
billable_credits =
  input_tokens  * input_weight(model_class)
  + output_tokens * output_weight(model_class)
  + cache_tokens  * cache_weight(model_class)
```

**Rate card** - a DB-stored mapping of `model_class` to `(input_weight, output_weight, cache_weight, allowed_on_plans[])`. Versioned so pricing changes do not rewrite history.

**Target gross margin on managed inference: at least 65%.** If a plan's included credit bundle cannot support that margin at the assigned model class, the plan is misconfigured - do not adjust the margin target, adjust the plan.

---

## Phase 1: Split token tracking and DB schema

### 1.1 Capture directional token counts at the LLM call site

In `src/brain/llm.ts`, the Anthropic provider already has `response.usage.input_tokens` and `response.usage.output_tokens` (line 150). The OpenAI-compatible provider in `src/brain/openai-compatible-provider.ts` uses `usage.prompt_tokens` + `usage.completion_tokens` (line 111).

Change the `CarinaResponse` interface (in `src/types/`) to carry:
```typescript
tokensIn: number;
tokensOut: number;
tokensCached: number;  // cache_read_input_tokens, 0 if not available
tokensUsed: number;    // kept for backward compat: tokensIn + tokensOut
```

Update both provider implementations to populate these fields. The OpenAI-compatible provider should map `prompt_tokens` -> `tokensIn`, `completion_tokens` -> `tokensOut`, and `0` -> `tokensCached` until the provider exposes it.

### 1.2 Add migration for new tables

Add to `src/memory/migrations.ts` (follow the existing pattern):

```sql
-- Rate card: model class to credit weight mapping (versioned)
CREATE TABLE IF NOT EXISTS ops_model_rate_cards (
  id          SERIAL PRIMARY KEY,
  model_class TEXT    NOT NULL,          -- 'mini' | 'balanced' | 'premium' | 'frontier'
  input_weight  NUMERIC(10,6) NOT NULL,  -- credits per input token
  output_weight NUMERIC(10,6) NOT NULL,  -- credits per output token
  cache_weight  NUMERIC(10,6) NOT NULL,  -- credits per cache-read token
  effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  effective_to   TIMESTAMPTZ,            -- NULL = current
  note TEXT
);

-- Credit ledger: one row per debit/credit event per org
CREATE TABLE IF NOT EXISTS ops_credit_ledger (
  id           BIGSERIAL PRIMARY KEY,
  org_id       TEXT NOT NULL,
  event_type   TEXT NOT NULL,  -- 'usage' | 'topup' | 'grant' | 'refund' | 'reset'
  credits      NUMERIC(18,6) NOT NULL,  -- negative for debits
  provider_cost_usd NUMERIC(18,9),      -- actual provider cost for this event (usage only)
  model        TEXT,
  model_class  TEXT,
  session_id   TEXT,
  rate_card_id INT REFERENCES ops_model_rate_cards(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ops_credit_ledger_org_month
  ON ops_credit_ledger(org_id, created_at);

-- Model class allowlist per plan (which classes a plan permits)
CREATE TABLE IF NOT EXISTS ops_plan_model_classes (
  plan_id     TEXT NOT NULL,
  model_class TEXT NOT NULL,
  PRIMARY KEY (plan_id, model_class)
);
```

Seed `ops_model_rate_cards` with initial weights in the migration itself (not in application code, so they are in version control):

```sql
INSERT INTO ops_model_rate_cards (model_class, input_weight, output_weight, cache_weight, note) VALUES
  ('mini',      0.000002, 0.000008, 0.0000005, 'initial rate card 2026-06'),
  ('balanced',  0.000006, 0.000024, 0.0000015, 'initial rate card 2026-06'),
  ('premium',   0.000020, 0.000080, 0.0000050, 'initial rate card 2026-06'),
  ('frontier',  0.000050, 0.000200, 0.0000125, 'initial rate card 2026-06');
```

Seed `ops_plan_model_classes`:
```sql
INSERT INTO ops_plan_model_classes VALUES
  ('free',              'mini'),
  ('carina_ops_starter','mini'),
  ('carina_ops_starter','balanced'),
  ('carina_ops_team',   'mini'),
  ('carina_ops_team',   'balanced'),
  ('carina_ops_team',   'premium'),
  ('enterprise',        'mini'),
  ('enterprise',        'balanced'),
  ('enterprise',        'premium'),
  ('enterprise',        'frontier');
```

Add `included_credits` to `plans.ts` alongside the existing `tokenLimit` (keep `tokenLimit` for backward compat but treat it as informational only going forward):

```typescript
includedCredits: number | null;  // monthly credit allowance; null = unlimited (BYOK/Enterprise)
```

Starter: `500_000`. Team: `2_000_000`. Free: `50_000`. Enterprise: `null`.

### 1.3 Create src/billing/rate-card.ts

```typescript
export type ModelClass = 'mini' | 'balanced' | 'premium' | 'frontier';

export interface RateCard {
  id: number;
  modelClass: ModelClass;
  inputWeight: number;
  outputWeight: number;
  cacheWeight: number;
}

export function classifyModel(model: string): ModelClass
// Map known model names to classes. Examples:
// 'claude-haiku*', 'gpt-4o-mini', 'deepseek-chat' -> 'mini'
// 'claude-sonnet*', 'gpt-4o', 'deepseek-v3' -> 'balanced'
// 'claude-opus*', 'gpt-4.5*', 'o3*' -> 'premium'
// 'gpt-5*', 'claude-fable*' -> 'frontier'
// Unknown models: default to 'balanced' (safer than 'mini' for margin)

export async function getCurrentRateCard(modelClass: ModelClass): Promise<RateCard>
// SELECT * FROM ops_model_rate_cards WHERE model_class = $1
//   AND effective_from <= NOW() AND (effective_to IS NULL OR effective_to > NOW())
// ORDER BY effective_from DESC LIMIT 1

export function computeBillableCredits(
  rateCard: RateCard,
  tokensIn: number,
  tokensOut: number,
  tokensCached: number,
): number
// Apply the formula. Round up to 6 decimal places.
```

Write `src/billing/rate-card.test.ts` (Vitest):
- `classifyModel` maps known models to correct classes, unknown models default to `balanced`
- `computeBillableCredits` produces correct values for known inputs
- Test that a premium model burns more credits than balanced for identical token counts

---

## Phase 2: Credit gate and ledger write on every LLM call

### 2.1 Create src/billing/credit-gate.ts

```typescript
export interface CreditGateResult {
  allowed: boolean;
  reason?: string;
  remainingCredits: number;
  modelClassAllowed: boolean;
}

export async function checkCreditGate(
  orgId: string,
  planId: BillingPlanId,
  modelClass: ModelClass,
  estimatedCredits: number,
): Promise<CreditGateResult>
```

Logic:
1. Query `ops_plan_model_classes` to check if `modelClass` is allowed on `planId`. If not: `{ allowed: false, reason: 'model class not available on your plan', ... }`.
2. If `plan.includedCredits === null` (Enterprise/BYOK): `{ allowed: true, remainingCredits: Infinity, ... }`.
3. Sum ledger debits for the current calendar month for `orgId`: `SELECT SUM(credits) FROM ops_credit_ledger WHERE org_id = $1 AND created_at >= date_trunc('month', NOW())`.
4. `remainingCredits = plan.includedCredits + monthlyTopups - |monthlyDebits|`.
5. If `remainingCredits <= 0`: `{ allowed: false, reason: 'monthly credit allowance exhausted. Top up or upgrade.' }`.
6. If `estimatedCredits > remainingCredits` but `remainingCredits > 0`: allow but flag (`reason: 'warning: this call may exhaust remaining credits'`).

### 2.2 Create src/billing/credit-ledger.ts

```typescript
export async function debitCredits(input: {
  orgId: string;
  sessionId: string;
  model: string;
  modelClass: ModelClass;
  rateCardId: number;
  credits: number;
  providerCostUsd: number;
}): Promise<void>
// INSERT INTO ops_credit_ledger (org_id, event_type, credits, provider_cost_usd, model, model_class, session_id, rate_card_id)
// VALUES ($1, 'usage', -$2, $3, $4, $5, $6, $7)

export async function creditTopup(orgId: string, credits: number, note?: string): Promise<void>
// INSERT INTO ops_credit_ledger (org_id, event_type, credits) VALUES ($1, 'topup', $2)

export async function getMonthlyBalance(orgId: string, includedCredits: number | null): Promise<{
  used: number;
  remaining: number | null;
  percentUsed: number | null;
}>
```

### 2.3 Wire the gate into the agent request path

In `src/agents/carina.ts` (and/or `src/brain/llm.ts`), before each LLM call:

1. If the session is org-scoped (check `this.sessionId` or a context field for `orgId`):
   a. Classify the target model.
   b. Estimate credits (use a rough estimate: `(expected_input + expected_output) * output_weight(class)`, or just check if remaining balance > 0).
   c. Call `checkCreditGate`. If `!allowed`, throw a user-visible error (not a stack trace) that tells the user to top up or switch to a lower model class.
   d. If `allowed` but the model class is wrong, auto-downgrade to the highest allowed class and log it.

2. After the LLM call returns:
   a. Compute actual billable credits from `(tokensIn, tokensOut, tokensCached)` and the rate card.
   b. Call `debitCredits`.

**Do not break the existing `recordUsage` call in `carina.ts:411`** - keep the internal cost tracking alongside the new credit debit. They serve different purposes: `model_usage` is your internal reconciliation table; `ops_credit_ledger` is the customer billing ledger.

Write `src/billing/credit-gate.test.ts` (Vitest, mock pool):
- Allowed when balance is sufficient and model class is permitted
- Blocked when balance is zero
- Model class not allowed on plan returns `modelClassAllowed: false`
- Enterprise plan with `null` includedCredits is always allowed
- Warning flag when estimated credits exceed remaining balance without blocking

---

## Phase 3: API endpoints

Add to `src/api/carina-ops-routes.ts` (or a new `src/api/ops-metering-routes.ts` if it keeps that file under ~200 lines):

### GET /api/ops/usage

Return the org's current usage summary:
```json
{
  "creditsUsed": 412500,
  "creditsIncluded": 500000,
  "creditsRemaining": 87500,
  "percentUsed": 82.5,
  "modelMix": [
    { "modelClass": "balanced", "creditsUsed": 380000, "providerCostUsd": 0.42 },
    { "modelClass": "mini", "creditsUsed": 32500, "providerCostUsd": 0.03 }
  ],
  "warningThreshold": 80,
  "blocked": false
}
```

### GET /api/ops/models

Return the model classes available to this org's plan:
```json
{
  "allowedClasses": ["mini", "balanced"],
  "rateCard": {
    "balanced": { "inputWeight": 0.000006, "outputWeight": 0.000024 },
    "mini": { "inputWeight": 0.000002, "outputWeight": 0.000008 }
  }
}
```

### POST /api/ops/topup

Accept a Stripe payment for additional credits. Body: `{ packId: 'small' | 'large' }`. Return a Stripe Checkout URL. Wire the webhook handler to call `creditTopup` on `checkout.session.completed`.

Define packs in `plans.ts`:
```typescript
export const CREDIT_TOPUP_PACKS = {
  small: { credits: 500_000, priceGbp: 8, stripePriceEnv: 'STRIPE_PRICE_TOPUP_SMALL' },
  large: { credits: 2_000_000, priceGbp: 25, stripePriceEnv: 'STRIPE_PRICE_TOPUP_LARGE' },
};
```

---

## Phase 4: Ops panel UI surfaces

Add to `ops.carinaai.uk/views/` (or extend `gateway/web/ops/usage.html` if it exists):

### Usage page additions

- Credit bar showing used vs. remaining (percentage, coloured: green < 75%, amber 75-90%, red > 90%).
- Model mix breakdown table (class, credits consumed, estimated provider cost, implied margin).
- "Top up credits" CTA button linking to `/api/ops/topup`.

### Margin monitoring (admin-only view in ops panel)

A table showing per-org margin health. For each org:
- Credits billed this month (customer revenue).
- Provider cost this month (your cost).
- Implied gross margin %.
- Flag any org where margin < 65% in red.

This view uses `ops_credit_ledger.credits` (revenue side) and `ops_credit_ledger.provider_cost_usd` (cost side) and is only visible to VERLOX admin, not to tenants.

---

## Margin guardrails to enforce

These must be in code, not documentation:

1. No request is allowed past `checkCreditGate` if `remainingCredits <= 0`.
2. Frontier model class is blocked for any plan except `enterprise` at the DB level (seeded in `ops_plan_model_classes`). Do not gate this in application code alone - the DB seed is the ground truth.
3. A per-org monthly hard cap exists: `plan.includedCredits + max_topup_credits`. Store `max_topup_credits` per plan in `plans.ts` (e.g. Starter: 1M additional, Team: 5M additional). Once the total crosses the hard cap, requests are blocked regardless of balance.
4. Soft warning emails at 80% and 95% of monthly allowance. Wire into the `debitCredits` function (check threshold after each debit and call `sendUsageWarningEmail` from `04-usage-limit-email-warnings.md` - implement that first if not done yet).

---

## Files to create or modify

**Create:**
- `src/billing/rate-card.ts`
- `src/billing/rate-card.test.ts`
- `src/billing/credit-gate.ts`
- `src/billing/credit-gate.test.ts`
- `src/billing/credit-ledger.ts`
- `src/billing/credit-ledger.test.ts`

**Modify:**
- `src/types/index.ts` - add `tokensIn`, `tokensOut`, `tokensCached` to `CarinaResponse`
- `src/brain/llm.ts` - populate directional token fields on both providers
- `src/brain/openai-compatible-provider.ts` - same
- `src/billing/plans.ts` - add `includedCredits`, `CREDIT_TOPUP_PACKS`
- `src/billing/usage-meter.ts` - deprecate `status()` in favour of credit-ledger balance, or make it a thin wrapper that reads from the ledger
- `src/agents/carina.ts` - add pre-call gate and post-call debit
- `src/memory/migrations.ts` - add the three new tables
- `src/api/carina-ops-routes.ts` - add `/usage`, `/models`, `/topup` endpoints

---

## Tests to write

Beyond the unit tests in each new file, add integration tests in `src/billing/__tests__/`:

- `metering-flow.test.ts`: full round-trip with a mock pool - call classified as `balanced`, credits debited correctly, remaining balance decreases.
- `credit-gate.test.ts`: frontier model blocked on Starter plan, premium allowed on Team, balance-zero blocks any model.
- `topup-flow.test.ts`: `creditTopup` increases balance, subsequent gate check reflects new balance.

---

## Run after each phase

```bash
cd core.carinaai.uk
pnpm vitest run src/billing/
pnpm test
pnpm build
```

Manual check after Phase 2: start Carina, send a message as an org-scoped session, and verify a row appears in `ops_credit_ledger` with the correct `credits` debit and `provider_cost_usd`.

---

## What NOT to build here

- Do not rebuild the existing Stripe subscription checkout flow in `subscription-manager.ts`.
- Do not remove `model_usage` or `cost-tracker.ts` - they are your internal reconciliation data.
- Do not expose raw token counts or provider costs to the customer-facing API - expose credits only.
- Do not attempt to fetch live provider pricing from external APIs at runtime. The rate card is in the DB, updated manually when provider prices change materially. That is a feature, not a gap.
