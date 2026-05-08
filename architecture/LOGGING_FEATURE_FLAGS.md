# Carina AI — Logging, Observability & Feature Flags

---

## Part 1: Logging Strategy

### Log Levels

| Level | When | Examples |
|---|---|---|
| `emergency` | System is unusable | DB connection lost, all providers down |
| `alert` | Immediate action needed | Payment processor failing, disk full |
| `critical` | Critical condition | AI provider returning garbage data |
| `error` | Runtime errors | API call failed, circuit breaker opened |
| `warning` | Exceptional but not an error | Rate limit approaching, usage at 90% |
| `notice` | Normal but significant | User upgraded, tenant created |
| `info` | Interesting events | Request completed, analysis done |
| `debug` | Detailed debug information | Provider response payload, timing breakdown |

### What to Log

| Category | Logged? | Channel |
|---|---|---|
| HTTP requests (path, method, status, duration, user, tenant) | ✅ Info | `stack` → Loki |
| AI provider calls (provider, model, tokens, latency, success/fail) | ✅ Info | `ai_provider` |
| Data API calls (endpoint, status, latency, cache hit) | ✅ Debug | `data_api` |
| Billing events (plan change, payment, top-up) | ✅ Info | `stack` |
| Token metering (deduction, limit hit, rollover) | ✅ Debug | `stack` |
| Auth events (login, logout, failed login, MFA) | ✅ Info | `stack` |
| Security events (suspicious activity, rate limit hit) | ✅ Notice | `stack` |
| All errors (4xx, 5xx, exceptions) | ✅ Error | `stack` + Sentry |
| Queue jobs (processed, failed, retried) | ✅ Info | Horizon |
| All debug data (provider request/response payloads) | ✅ Debug | disabled in production |

### Log Format (Structured JSON)

```json
{
    "timestamp": "2026-05-08T10:00:00.000000Z",
    "level": "info",
    "message": "AI provider call completed",
    "channel": "ai_provider",
    "extra": {
        "provider": "deepseek",
        "model": "deepseek-v4-flash",
        "input_tokens": 245,
        "output_tokens": 890,
        "latency_ms": 2340,
        "success": true,
        "tenant_id": "uuid",
        "user_id": 42,
        "request_id": "req_abc123"
    }
}
```

### Channels

```php
// config/logging.php
'channels' => [
    'ai_provider' => [
        'driver' => 'daily',
        'path' => storage_path('logs/ai_provider.log'),
        'level' => env('LOG_LEVEL', 'info'),
        'days' => 30,
    ],
    'data_api' => [
        'driver' => 'daily',
        'path' => storage_path('logs/data_api.log'),
        'level' => env('LOG_LEVEL', 'debug'),
        'days' => 30,
    ],
    'billing' => [
        'driver' => 'daily',
        'path' => storage_path('logs/billing.log'),
        'level' => 'info',
        'days' => 365,
    ],
],
```

### Log Viewing (Production)

| Tool | What It Shows | Access |
|---|---|---|
| **Laravel Horizon** | Queue jobs, failures, throughput, runtime | `/horizon` (admin) |
| **Filament logs** | Recent errors, request log | `/admin/logs` (admin) |
| **Loki + Grafana** | Aggregated logs from all services, search, dashboards | `/admin/grafana` (admin) |
| **Sentry** | Error tracking with stack traces, user context, replay | sentry.io (team) |

---

## Part 2: Feature Flags

### Purpose

Ship code before it's ready for everyone. Roll out gradually. Turn off instantly if something breaks.

### Flag States

| State | Behaviour | Use Case |
|---|---|---|
| `off` | Feature hidden from all users | In development |
| `internal` | Visible to admin accounts only | Testing in production |
| `beta` | Visible to specific tenant IDs | Early access programme |
| `percent` | Visible to X% of users randomly | Gradual rollout |
| `on` | Visible to all users | Fully released |

### Implementation

```php
// config/feature-flags.php
return [
    'image_generation' => env('FEATURE_IMAGE_GENERATION', 'off'),
    'portfolio_analysis' => env('FEATURE_PORTFOLIO_ANALYSIS', 'internal'),
    'webhooks' => env('FEATURE_WEBHOOKS', 'beta'),
    'fine_tuning' => env('FEATURE_FINE_TUNING', 'off'),
];

// In code
if (Feature::active('image_generation', $user)) {
    // Show image generation UI
}
```

### Feature Service

```php
class Feature
{
    public static function active(string $flag, ?User $user = null): bool
    {
        $state = config("feature-flags.{$flag}", 'off');

        return match ($state) {
            'on' => true,
            'internal' => $user && $user->isAdmin(),
            'beta' => $user && in_array($user->tenant_id, config("feature-flags.beta_tenants.{$flag}", [])),
            'percent' => $user && (crc32($user->id) % 100) < config("feature-flags.percent.{$flag}", 0),
            default => false,
        };
    }
}
```

### Admin UI (Filament)

```
/admin/features

Feature Flags
┌──────────────────────┬──────────┬──────────────┐
│ Flag                 │ State    │ Actions      │
├──────────────────────┼──────────┼──────────────┤
│ image_generation     │ off      │ [On] [Beta]  │
│ portfolio_analysis   │ internal │ [On] [Beta]  │
│ webhooks             │ beta     │ [On] [Off]   │
│ fine_tuning          │ off      │ [On] [Beta]  │
└──────────────────────┴──────────┴──────────────┘
```

### Files

```
config/feature-flags.php
app/Services/Feature.php
app/Filament/Resources/FeatureFlagResource.php
```
