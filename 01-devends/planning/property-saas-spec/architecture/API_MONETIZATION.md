# Carina AI - API Monetization

**How third-party developers and companies pay to use Carina's intelligence.**

---

## The Opportunity

Carina's API lets any property application embed property intelligence. The API is the product - developers don't need the Carina UI to get value. This unlocks customers who:

- Already have a CRM and just want AI on top (no UI needed)
- Build their own property software and want Carina as the brain
- Want to automate property analysis in their backend workflows
- Need property intelligence in their mobile app without building it themselves

**Revenue from API can exceed UI subscription revenue.** Cursor makes more from API usage than from desktop subscriptions. Same model.

---

## Pricing Models

### Model 1: Token-Based (Integrated with Plans)

Simplest. API calls consume tokens from the same pool as chat. One balance, one billing system.

| Tier | Price/mo | Tokens | API Rate Limit | Best For |
|---|---|---|---|---|
| Free | £0 | 5K | 10 req/min | Testing, prototypes |
| Pro | £20 | 50K | 60 req/min | Solo developers, small apps |
| Pro+ | £60 | 150K | 120 req/min | Growing apps, moderate usage |
| Ultra | £100 | 250K | 300 req/min | Production apps |
| Enterprise | £200+ | 500K+ | Custom | High-volume, white-label |

**Token cost per API action:**

| API Endpoint | Tokens per Call | Cost at Pro Tier |
|---|---|---|
| `POST /v1/chat` | 100-500 (input) + output tokens | ~£0.0002 per chat |
| `POST /v1/chat/stream` | Same as chat + streaming overhead | ~£0.0003 per stream |
| `POST /v1/query` (RAG-only) | 50-100 (fixed, no LLM call) | ~£0.00004 per query |
| `POST /v1/knowledge/upload` | 500 per MB | ~£0.0002 per upload |
| `GET /v1/knowledge/search` | 50 | ~£0.00002 per search |
| `POST /v1/analyze/deal` | 2,000-5,000 (calculator + LLM) | ~£0.002 per analysis |
| `POST /v1/analyze/area` | 3,000-8,000 (data API + LLM) | ~£0.003 per report |
| `POST /v1/images/generate` | 2,500 (DALL-E 3) | ~£0.001 per image |
| `POST /v1/agent/chat` | Same as chat + tool result context | ~£0.0003 per turn |

### Model 2: API-Only Plans (No UI Access)

For developers who never log into the Carina web app. Cheaper because no UI infrastructure cost.

| Plan | Price/mo | Tokens | Rate Limit | API Keys | Best For |
|---|---|---|---|---|---|
| API Starter | £49/mo | 100K | 120 req/min | 2 | Solo dev, prototype |
| API Pro | £199/mo | 500K | 500 req/min | 5 | Production app |
| API Scale | £499/mo | 2M | 2,000 req/min | 20 | High-volume app |
| API Enterprise | £999/mo+ | 10M+ | Custom | Unlimited | Large platform |

**Why API-only is cheaper to serve:** No web UI, no PWA, no conversation storage, no community features, no document upload storage. Pure API throughput. Higher margin.

### Model 3: Per-Call (No Commitment)

Pay as you go. No monthly fee. For sporadic usage, prototypes, testing.

| Endpoint | Price per Call | Minimum Purchase |
|---|---|---|
| Chat (simple Q&A) | £0.001 | £10 |
| Chat (streaming) | £0.002 | £10 |
| Deal analysis | £0.01 | £10 |
| Area report | £0.02 | £10 |
| RAG query | £0.0005 | £10 |
| Image generation | £0.02 | £10 |

**Implementation:** Pre-pay credits. Buy £10, £50, £200. Credits never expire. Deduct per call.

### Model 4: Agent Bridge (For Connected Apps)

Special pricing for external agents (Propreneur, Loom, third-party) that call Carina for intelligence while executing actions locally.

| Agent Plan | Price/mo | Intelligence Calls | Connected Apps | Best For |
|---|---|---|---|---|
| Single Agent | £29/mo | 5,000 | 1 | One app |
| Multi Agent | £99/mo | 25,000 | 5 | Multiple apps |
| Agent Network | £299/mo | 100,000 | Unlimited | Platform with many integrations |

**Agent calls cost less because:** No UI, no conversation storage, no document management. Pure question → answer pipelining.

### Model 5: White-Label API (Resell Carina)

Companies resell Carina's API under their own brand. They pay wholesale, charge their customers retail.

