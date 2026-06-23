# Carina AI - Usage-Based Billing System (Cursor-Style)

**Designed for:** Carina Standalone  
**Inspiration:** Cursor IDE usage model  
**Status:** Planning & specification  
**Date:** 8 May 2026  

---

## Philosophy

The Cursor model works because it aligns incentives:

- **User:** Only pays for what they use. Can try for free. Upgrades when they hit limits. Never overpay.
- **Carina:** Predictable revenue from subscriptions. Upsell when users hit limits. On-demand purchases cover overage at premium rates.
- **Fairness:** Heavy users pay more. Light users pay less. Both get the same product.

Token-based metering also future-proofs Carina against AI provider pricing changes. If DeepSeek raises prices, we adjust token multipliers - users don't see a price change.

---

## Pricing Tiers

| Tier | Price/mo | Tokens/mo | API Calls/mo | Train My AI | BYOK | Annual/Mo | On-Demand | White-Label |
|---|---|---|---|---|---|---|---|---|---|
| **Free** | £0 | 5,000 | 100 | Failed:  | No | N/A | No | No |
| **Pro** | £20 | 50,000 | 1,000 | Failed:  | No | £15 × 12 = £180 | Yes | No |
| **Pro+** | £60 | 150,000 (3x Pro) | 3,000 | Done:  | No | £45 × 12 = £540 | Yes | No |
| **Ultra** | £100 | 250,000 (5x Pro) | 5,000 | Done:  | Yes | £75 × 12 = £900 | Yes | No |
| **Enterprise** | £200 | 500,000 | 10,000 | Done:  | Yes | N/A | Yes | Done:  |
**Annual discount:** 25% off - pay for 9 months, get 12.

### Token Valuation

One token = one character of AI output (approximate). This is Cursor's model.

| Action | Est. Tokens | Est. Cost to Carina (DeepSeek) |
|---|---|---|
| Simple Q&A ("What is BRR?") | 200-500 | £0.000028 |
| Deal analysis (full calculation + explanation) | 2,000-5,000 | £0.00028 |
| Area report (ML + LLM summary) | 8,000-15,000 | £0.0021 |
| RAG query with sources (knowledge + LLM) | 1,000-3,000 | £0.00014 |
| API call (agent query, no streaming) | 500-2,000 | £0.00028 |

**Cost to serve for Pro user:** 50,000 tokens/mo = ~£0.014 (14 pence) at DeepSeek pricing. Even at 10x margin for overage, Carina makes £20/mo on a user that costs pence.

### On-Demand Top-Up Bundles

When users exhaust their monthly token allowance before the month ends:

| Bundle | Tokens | Price | Price per 1K Tokens |
|---|---|---|---|
| Small | 5,000 | £3 | £0.60 |
| Medium | 25,000 | £12 | £0.48 |
| Large | 100,000 | £40 | £0.40 |
| Mega | 500,000 | £150 | £0.30 |

Compare to plan pricing: Pro gets 50K tokens for £20 = £0.40 per 1K. On-demand large bundle: £0.40 per 1K. Slightly more expensive than plan for small bundles, same for large.

**Rollover:** Unused tokens DO NOT roll over. This encourages upgrading rather than hoarding.

---

## Algorithm & Metering Engine

### Token Counting

```
User Action → Determine Action Type → Estimate Tokens
                                            │
                                    ┌───────┴────────┐
                                    │                 │
                            Chat/Tool Call       API Call
                                    │                 │
                                    ▼                 ▼
                        Count LLM output      Count response
                        tokens + input        tokens + overhead
                        tokens (pro-rated)
                                            │
                                            ▼
                                  Apply Provider Multiplier
                                  (DeepSeek = 1x, GPT-4 = 3x,
                                   Claude = 2.5x, etc.)
                                            │
                                            ▼
                                  Deduct from User's
                                  Token Balance
                                            │
                                            ▼
                                  Log to `usage_log`
                                  Check if hitting limit
                                  (80%, 100%) → Alert
```

**Provider Multiplier:**
| Provider | Multiplier | Why |
|---|---|---|
| DeepSeek V4 Flash | 1.0x | Baseline - cheapest |
| Groq (Llama) | 1.2x | Slightly more expensive |
| Google Gemini | 1.0x | Comparable pricing |
| Anthropic (Claude Sonnet) | 2.5x | Premium model |
| OpenAI (GPT-4o) | 2.0x | Premium model |
| OpenRouter (via proxy) | 1.5x | Moderate |

