# Carina AI — Resilience & Failure Mode Architecture

**What happens when everything breaks? Carina keeps working.**

---

## Failure Points & Degradation Model

Carina depends on multiple external services. Each can fail. The system is designed to **degrade gracefully** — never a hard failure.

```
Normal: Carina has full capabilities
           │
Failures happen (one or more):
           │
           ├── AI providers down
           ├── Data APIs down
           ├── Database degraded
           ├── Redis unavailable
           └── Network partition
           │
           ▼
Degraded: Carina answers from what she has
           │
Even if everything fails:
           │
           ▼
Survival: Carina still responds with last-known knowledge
          (no tool calls, no live data, but she still answers)
```

---

## Failure Mode Matrix

| What Fails | User Sees | Carina Does | Impact |
|---|---|---|---|
| **DeepSeek** (primary provider) | No delay | Auto-failover to OpenAI within 1 second | None |
| **OpenAI** (secondary) | No delay | Auto-failover to Anthropic | None |
| **All AI providers** | Slower, less capable | Use local fallback model (tiny on-device LM) or queue + retry | Reduced quality, no tool calls |
| **PropertyData** | "Using cached data from [date]" | Return cached RAG data with freshness notice | Stale data, still answers |
| **Tavily** | "No recent news available" | Skip web search, answer from RAG only | No current news |
| **EPC API** | "Using estimated EPC" | Return estimated rating from area averages | Approximate data |
| **PostgreSQL** | None | Connection pool retry, failover to replica | Brief pause |
| **Redis** | None | Graceful fallback to file cache / in-memory array | Slightly slower |
| **Meilisearch** | Slower search | Fallback to PostgreSQL full-text search | Slower, still works |
| **VPS (single node)** | 5-15 min downtime | Docker restart policy, auto-recovery | Brief outage |
| **Carina's RAG** (empty/corrupt) | Still answers | Chat from base knowledge + trained persona only | No personalised answers |

---

## Strategy 1: AI Provider Fallback Chain (Already Built)

Carina never depends on a single AI provider. The rotating router handles this.

```
Request comes in
    │
    ▼
┌──────────────────┐
│ 1. DeepSeek      │──► Success → Return
│    (primary)     │
└──────┬───────────┘
       │ (fails: timeout, 500, rate limit, degraded)
       ▼
┌──────────────────┐
│ 2. OpenAI        │──► Success → Return
│    (GPT-4o-mini) │
└──────┬───────────┘
       │ (fails)
       ▼
┌──────────────────┐
│ 3. Anthropic     │──► Success → Return
│    (Claude Haiku)│
└──────┬───────────┘
       │ (fails)
       ▼
┌──────────────────┐
│ 4. All failed    │
│    └─ Queue job for retry
│    └─ Return degraded response
│    └─ Notify ops team
└──────────────────┘
```

### Circuit Breaker

If a provider fails 3 times in 60 seconds, stop trying it for 5 minutes. Re-check periodically.

```php
class ProviderCircuitBreaker
{
    public function isOpen(string $provider): bool
    {
        $failures = Cache::get("provider_failures:{$provider}", 0);
        $lastFailure = Cache::get("provider_last_fail:{$provider}");

        if ($failures >= 3 && $lastFailure > now()->subMinutes(5)) {
            return true; // Circuit is OPEN — skip this provider
        }

        // Half-open after 5 minutes — allow one trial request
        if ($failures >= 3 && $lastFailure < now()->subMinutes(5)) {
            Cache::forget("provider_failures:{$provider}");
            return false; // Allow trial
        }

        return false; // Circuit is CLOSED — normal operation
    }

    public function recordFailure(string $provider): void
    {
        Cache::increment("provider_failures:{$provider}");
        Cache::put("provider_last_fail:{$provider}", now(), 3600);
    }
}
```

### Retry with Exponential Backoff

```
Attempt 1: fail → wait 1 second
Attempt 2: fail → wait 2 seconds
Attempt 3: fail → wait 4 seconds
Attempt 4: circuit breaker opens → try different provider
```