| Tier | Price/mo | Calls Included | Overage | Min Commitment |
|---|---|---|---|---|
| White-Label Starter | £499/mo | 50,000 | £0.005/call | 6 months |
| White-Label Growth | £1,499/mo | 200,000 | £0.003/call | 12 months |
| White-Label Scale | £4,999/mo | 1,000,000 | £0.002/call | 12 months |

**What white-label includes:** Custom branding on API responses. Custom rate limits. Dedicated infrastructure (optional). Support SLA. Usage dashboard for their customers.

---

## Implementation: API Metering

Token metering works the same across all models. One system, multiple pricing overlays:

```php
class ApiMeteringService
{
    public function chargeForRequest(Request $request, array $response): void
    {
        $user = $request->user();
        $tokens = $this->calculateTokens($request, $response);
        
        match ($user->billing_model) {
            'plan_included' => $this->deductFromPlanAllowance($user, $tokens),
            'api_only' => $this->deductFromApiAllowance($user, $tokens),
            'per_call' => $this->deductFromPrepaidCredits($user, $tokens),
            'agent_bridge' => $this->deductFromAgentAllowance($user, $tokens),
            'white_label' => $this->deductFromWholesaleAllowance($user, $tokens),
        };
        
        $this->logUsage($user, $tokens, $request, $response);
    }
}
```

---

## Revenue Projection (API-Only)

| Year | API Customers | Avg Rev/Customer/mo | Annual API Revenue |
|---|---|---|---|
| 1 | 20 | £150 | £36,000 |
| 2 | 100 | £200 | £240,000 |
| 3 | 500 | £250 | £1,500,000 |
| 4 | 2,000 | £300 | £7,200,000 |
| 5 | 5,000 | £350 | £21,000,000 |

**Combined with UI subscription revenue:** £34M+ ARR by Year 5.

---

## Rate Limiting by Model

| Model | Default Limit | Burst | Can Increase? |
|---|---|---|---|
| Free (plan) | 10 req/min | 20 | Upgrade plan |
| Pro (plan) | 60 req/min | 100 | Upgrade plan |
| API Starter | 120 req/min | 200 | Yes (+£10 per 100 req/min) |
| API Pro | 500 req/min | 1,000 | Yes (+£10 per 200 req/min) |
| API Scale | 2,000 req/min | 5,000 | Yes (+£5 per 500 req/min) |
| White-Label | Custom | Custom | Included |
| Per-Call | 30 req/min | 50 | Pre-pay higher tier |

---

## Files

```php
// config/api-billing.php
return [
    'models' => [
        'plan_included' => [
            'name' => 'Included in Plan',
            'description' => 'API usage deducted from your plan token allowance.',
        ],
        'api_only' => [
            'name' => 'API Only',
            'plans' => [
                'api_starter' => ['price' => 49, 'tokens' => 100_000, 'rate_limit' => 120],
                'api_pro' => ['price' => 199, 'tokens' => 500_000, 'rate_limit' => 500],
                'api_scale' => ['price' => 499, 'tokens' => 2_000_000, 'rate_limit' => 2000],
                'api_enterprise' => ['price' => 999, 'tokens' => 10_000_000, 'rate_limit' => 'custom'],
            ],
        ],
        'per_call' => [
            'name' => 'Pay As You Go',
            'minimum_top_up' => 10, // £
            'top_up_options' => [10, 50, 200, 500],
            'pricing' => [
                'chat' => 0.001,
                'chat_stream' => 0.002,
                'deal_analysis' => 0.01,
                'area_report' => 0.02,
                'rag_query' => 0.0005,
                'image_generate' => 0.02,
            ],
        ],
        'agent_bridge' => [
            'name' => 'Agent Bridge',
            'plans' => [
                'single_agent' => ['price' => 29, 'calls' => 5_000, 'apps' => 1],
                'multi_agent' => ['price' => 99, 'calls' => 25_000, 'apps' => 5],
                'agent_network' => ['price' => 299, 'calls' => 100_000, 'apps' => 'unlimited'],
            ],
        ],
        'white_label' => [
            'name' => 'White Label',
            'plans' => [
                'wl_starter' => ['price' => 499, 'calls' => 50_000, 'overage' => 0.005],
                'wl_growth' => ['price' => 1499, 'calls' => 200_000, 'overage' => 0.003],
                'wl_scale' => ['price' => 4999, 'calls' => 1_000_000, 'overage' => 0.002],
            ],
        ],
    ],
];
```