If user brings their own key (BYOK), token consumption is charged at 0.5x the normal rate (covers our overhead for RAG, infra, and ML pipeline - their key pays the LLM cost).

### Monthly Metering Window

- Metering cycle: **calendar month**. Resets on the 1st at 00:00 UTC.
- Proration: If user upgrades mid-month, they get `remaining_days / total_days × (new_tokens - old_tokens)` bonus tokens.
- Downgrade on renewal: New allowance starts next cycle.

### Hard Cap vs Soft Cap

| Tier | Cap Type | Behaviour at Limit |
|---|---|---|
| Free | Hard cap | Blocked until next cycle. Upgrade required. |
| Pro | Soft cap | Blocked unless on-demand bundle purchased. |
| Pro+ | Soft cap | Same as Pro. |
| Ultra | Soft cap | Same as Pro. |
| Enterprise | Soft cap + SLA | Can exceed with auto top-up. |

### Spending Controls

Users set a **monthly spending limit** superceding token limits:
- Default: plan token allowance
- Can set lower: "Warn me at £10/mo and cap at £15/mo"
- Enterprise: unlimited with auto-top-up set at £X/month hard cap

---

## Database Schema

```sql
-- Central DB tables

-- Active subscription per tenant
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    plan_slug VARCHAR(50) NOT NULL,       -- 'free', 'pro', 'pro_plus', 'ultra', 'enterprise'
    status VARCHAR(20) NOT NULL,           -- 'active', 'past_due', 'canceled', 'trialing'
    billing_period_start DATE NOT NULL,
    billing_period_end DATE NOT NULL,
    stripe_subscription_id VARCHAR(100),
    stripe_price_id VARCHAR(100),
    token_allowance BIGINT NOT NULL,       -- tokens allocated this period
    tokens_used BIGINT NOT NULL DEFAULT 0, -- tokens used this period
    spending_limit DECIMAL(10,2),          -- user-set cap (null = plan default)
    annual_discount BOOLEAN DEFAULT FALSE,
    byok_enabled BOOLEAN DEFAULT FALSE,
    white_label_enabled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Per-request usage log (append-only, immutable)
CREATE TABLE usage_log (
    id BIGSERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL,
    request_id UUID NOT NULL,              -- idempotency key
    action_type VARCHAR(20) NOT NULL,      -- 'chat', 'api_chat', 'api_analyze', 'api_embed', 'rag_search', 'ml_predict'
    provider_used VARCHAR(30),              -- 'deepseek', 'google', etc.
    model_used VARCHAR(50),
    input_tokens INT NOT NULL DEFAULT 0,
    output_tokens INT NOT NULL DEFAULT 0,
    tokens_charged INT NOT NULL,            -- after provider multiplier
    cost_usd DECIMAL(12,8),                -- our actual cost (for margins dashboard)
    was_byok BOOLEAN DEFAULT FALSE,
    on_demand BOOLEAN DEFAULT FALSE,        -- true if from top-up bundle
    created_at TIMESTAMP DEFAULT NOW()
);

-- Monthly rollup for dashboards (materialised or computed)
CREATE TABLE usage_rollup_monthly (
    id BIGSERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL,
    year INT NOT NULL,
    month INT NOT NULL,
    total_tokens_charged BIGINT NOT NULL,
    total_cost_usd DECIMAL(12,4),
    total_chats INT,
    total_api_calls INT,
    by_provider JSONB,                     -- { "deepseek": 50000, "google": 10000 }
    token_allowance BIGINT NOT NULL,
    top_up_tokens BIGINT NOT NULL DEFAULT 0,
    top_up_spend DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(tenant_id, year, month)
);

-- On-demand top-up bundles
CREATE TABLE top_up_purchases (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    bundle_slug VARCHAR(50) NOT NULL,       -- 'small', 'medium', 'large', 'mega'
    tokens BIGINT NOT NULL,
    amount_paid DECIMAL(10,2) NOT NULL,
    stripe_payment_intent_id VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Spending / Usage Dashboard

### User-Facing Dashboard (`/settings/usage`)

```
┌──────────────────────────────────────────────────────────────┐
│  CARINA USAGE                                    │ BYOK │  │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Current Plan: Pro                │ Change Plan  →   │   │
│  │  Billing Period: 1-31 May 2026                      │   │
│  │  Annual Discount: Active (25% off, renews 1 May 27) │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  TOKEN USAGE THIS MONTH                                      │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  ████████████████░░░░░░░░░░░░░░░░  18,450 / 50,000    │ │
│  │  37% used                             └── 31,550 left  │ │
│  │                        Estimated: 22K at current pace  │ │
│  │                        Will last: ~20 more days        │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  SPENDING                                                    │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  This month: £20.00 (plan)                              │ │
│  │  Top-ups: £0.00                                         │ │
│  │  Total: £20.00                                          │ │
│  │  Daily avg: £0.67                                       │ │
│  │                                                          │ │
│  │  ┌─Set monthly spending cap──┐                          │ │
│  │  │ £ 30.00               [Save]│                        │ │
│  │  └────────────────────────────┘                          │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  USAGE BREAKDOWN BY ACTION                                   │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Chat                              12,300 tokens  66%  │ │
│  │  API calls                          3,150 tokens  17%  │ │
│  │  ML reports                         1,800 tokens  10%  │ │
│  │  RAG searches                       1,200 tokens   7%  │ │
│  │  Total                             18,450 tokens 100%  │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  USAGE BY PROVIDER                                           │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  DeepSeek        15,000 tokens   81%      £0.02 cost   │ │
│  │  Google Gemini    3,450 tokens   19%      £0.01 cost   │ │
│  │  Total           18,450 tokens  100%      £0.03 cost   │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ON-DEMAND TOP-UPS                                           │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  [Buy Tokens]  ┌─────────────┐                         │ │
│  │                │ Small: 5K £3│                         │ │
│  │                │ Med: 25K £12│  ← recommended          │ │
│  │                │ Large: 100K │                         │ │
│  │                └─────────────┘                         │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  DAILY USAGE CHART (Last 30 days)                            │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │ │
│  │  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │ │
│  │  ░░░░░▓▓░░░░░░▓▓▓▓░░░░▓░░░░▓▓░░░░░░▓▓░░░░░░▓░░░▓░░░  │ │
│  │  └────────────────────────────────────────────────────┘ │
│  │  1   3   5   7   9  11  13  15  17  19  21  23  25     │ │
│  │  ▼ today                                                │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  API USAGE                                                    │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  API Key: (hidden; ends with …abcd)  [Revoke]  [New Key]     │ │
│  │  Calls this month: 342 / 1,000                        │ │
│  │  Avg response time: 1.2s                              │ │
│  │  Last 7 days: ▁▂▃▂▁▄▃                                  │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Admin Dashboard (Filament)

