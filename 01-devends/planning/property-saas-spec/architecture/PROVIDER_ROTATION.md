# Carina AI - Rotating API Provider Architecture

**Providers:** Anthropic · OpenAI · DeepSeek  
**Model:** Rotating usage (not just fallback)  
**Why:** Redundancy, cost optimisation, reliability, vendor independence  

---

## The Rotation Model

Instead of a linear fallback chain (try A, then B, then C), Carina uses a **smart rotation** strategy:

```
          ┌─────────────┐
          │  User Request │
          └──────┬──────┘
                 ▼
        ┌────────────────┐
        │  Router decides │
        │  which provider │
        └──┬──┬──┬──┬────┘
           │  │  │  │
     ┌─────┘  │  │  └──────────┐
     ▼        ▼  ▼             ▼
 ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐
 │Anthropic│ │OpenAI│ │DeepSeek│ │Next…│
 └──────┘ └──────┘ └──────┘ └──────┘
```

### Rotation Strategies

| Strategy | Behaviour | When Used |
|---|---|---|
| **Round-robin** | A → B → C → A → B → C | Normal operation. Evenly distributes load. |
| **Cost-priority** | Cheapest first. Overflow to next when rate-limited. | Default. DeepSeek → OpenAI → Anthropic. |
| **Capability-priority** | Best model for the job. Complex analysis → Anthropic. Simple Q&A → DeepSeek. | When task requires specific capability (tool use, reasoning, speed). |
| **Health-based** | Check provider health. Skip unhealthy ones. Route to healthy. | Continuous health checking. |
| **User-preference** | User chooses preferred provider in settings. | BYOK or user explicitly selects. |

### Provider Profiles

| Provider | Models | Strengths | Weaknesses | Cost/M Tokens (Input) |
|---|---|---|---|---|
| **Anthropic** | Claude Sonnet 4, Claude Haiku 3.5 | Best tool use (native `tool_use` blocks), best reasoning, safe, reliable | Most expensive, slower | £15.00 |
| **OpenAI** | GPT-4o, GPT-4o-mini | Fast, widely compatible, good function calling, streaming | Expensive at GPT-4o tier | £2.50 (GPT-4o-mini) / £15.00 (GPT-4o) |
| **DeepSeek** | DeepSeek V4 Flash | Cheapest by far, fast, good reasoning, supports function calling | Less reliable tool use, occasional API instability, Chinese API | £0.14 |

---

## Smart Router Algorithm

```php
class ProviderRouter
{
    public function selectProvider(array $context): string
    {
        // 1. BYOK overrides everything
        if ($context['byok_provider'] ?? null) {
            return $context['byok_provider'];
        }

        // 2. User preference (if set in settings)
        if ($context['user_preference'] ?? null) {
            return $context['user_preference'];
        }

        // 3. Check health - remove unhealthy providers
        $healthy = array_filter(
            $this->providers,
            fn ($p) => $this->healthCheck->isHealthy($p)
        );

        if (empty($healthy)) {
            // All unhealthy - try any (emergency mode)
            return $this->providers[array_rand($this->providers)];
        }

        // 4. Pick strategy based on context
        return $this->{$context['strategy'] ?? 'costPriority'}($healthy, $context);
    }

    private function costPriority(array $healthy, array $context): string
    {
        // DeepSeek → OpenAI → Anthropic
        $order = ['deepseek', 'openai_gpt4o_mini', 'openai_gpt4o', 'anthropic'];

        foreach ($order as $provider) {
            if (in_array($provider, $healthy)) {
                return $provider;
            }
        }

        return $healthy[array_key_first($healthy)];
    }

    private function roundRobin(array $healthy, array $context): string
    {
        $this->counter ??= 0;
        $keys = array_keys($healthy);
        $selected = $keys[$this->counter % count($keys)];
        $this->counter++;

        return $selected;
    }

    private function capabilityPriority(array $healthy, array $context): string
    {
        $taskType = $context['task_type'] ?? 'chat';

        return match ($taskType) {
            'tool_call', 'reasoning', 'analysis' => $this->firstHealthy($healthy, ['anthropic', 'openai_gpt4o', 'deepseek']),
            'chat', 'qa' => $this->firstHealthy($healthy, ['deepseek', 'openai_gpt4o_mini', 'anthropic']),
            'streaming' => $this->firstHealthy($healthy, ['deepseek', 'openai_gpt4o_mini', 'openai_gpt4o', 'anthropic']),
            'embedding' => 'google',  // Only Google Gemini for embeddings
            default => $this->costPriority($healthy, $context),
        };
    }
}
```

### Task-to-Provider Mapping

| Task | Recommended Provider | Why |
|---|---|---|
| Simple Q&A ("What is BRR?") | DeepSeek | Cheapest. Good enough for factual answers. |
| Complex reasoning ("Analyse this portfolio risk") | Anthropic / OpenAI GPT-4o | Best reasoning. More reliable for complex analysis. |
| Tool calling ("Create a contact, run calculator") | Anthropic | Native `tool_use` blocks. Most reliable tool execution. |
| Streaming chat | DeepSeek / OpenAI | Fast streaming. Cheaper. |
| Document analysis (large context) | Anthropic (100K+ context) | Best long-context handling. |
| Code generation | Claude / GPT-4o | Best at code. |
| Embeddings | Google Gemini | Only provider used. Cheapest embedding. £0.01/1M tokens. |
| Fast response needed | DeepSeek / GPT-4o-mini | Lowest latency. |