---

## Strategy 2: Data API Graceful Degradation

When PropertyData, Tavily, or EPC APIs fail, Carina never shows an error. She shows what she has.

```php
class ResilientDataService
{
    public function getAreaData(string $postcode): array
    {
        try {
            return $this->propertyData->fetch($postcode);
        } catch (Throwable $e) {
            // Data API failed. Try cache.
            $cached = Cache::get("area:{$postcode}");
            if ($cached) {
                return [
                    'data' => $cached,
                    'warning' => 'Using data from ' . $cached['fetched_at']->diffForHumans() . '. Live data temporarily unavailable.',
                    'from_cache' => true,
                ];
            }

            // No cache either. Use estimated data.
            return [
                'data' => $this->estimateAreaData($postcode),
                'warning' => 'Live data unavailable. Showing estimated values based on regional averages.',
                'estimated' => true,
            ];
        }
    }

    private function estimateAreaData(string $postcode): array
    {
        // Return approximate data based on broader regional averages
        // Better than showing an error
        $region = $this->regionFromPostcode($postcode);
        return $this->regionalAverages[$region] ?? [];
    }
}
```

### What the User Sees

| Scenario | Carina Says |
|---|---|
| **Normal** | "The average yield in Birmingham B1 is 5.8%." |
| **PropertyData down, cache available** | "Based on data from 2 days ago, the average yield in B1 is 5.8%. Live data is temporarily unavailable." |
| **PropertyData down, no cache** | "Based on regional averages for Birmingham, the estimated yield is approximately 5.5-6.0%. For exact figures, try again later." |

**The user never sees an error page, a 500 status, or "Service unavailable."**

---

## Strategy 3: RAG-First with Stale Data Tolerance

Carina's RAG stores analysed data permanently. She uses it even if it's past the "fresh" threshold.

```
Freshness thresholds:
                     │
  ┌──────────────────┼──────────────────┬────►
  │                  │                  │
Fresh              Stale              Expired
(returns as-is)    (returns with      (returns with
                   freshness note)    stale data + retry)
```

| Data Type | Fresh | Stale | Expired |
|---|---|---|---|
| Area metrics | 0-7 days | 7-30 days | 30+ days |
| Sold prices | 0-30 days | 30-90 days | 90+ days |
| News | 0-2 hours | 2-24 hours | 24+ hours |
| EPC | 0-90 days | 90-365 days | 365+ days |

In **degraded mode** (external APIs down), stale and expired data are still returned with appropriate warnings. Something is always better than nothing.

---

## Strategy 4: Queued Retry with Notification

When all providers fail simultaneously (unlikely but possible):

```
1. Carina returns degraded response immediately
   └─ "I'm having trouble connecting right now. I've queued your request and will follow up."
   
2. The failed request is queued (high priority)

3. Retry worker runs every 30 seconds:
   ├─ Providers recovered? → Process request → Send response
   └─ Still down? → Wait 30s, try again (max 10 attempts)

4. After 10 failed attempts:
   └─ Notify ops (email, Slack, SMS)
   └─ Notify user: "Your request is still queued. I'll notify you when services recover."
```

---

## Strategy 5: Graceful Database Degradation

If PostgreSQL goes down:

```php
class ResilientDatabaseService
{
    public function saveConversation(array $data): bool
    {
        try {
            return DB::table('conversations')->insert($data);
        } catch (Throwable $e) {
            // DB is down. Save to Redis as temporary backup.
            Redis::rpush('conversation_backlog', json_encode([
                'data' => $data,
                'failed_at' => now(),
            ]));
            
            // When DB recovers, a replay worker processes the backlog.
            dispatch(new ReplayConversationBacklog());
            
            return false; // But user still gets their response
        }
    }
}
```

---

## Strategy 6: Over-Provisioned Capacity