- **Real-time usage monitor** - Active users, token burn rate, provider costs
- **Cost margin report** - Revenue vs AI costs per plan/tier
- **Anomaly detection** - Sudden usage spikes, potential abuse
- **BYOK penetration** - How many users BYOK vs platform keys
- **Downgrade risk** - Users hitting 80%+ usage consistently

---

## Implementation Plan

### Phase 1: Metering Core (Week 1-2)

| Task | Detail |
|---|---|
| `usage_log` table migration | Log every AI request with token counts |
| `subscriptions` table migration | Tenant billing state, token allowance, spending cap |
| Token counting middleware | Laravel middleware: count tokens, check allowance, deduct |
| Provider multiplier config | `config/billing.php`: token multipliers per provider |
| Hard cap enforcement (Free) | Block requests when allowance exhausted |
| Usage rollup (cron) | Hourly: aggregate usage_log → `usage_rollup_monthly` |

### Phase 2: Usage Dashboard (Week 2-3)

| Task | Detail |
|---|---|
| `/settings/usage` Blade page | Token gauge, breakdown, daily chart |
| `/settings/usage/api` API consumption table | |
| `/api/v1/usage` endpoint | For mobile apps to read consumption |
| Daily usage email | "You've used 40% of your 50K tokens. 18 days left." |
| Warning notifications | At 80%, 90%, 100% - in-app + email |

### Phase 3: On-Demand Top-Ups (Week 3-4)

| Task | Detail |
|---|---|
| Stripe payment intent for bundles | Small/Medium/Large/Mega one-time purchases |
| Top-up flow UI | Modal on usage page + inline when hitting limit |
| Token balance merge | Top-up tokens added to remaining allowance |
| Receipt email | Stripe receipt + updated balance |

### Phase 4: Plan Changes & Proration (Week 4-5)

