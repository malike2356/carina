# Carina AI — API Versioning, Webhooks & Dependencies

---

## Part 1: API Versioning

### Strategy

URL-based versioning: `https://carina.verlox.uk/api/v1/...`

The version number is part of the URL path. This is the simplest approach — no header negotiation, no content-type switching. Every version is a separate set of routes.

### Version Lifecycle

```
v1.0 (launch) ──► v1.1 (additions) ──► v1.2 (additions) ──► v2.0 (breaking)
   │                                                            │
   └── Supported for 6 months after v2.0 launch ────────────────┘
                                                          │
                                                    Returns 410 Gone
```

### Deprecation Policy

| Event | When | Action |
|---|---|---|
| v2.0 announced | 6 months before v2.0 launch | Deprecation header added to v1.x responses |
| v2.0 launched | Day of launch | v1.x still works. New users directed to v2. |
| 3 months after v2.0 | 3 months | Reminder: "v1 will be retired in 3 months" |
| 6 months after v2.0 | 6 months | v1.x returns 410 Gone. All traffic on v2. |

### Deprecation Header

```http
GET /api/v1/chat
Warning: 299 - "v1 will be deprecated on 2026-12-01. Migrate to /api/v2."
Sunset: Sat, 01 Dec 2026 00:00:00 GMT
```

### Internal Version Handling

```php
// routes/api.php
Route::prefix('v1')->group(base_path('routes/api_v1.php'));
Route::prefix('v2')->group(base_path('routes/api_v2.php'));

// Controllers are namespaced by version
// app/Http/Controllers/Api/v1/ChatController.php
// app/Http/Controllers/Api/v2/ChatController.php

// Shared logic lives in Services, not duplicated in controllers.
```

### Changelog

Published at `https://carina.verlox.uk/docs/changelog` in reverse chronological order:

```
## 2026-06-15 — v1.1.0
### Added
- `POST /v1/images/generate` — Generate property images
- `POST /v1/knowledge/upload` — Now supports DOCX and TXT

### Fixed
- Rate limiting now resets correctly at midnight UTC
```

---

## Part 2: Webhook System

### Purpose

Webhooks let third-party apps subscribe to Carina events. When an event occurs, Carina sends an HTTP POST to the subscriber's URL with a JSON payload.

### Events

| Event | When Fired | Payload |
|---|---|---|
| `analysis.completed` | Async deal/area analysis finishes | Analysis ID, type, summary URL |
| `knowledge.ingested` | Document upload finishes processing | Document ID, chunk count |
| `billing.usage_warning` | User hits 80%/90%/100% token threshold | Usage %, plan, suggested top-up |
| `billing.top_up` | On-demand bundle purchased | Bundle size, tokens added |
| `provider.degraded` | Circuit breaker opens for a provider | Provider, fallback active, estimated recovery |

### Security

```php
// Each webhook URL gets a unique signing secret
// Every payload includes: X-Carina-Signature: sha256=<HMAC>

public function verifySignature(string $payload, string $signature, string $secret): bool
{
    $expected = hash_hmac('sha256', $payload, $secret);
    return hash_equals($expected, $signature);
}
```

### Retry Policy

1. Attempt 1: immediate
2. Attempt 2: +10 seconds
3. Attempt 3: +60 seconds (1 min)
4. Attempt 4: +300 seconds (5 min)
5. Attempt 5: +3600 seconds (1 hour)
6. After 5 failures: webhook is paused. Admin notified.

### Webhook UI

```
/settings/webhooks

[Register Webhook]
URL: _________________________
Events: [x] analysis.completed
        [x] knowledge.ingested
        [ ] billing.usage_warning
[Save]

Webhooks:
┌──────────┬──────────────┬──────────┬───────────┐
│ URL      │ Events       │ Status   │ Last Sent │
├──────────┼──────────────┼──────────┼───────────┤
│ https:// │ analysis     │ Active   │ 2m ago    │
│ ..app.com│ completed    │ ✓        │ 200       │
└──────────┴──────────────┴──────────┴───────────┘
```

### Files

```
app/Services/Webhooks/
├── WebhookService.php            # Register, deliver, retry
├── WebhookDeliveryJob.php        # Queued delivery
├── WebhookSignatureService.php   # HMAC signing + verification
└── Events/
    ├── AnalysisCompleted.php
    ├── KnowledgeIngested.php
    ├── BillingUsageWarning.php
    └── ProviderDegraded.php

app/Http/Controllers/Api/
└── WebhookController.php         # CRUD for webhook subscriptions

database/migrations/
└── xxxx_create_webhooks_table.php

routes/api.php                    # /api/v1/webhooks/*
```

---

## Part 3: Dependency Management

### Schedule

| Dependency | Check Frequency | Update Method |
|---|---|---|
| Composer packages (PHP) | Weekly | `composer update` + test suite |
| NPM packages | Weekly | `npm update` + build test |
| Python packages | Monthly | `pip-review --auto` + test suite |
| Docker base images | Monthly | `docker pull` + rebuild + test |

### Composer (PHP)

```json
{
    "require": {
        "php": "^8.3",
        "laravel/framework": "^12.0",
        "laravel/sanctum": "^5.0",
        "laravel/horizon": "^5.0",
        "stancl/tenancy": "^3.10",
        "stripe/stripe-php": "^16.0"
    },
    "require-dev": {
        "pestphp/pest": "^3.0",
        "laravel/pint": "^1.0",
        "phpstan/phpstan": "^2.0"
    }
}
```

### Automated Checks

| Tool | What It Checks | Runs |
|---|---|---|
| Dependabot | Security advisories, available updates | Daily PRs for security patches |
| `composer audit` | Known CVE in dependencies | `composer install` hook |
| Trivy | Docker image vulnerabilities | Every build |

### Major Version Upgrades

1. Create branch: `upgrade/laravel-13`
2. Run upgrade guides
3. Run full test suite
4. Manual smoke test of critical flows
5. Deploy to staging, test for 24 hours
6. Merge to main

### Files

```
composer.json
package.json
python/requirements.txt
.dependabot/config.yml
```
