# Carina Ops pricing, metering, and routing spec

:::info Canonical inventory
Product boundaries, billing boundaries, and current plan surfaces: [Capability inventory](/docs/capabilities).
:::

This document defines the commercial model for **Carina Ops** so the platform stays economically viable when model switching is enabled.

The rule is simple:

- **Carina AI** stays free for personal use.
- **Carina Ops** is a paid addon for teams that need BYOK, audit, deployment control, and spend limits.
- **Managed inference must never be unlimited.** Every paid plan needs a measurable allowance and a hard stop.

## Product goal

Carina Ops is not a model marketplace. It is an operations layer around Carina AI that lets teams:

- choose providers and models
- use their own keys or Carina-managed keys
- inspect cost before a run
- cap monthly spend
- review usage and audit history
- keep the business profitable

If a plan cannot absorb the cost of expensive models, the system must either:

- downgrade to a cheaper class
- require a top-up
- or require BYOK

## Pricing model

Use a subscription plus weighted usage, not unlimited access.

### Recommended launch tiers

| Plan | Price | Members | Included managed usage | Allowed model classes | Audit retention |
|---|---|---:|---:|---|---:|
| Free | 0 | 1 | 0 | Personal use only | 0 days |
| Ops Starter | GBP 19 / month | 3 | 500 credits | Cheap, balanced | 14 days |
| Ops Team | GBP 49 / month | 10 | 1,500 credits | Cheap, balanced, premium with allowance | 90 days |
| Enterprise | Custom | Custom | Custom | Custom | Custom |

These numbers are a starting point, not a promise of unlimited managed inference.

### Why the plan includes credits

Provider costs vary too much for a flat token promise to stay safe.

For example, current public API pricing shows:

- OpenAI GPT-5.4 mini at USD 0.75 input and USD 4.50 output per 1M tokens
- OpenAI GPT-5.5 at USD 5.00 input and USD 30.00 output per 1M tokens
- Anthropic Claude Sonnet 4.6 at USD 3.00 input and USD 15.00 output per MTok
- Anthropic Claude Opus 4.7 at USD 5.00 input and USD 25.00 output per MTok

That spread is too wide for a single flat token rate to protect margin. Use credits as the customer-facing unit and keep the internal cost model weighted by model class.

## Credit model

Define one internal credit as a standard billing unit, not as one literal token.

Recommended reference model:

- 1 standard credit equals a small, predictable amount of balanced-model work
- cheaper models burn fewer credits per token
- expensive models burn more credits per token
- cached input should be discounted
- tool calls should carry a separate fixed charge if they create real cost

### Suggested billable formula

```text
billable_credits =
  input_tokens * input_weight
  + output_tokens * output_weight
  + cached_input_tokens * cache_weight
  + tool_calls * tool_weight
  + batch_jobs * batch_weight
```

Recommended starting weights:

| Class | Weight |
|---|---:|
| Cheap | 0.75x |
| Balanced | 1.00x |
| Premium | 2.50x |
| Frontier | 5.00x |

Use these as plan-unit multipliers, not as literal provider pass-through. Update them when provider pricing changes.

### Margin rule

Keep managed inference gross margin above 65 percent. If a model class would push a customer below that margin, do one of the following:

- block the class on that plan
- route to a cheaper class
- ask for a top-up
- require BYOK

## Routing policy

Carina should route by policy, not by user guesswork.

### Default routing order

1. Cheap model for simple tasks
2. Balanced model for normal work
3. Premium model only when the plan allows it
4. Frontier model only for Enterprise or explicit override

### Routing inputs

The router should consider:

- requested model or model class
- task type
- token estimate
- current org balance
- current month burn
- current gross margin forecast
- whether the org is BYOK

### Routing decisions

| Condition | Action |
|---|---|
| No allowance left | Block or require top-up |
| Burn forecast exceeds margin floor | Downgrade or block |
| BYOK enabled | Allow broader model choice |
| Premium requested on Starter | Block or require top-up |
| Balanced requested on Team | Allow |

## Metering rules

Every run must record both the estimate and the actual usage.

### Record on estimate

- org id
- user id
- provider
- model
- model class
- estimated input tokens
- estimated output tokens
- estimated credits
- estimated provider cost
- estimated margin
- routing decision

### Record on completion

- actual input tokens
- actual output tokens
- cached input tokens
- tool call count
- batch flag
- actual provider cost
- actual billable credits
- remaining balance
- request id
- run status

### Do not do this

- Do not bill raw tokens directly to customers without a model class multiplier.
- Do not allow unlimited managed usage on a fixed price plan.
- Do not let the UI display a token count as if all tokens cost the same.
- Do not rewrite historical usage when pricing changes.

## Technical spec

### Tables

Add or extend the following tables in the hosted billing layer:

- `ops_plans`
- `ops_org_subscriptions`
- `ops_plan_entitlements`
- `ops_model_rate_cards`
- `ops_credit_ledger`
- `ops_usage_events`
- `ops_usage_daily`
- `ops_routing_policies`

### Minimum fields

`ops_plans`

- `id`
- `name`
- `price_monthly_pence`
- `member_limit`
- `included_credits`
- `byok_only`
- `audit_retention_days`
- `created_at`
- `updated_at`

`ops_model_rate_cards`

- `id`
- `provider`
- `model`
- `model_class`
- `input_weight`
- `output_weight`
- `cache_weight`
- `tool_weight`
- `batch_weight`
- `active_from`
- `active_to`

`ops_credit_ledger`

- `id`
- `org_id`
- `event_type`
- `credits_delta`
- `currency_delta_pence`
- `provider`
- `model`
- `request_id`
- `created_at`

`ops_usage_events`

- `id`
- `org_id`
- `user_id`
- `provider`
- `model`
- `model_class`
- `input_tokens`
- `output_tokens`
- `cached_input_tokens`
- `tool_calls`
- `batch_jobs`
- `provider_cost_pence`
- `billable_credits`
- `estimated_credits`
- `request_id`
- `status`
- `created_at`

### API contract

Expose these endpoints from the hosted ops API:

```http
GET  /api/carina-ops/models
POST /api/carina-ops/estimate
POST /api/carina-ops/workbench/run
POST /api/carina-ops/credits/topup
GET  /api/carina-ops/usage
GET  /api/carina-ops/billing
GET  /api/carina-ops/audit
```

### Workbench flow

1. User selects provider and model class.
2. UI requests an estimate before executing.
3. Router checks plan allowance and current balance.
4. If allowed, the run executes.
5. Actual usage is written to the ledger.
6. The usage page and billing page refresh from the ledger, not from ad hoc counters.

## Recommended implementation order

### Phase 1

- Add rate cards and credit ledger tables.
- Add estimate and finalize logic.
- Add balance checks before execution.
- Add usage and cost reporting in the ops UI.

### Phase 2

- Add plan limits and top-up packs.
- Add routing by model class.
- Add premium gating.
- Add batch and cache discounts.

### Phase 3

- Add BYOK-first defaults for heavier teams.
- Add reconciler jobs against provider invoices.
- Add monthly margin reporting by org and model.

### Phase 4

- Add Enterprise plan controls.
- Add customer-facing usage alerts.
- Add admin override tools for rate cards and entitlements.

## Commercial rules

The business stays safe if all of the following are true:

- Starter and Team are capped plans
- premium models cost more credits than balanced models
- BYOK is the default path for heavier users
- provider price changes only update future rate cards
- you can block or downgrade before a call lands

If a plan cannot survive its own model mix, the answer is not to sell more volume. The answer is to change the plan, increase the price, or move the customer to BYOK.