| Task | Detail |
|---|---|
| Upgrade/downgrade flow | Stripe subscription API |
| Mid-cycle proration | `remaining_days / total_days × delta_tokens` |
| Free → Paid conversion gate | Upgrade modal when free tier exhausted |
| Annual discount logic | Apply 25% discount multiplier to Stripe price |
| Cancel + grace period | 7-day grace on cancel, then read-only access + data export |

### Phase 5: BYOK & Enterprise (Week 5-6)

| Task | Detail |
|---|---|
| BYOK toggle in settings | User provides their own provider API keys |
| BYOK token multiplier | 0.5x consumption rate (covers overhead only) |
| Enterprise white-label | Custom domain, logo, branding in chat UI |
| Enterprise spending cap | Admin-set monthly limit per seat |
| Enterprise usage API | Tenant admin can pull usage for all seats |

### Phase 6: Spending Controls & Alerts (Week 6-7)

| Task | Detail |
|---|---|
| Monthly spending limit | User-set cap in dashboard |
| Real-time budget tracking | Check spending cap before each request |
| Alert channels | Email, in-app, optionally WhatsApp/Telegram |
| Auto-top-up (Enterprise) | Pre-approved payment for overflow |

---

## File Structure

```
app/
├── Billing/
│   ├── TokenMeter.php              # Core token counting + deduction
│   ├── TokenCalculator.php         # Estimate tokens for action types
│   ├── ProviderMultiplier.php      # Multiplier config per provider
│   ├── PlanAllocation.php          # Token allowance by plan
│   ├── TopUpService.php            # On-demand bundle purchases
│   ├── ProrationService.php        # Mid-cycle upgrade/downgrade calc
│   ├── SpendingLimitService.php    # User-set spending caps
│   ├── AnnualDiscountService.php   # 25% annual discount logic
│   └── Contracts/
│       └── BillingMeterInterface.php
├── Http/
│   ├── Controllers/
│   │   ├── Api/
│   │   │   └── UsageController.php       # GET /api/v1/usage
│   │   └── Web/
│   │       ├── BillingController.php      # Plan management
│   │       ├── UsageDashboardController.php
│   │       └── TopUpController.php
│   └── Middleware/
│       └── TokenMeteringMiddleware.php    # Per-request token check
├── Jobs/
│   ├── RollupHourlyUsage.php
│   └── SendUsageAlert.php
├── Models/
│   ├── Subscription.php
│   ├── UsageLog.php
│   └── TopUpPurchase.php
├── Console/
│   └── Commands/
│       ├── billing:reset-monthly-allowances
│       ├── billing:send-warnings
│       └── billing:expire-top-ups
└── Filament/
    └── Resources/
        ├── SubscriptionResource.php      # Admin: manage plans
        ├── UsageLogResource.php          # Admin: inspect usage
        └── BillingDashboard.php          # Admin: revenue + margins
```

---

## API Endpoints (User-Facing)

### Usage & Billing

```http
GET /api/v1/billing/usage
→ { "period": { "start": "2026-05-01", "end": "2026-05-31" },
    "plan": "pro",
    "token_allowance": 50000,
    "tokens_used": 18450,
    "tokens_remaining": 31550,
    "spending": { "plan": 20.00, "top_ups": 0, "total": 20.00 },
    "daily_avg": 0.67,
    "estimated_days_remaining": 20,
    "by_provider": { "deepseek": 15000, "google": 3450 }
  }

GET /api/v1/billing/history?from=2026-04-01&to=2026-05-08
→ { "entries": [ { "date": "2026-05-01", "tokens": 1200, "provider": "deepseek" }, ... ] }

POST /api/v1/billing/top-up
{ "bundle": "medium" }
→ { "purchase_id": "uuid", "tokens_added": 25000, "total_remaining": 56550, "amount_paid": 12.00 }

POST /api/v1/billing/spending-cap
{ "monthly_limit": 30.00 }
→ { "limit": 30.00, "current": 20.00 }

GET /api/v1/billing/plans
→ { "plans": [ { "slug": "free", "name": "Free", "price": 0, "tokens": 5000, "api_calls": 100 }, ... ] }

POST /api/v1/billing/change-plan
{ "plan": "ultra", "annual": true }
→ { "new_plan": "ultra", "annual": true, "prorated_credit": 5.50, "next_billing": "2026-06-01", "token_adjustment": 200000 }

GET /api/v1/billing/byok
→ { "enabled": false, "token_multiplier": 0.5 }

PUT /api/v1/billing/byok
{ "enabled": true, "provider": "deepseek", "api_key": "sk-..." }
→ { "enabled": true, "token_multiplier": 0.5 }
```