---

## Provider Health Checking

Continuous health monitoring prevents routing to degraded providers:

```php
class ProviderHealthCheck
{
    private const CHECK_INTERVAL = 60; // seconds
    private const TIMEOUT = 5; // seconds
    private const FAILURE_THRESHOLD = 3; // consecutive failures = unhealthy

    public function isHealthy(string $provider): bool
    {
        $status = Cache::get("provider_health:{$provider}");

        if (!$status || $status['checked_at'] < now()->subSeconds(self::CHECK_INTERVAL)) {
            $status = $this->checkNow($provider);
        }

        return $status['healthy'];
    }

    private function checkNow(string $provider): array
    {
        $start = microtime(true);

        try {
            // Send a minimal ping to the provider
            $response = Http::timeout(self::TIMEOUT)->post(
                $this->endpoint($provider),
                $this->pingPayload($provider)
            );

            $latency = (microtime(true) - $start) * 1000;

            $status = [
                'healthy' => $response->successful(),
                'latency_ms' => round($latency, 0),
                'checked_at' => now(),
            ];
        } catch (\Throwable $e) {
            $status = [
                'healthy' => false,
                'error' => $e->getMessage(),
                'checked_at' => now(),
            ];
        }

        // Track consecutive failures
        $failures = Cache::increment("provider_failures:{$provider}");
        if ($status['healthy']) {
            Cache::forget("provider_failures:{$provider}");
        } elseif ($failures >= self::FAILURE_THRESHOLD) {
            $status['healthy'] = false;
        }

        Cache::put("provider_health:{$provider}", $status, self::CHECK_INTERVAL + 10);

        return $status;
    }
}
```

### Health Dashboard

Admin UI showing:

```
┌──────────────────────────────────────────────────────────────┐
│  PROVIDER HEALTH                                    │ Auto │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────┬──────────┬─────────┬────────┬───────┐       │
│  │ Provider   │ Status   │ Latency │ Uptime │ Load  │       │
│  ├────────────┼──────────┼─────────┼────────┼───────┤       │
│  │ Anthropic  │  Live  │ 1,245ms │ 99.8%  │ 42%   │       │
│  │ OpenAI     │  Live  │   892ms │ 99.9%  │ 38%   │       │
│  │ DeepSeek   │  Slow  │ 3,402ms │ 97.2%  │ 68%   │       │
│  │ Google     │  Live  │   312ms │ 100%   │ 12%   │       │
│  └────────────┴──────────┴─────────┴────────┴───────┘       │
│                                                              │
│  Errors (last 24h): Anthropic 0, OpenAI 2, DeepSeek 14      │
│  Cost today: Anthropic £12.40, OpenAI £8.20, DeepSeek £1.15  │
│  Total today: £21.75 / Budget: £200/mo (10.9%)              │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## Usage Tracking Per Provider (Token Counts)

Every request logs which provider served it. This powers:

1. **Cost tracking** - Know exactly how much each provider costs per tenant.
2. **Provider weighting** - Automatically shift traffic to cheaper providers when budget is tight.
3. **Billing (BYOK)** - Provider used determines token multiplier.
4. **Provider performance** - Latency, error rate, token throughput per provider.

```php
// Logged per request
[
    'provider_used' => 'deepseek',
    'model_used' => 'deepseek-v4-flash',
    'model_display' => 'DeepSeek V4 Flash',
    'input_tokens' => 245,
    'output_tokens' => 890,
    'tokens_charged' => 1135,  // after multiplier
    'cost_usd' => 0.000158,     // actual cost to us
    'latency_ms' => 2340,
]
```

### Provider Model Mapping

| Provider | Model Slug | Display Name | Input Cost/M | Output Cost/M | Token Multiplier |
|---|---|---|---|---|---|
| DeepSeek | `deepseek-v4-flash` | DeepSeek V4 Flash | £0.14 | £0.28 | 1.0x |
| OpenAI | `gpt-4o-mini` | GPT-4o Mini | £2.50 | £10.00 | 2.0x |
| OpenAI | `gpt-4o` | GPT-4o | £15.00 | £60.00 | 3.0x |
| Anthropic | `claude-sonnet-4-6` | Claude Sonnet 4 | £15.00 | £75.00 | 3.5x |
| Anthropic | `claude-haiku-3-5` | Claude Haiku 3.5 | £8.00 | £40.00 | 2.5x |

---

## Budget-Aware Routing

Carina has a **monthly AI budget** across all tenants (or per-tenant for Enterprise). The router checks remaining budget and adjusts provider selection:

```php
class BudgetAwareRouter
{
    private const MONTHLY_BUDGET = 2000; // £2,000 total AI budget
    private const WARNING_THRESHOLD = 0.8; // 80% of budget used