| Resource | Normal Need | Provisioned | Buffer |
|---|---|---|---|
| Laravel workers | 4 | 8 | 2x |
| Celery workers | 2 | 4 | 2x |
| PostgreSQL connections | 20 | 50 | 2.5x |
| Redis memory | 2 GB | 4 GB | 2x |
| Disk space | 20 GB | 100 GB | 5x |
| Monthly traffic | 32 TB | Unlimited (on Contabo) | Massive |

Buffer ensures Carina handles traffic spikes without performance degradation.

---

## Strategy 7: Monitoring + Automated Recovery

| What We Monitor | Alert Threshold | Automated Recovery |
|---|---|---|
| AI provider errors | 3 failures in 60s | Circuit breaker engages. Route to next provider. |
| Data API failures | 5 failures in 5 min | Disable data source. Return cached/estimated. |
| CPU > 80% | 5 minutes | Scale workers (auto). |
| RAM > 80% | 5 minutes | Restart service. |
| Disk > 80% | 30 minutes | Clean old logs + archives. |
| SSL cert expiry | 14 days before | Auto-renew via Certbot. |
| PostgreSQL replication lag | > 10 seconds | Alert only. |

---

## Strategy 8: Offline Survival Mode

Worst case: everything external is down. No AI providers, no data APIs, no database writes.

Carina still responds using:

1. **Pre-loaded base knowledge** (bundled in the Docker image)
2. **Last cached RAG state** (Redis or file-based checkpoint)
3. **A minimal local model** (tiny LLM or hardcoded response templates)

```
All external services down
    │
    ▼
┌────────────────────────────┐
│  Carina Survival Mode       │
│                             │
│  Available:                 │
│  ├─ Base knowledge (~1MB   │
│  │   of essential property  │
│  │   facts bundled in app)  │
│  ├─ RAG checkpoint (last   │
│  │   good state from Redis) │
│  ├─ Conversation history   │
│  │   (read-only from DB)   │
│  └─ Hardcoded fallback     │
│      responses              │
│                             │
│  Unavailable:               │
│  ├─ New AI responses        │
│  ├─ Live data (APIs)        │
│  ├─ Tool execution          │
│  └─ Document uploads        │
└────────────────────────────┘
```

---

## Failure Mode Hierarchy

```
Carina Request
    │
    ├── AI Provider Available?
    │   ├── YES → Full response
    │   └── NO  → Degraded response from last cached state
    │
    ├── Data API Available?
    │   ├── YES → Live data
    │   └── NO  → Cached data (with freshness notice)
    │
    ├── RAG Available?
    │   ├── YES → Context-enhanced response
    │   └── NO  → Response from base knowledge only (no personalisation)
    │
    ├── Database Available?
    │   ├── YES → Full history + save
    │   └── NO  → Response from in-memory cache (history lost if crash)
    │
    └── Absolute worst case (everything down)?
        └── Survival mode: base knowledge + hardcoded fallback
            "I'm experiencing connectivity issues right now.
             Here's what I know: ... [pre-loaded facts]
             Please try again in a few minutes."
```

---

## Summary

| Risk | Mitigation | Residual Impact |
|---|---|---|
| AI provider fails | Multi-provider rotation + circuit breaker | None (instant failover) |
| All AI providers fail | Queued retry + degrade to last good state + notify | Delayed, lower quality |
| Data API fails | RAG cache + estimated data + freshness notice | Slightly stale data |
| All data APIs fail | Last cached state + regional estimates | Approximate data |
| Database down | Redis backlog + auto-replay on recovery | Brief pause, no data loss |
| Redis down | In-memory fallback + file-based cache | Slightly slower |
| Full network failure | Survival mode with bundled base knowledge | Minimal but not silent |
| Single VPS dies | Docker auto-restart + regular backups + 15-min MTTR | 15-minute outage window |
| All of the above | Survival mode. Carina still responds. | Minimal, functional |

**Carina never fails silently. She always responds with whatever she has — even if that's just "I'm having trouble connecting. Here's what I knew as of [time]."**

The key metric: **100% response rate, varying quality.** Not: varying response rate, full quality.