---

## Key Constants (config/billing.php)

```php
<?php

return [
    'plans' => [
        'free' => [
            'name' => 'Free',
            'price_gbp' => 0,
            'tokens_per_month' => 5_000,
            'api_calls_per_month' => 100,
            'byok_allowed' => false,
            'white_label' => false,
            'hard_cap' => true,
            'train_ai_allowed' => false,
        ],
        'pro' => [
            'name' => 'Pro',
            'price_gbp' => 20,
            'tokens_per_month' => 50_000,
            'api_calls_per_month' => 1_000,
            'byok_allowed' => false,
            'white_label' => false,
            'hard_cap' => false,
            'train_ai_allowed' => false,
        ],
        'pro_plus' => [
            'name' => 'Pro+',
            'price_gbp' => 60,
            'tokens_per_month' => 150_000,
            'api_calls_per_month' => 3_000,
            'byok_allowed' => false,
            'white_label' => false,
            'hard_cap' => false,
            'train_ai_allowed' => true,
        ],
        'ultra' => [
            'name' => 'Ultra',
            'price_gbp' => 100,
            'tokens_per_month' => 250_000,
            'api_calls_per_month' => 5_000,
            'byok_allowed' => true,
            'white_label' => false,
            'hard_cap' => false,
            'train_ai_allowed' => true,
        ],
        'enterprise' => [
            'name' => 'Enterprise',
            'price_gbp' => 200,
            'tokens_per_month' => 500_000,
            'api_calls_per_month' => 10_000,
            'byok_allowed' => true,
            'white_label' => true,
            'hard_cap' => false,
            'train_ai_allowed' => true,
        ],
    ],

    'annual_discount_percent' => 25,

    'top_up_bundles' => [
        'small' => ['tokens' => 5_000, 'price_gbp' => 3],
        'medium' => ['tokens' => 25_000, 'price_gbp' => 12],
        'large' => ['tokens' => 100_000, 'price_gbp' => 40],
        'mega' => ['tokens' => 500_000, 'price_gbp' => 150],
    ],

    // Token multipliers per AI provider
    'provider_multipliers' => [
        'deepseek' => 1.0,
        'groq' => 1.2,
        'google' => 1.0,
        'anthropic' => 2.5,
        'openai' => 2.0,
        'openrouter' => 1.5,
    ],

    // When user provides own key
    'byok_token_multiplier' => 0.5,

    // Warning thresholds (percent of allowance used)
    'warning_thresholds' => [50, 80, 90, 100],

    // Grace period after cancellation (days)
    'cancellation_grace_days' => 7,
];
```

---

## Economics & Margins

| Tier | Price | Token Allowance | Est. Cost to Serve | Gross Margin | On-Demand Revenue Potential |
|---|---|---|---|---|---|
| Free | £0 | 5K | ~£0.001 | -£0.001 | N/A - conversion funnel |
| Pro | £20 | 50K | ~£0.014 | **~99.9%** | Up to £15/mo extra (1-2 bundles) |
| Pro+ | £60 | 150K | ~£0.042 | **~99.9%** | Up to £40/mo extra (1 large bundle) |
| Ultra | £100 | 250K | ~£0.07 | **~99.9%** | Up to £40/mo extra (1 bundle) |
| Enterprise | £200 | 500K | ~£0.14 | **~99.9%** | 80%+ of plans auto-top-up |

**Key insight:** AI API costs are so low (DeepSeek: £0.14/M input tokens) that the token allowance system is not about cost recovery - it's about **fair usage gating**. A single heavy user consuming 10M tokens/mo costs only £1.40 in AI API costs but chews up capacity. The token system ensures heavy users pay proportionally.

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Users game the system (e.g., single user, multiple free accounts) | Phone verification + IP tracking on free tier. Minimum 5K token free allowance is too small to abuse meaningfully. |
| Provider multiplier changes upset users | Published transparently. Tied to actual provider cost changes. Users can BYOK to bypass. |
| Token counting inconsistencies | Count both input + output tokens. Round up. Log raw + charged tokens separately for audit. |
| Annual discount cannibalises revenue | 25% off for 12-month commitment. Improves retention, reduces churn. LTV increases. |
| Users hit limits and churn | Soft cap + on-demand bundles keep users spending instead of leaving. Spending cap prevents bill shock. |