    public function selectProvider(array $context): string
    {
        $budgetUsed = Cache::get('monthly_ai_cost', 0);
        $budgetRemaining = self::MONTHLY_BUDGET - $budgetUsed;
        $usageRatio = $budgetUsed / self::MONTHLY_BUDGET;

        // Early in month - use best providers
        if ($usageRatio < 0.4) {
            return $this->qualityFirst($context);
        }

        // Mid-month - balance cost and quality
        if ($usageRatio < 0.7) {
            return $this->balanced($context);
        }

        // Late month / near budget - cheapest only
        return $this->costPriority($context);
    }
}
```

---

## Cost Comparison

| Monthly Volume | DeepSeek Only | OpenAI Only (4o-mini) | Anthropic Only | Rotating (Smart) |
|---|---|---|---|---|
| 500K tokens | **£0.07** | £1.25 | £7.50 | **£0.50** |
| 5M tokens | **£0.70** | £12.50 | £75.00 | **£5.00** |
| 50M tokens | **£7.00** | £125.00 | £750.00 | **£50.00** |
| 500M tokens | **£70.00** | £1,250.00 | £7,500.00 | **£500.00** |

**Rotating strategy:** 70% DeepSeek (simple tasks), 20% OpenAI (medium tasks), 10% Anthropic (complex reasoning). Results in ~7x DeepSeek cost.

---

## Implementation

### Files

```
app/Services/Carina/
├── ProviderRouter.php           # Smart routing logic
├── ProviderHealthCheck.php      # Continuous health monitoring
├── ProviderCostTracker.php      # Budget tracking per provider
├── ProviderMultiplier.php       # Token multiplier per provider
└── Config/
    └── provider-models.php      # Model definitions, costs, capabilities
```

### Configuration

```php
// config/ai.php additions
'providers' => [
    'deepseek' => [
        'api_key' => env('DEEPSEEK_API_KEY'),
        'base_url' => env('DEEPSEEK_BASE_URL', 'https://api.deepseek.com/v1'),
        'model' => env('DEEPSEEK_MODEL', 'deepseek-v4-flash'),
        'max_tokens' => 8192,
        'cost_per_m_input' => 0.14,  // £
        'cost_per_m_output' => 0.28,
        'token_multiplier' => 1.0,
        'supported_tasks' => ['chat', 'qa', 'streaming', 'tool_call'],
    ],
    'openai' => [
        'api_key' => env('OPENAI_API_KEY'),
        'base_url' => env('OPENAI_BASE_URL', 'https://api.openai.com/v1'),
        'models' => [
            'gpt-4o-mini' => [
                'cost_per_m_input' => 2.50,
                'cost_per_m_output' => 10.00,
                'token_multiplier' => 2.0,
                'default' => true,
            ],
            'gpt-4o' => [
                'cost_per_m_input' => 15.00,
                'cost_per_m_output' => 60.00,
                'token_multiplier' => 3.0,
                'default' => false,
            ],
        ],
        'supported_tasks' => ['chat', 'qa', 'streaming', 'tool_call', 'code'],
    ],
    'anthropic' => [
        'api_key' => env('ANTHROPIC_API_KEY'),
        'base_url' => env('ANTHROPIC_BASE_URL', 'https://api.anthropic.com/v1'),
        'models' => [
            'claude-sonnet-4-6' => [
                'cost_per_m_input' => 15.00,
                'cost_per_m_output' => 75.00,
                'token_multiplier' => 3.5,
                'default' => true,
            ],
            'claude-haiku-3-5' => [
                'cost_per_m_input' => 8.00,
                'cost_per_m_output' => 40.00,
                'token_multiplier' => 2.5,
                'default' => false,
            ],
        ],
        'supported_tasks' => ['chat', 'qa', 'tool_call', 'reasoning', 'analysis', 'documents'],
    ],
],

'rotation' => [
    'default_strategy' => 'cost_priority',  // cost_priority | round_robin | capability | user_preference
    'health_check_interval' => 60,           // seconds
    'failure_threshold' => 3,               // consecutive failures before marking unhealthy
    'monthly_budget_gbp' => 2000,
    'task_mapping' => [
        'simple_qa' => 'deepseek',
        'chat' => 'deepseek',
        'streaming' => 'deepseek',
        'tool_call' => 'anthropic',        // best tool use
        'reasoning' => 'anthropic',
        'analysis' => 'anthropic',
        'code' => 'openai',
        'documents' => 'anthropic',
        'embedding' => 'google',           // only google for embeddings
    ],
],
```

---

## Key Benefits

1. **Zero downtime** - If one provider goes down, traffic automatically shifts to the others.
2. **Cost optimisation** - 70% of traffic goes to DeepSeek (£0.14/M). Only complex tasks use expensive providers.
3. **Vendor independence** - No single provider lock-in. Switch providers overnight if needed.
4. **BYOK compatibility** - Users bring their own Anthropic/OpenAI/DeepSeek key. Router uses their key for their traffic.
5. **Performance** - Health monitoring ensures slow providers are deprioritised.
6. **Scale** - Multiple providers share the load. No single provider bottleneck.
7. **Token metering** - Provider multiplier ensures fair billing regardless of which provider served the request.
