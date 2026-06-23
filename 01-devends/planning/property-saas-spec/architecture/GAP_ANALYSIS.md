# Carina AI - Gap Analysis: What We Haven't Documented Yet

**Purpose:** Identify everything missing from the Carina project documentation.  
**Scope:** Before building begins.  

---

## Methodology

18 documents exist covering architecture, API, billing, security, ML, scaling, resilience, and infrastructure. This analysis reviews what a production-ready property AI SaaS needs that isn't yet documented, sorted into:

- ** Must-have** - Ship-blocking. Do not build without this documented.
- ** Should-have** - Launch-critical but can be decided during build.
- ** Nice-to-have** - Post-launch, Phase 2+.

---

## Gap 1: User Onboarding & Activation Flow 

**Not documented.** How does a user go from landing page → signup → first "wow" moment?

### What's Missing

```
Landing page ──► Sign up ──► Email verification ──► First chat ──► "Wow, Carina knows property"
                        │                        │
                   What plan?               What happens if
                   Free trial?              they don't verify?
                   Credit card?             Re-send flow?
                   Social login?            Timeout?
```

### Must Document

| Item | Question to Answer |
|---|---|
| **Trial model** | Is there a free trial of Pro? 7 days? 14 days? No trial, just Free tier? |
| **Credit card at signup?** | Required for Pro trial? Or only at upgrade? |
| **Email verification** | Mandatory before first chat? Or allow limited chat before verify? |
| **Onboarding flow** | First chat prompt? Suggested questions? "I'm a landlord/investor/agent" selector? |
| **Activation triggers** | When does a user hit "wow"? After first area report? After first deal analysis? |
| **Cancellation flow** | How does a user cancel? What do they lose immediately vs at end of billing period? |
| **Data export on cancel** | Offer download before account goes read-only? |
| **Re-activation** | If they come back after 6 months, is their data still there? |

---

## Gap 2: Email & Notification System 

**Not documented.** Carina needs to send transactional emails, marketing emails, usage alerts, and system notifications.

### Must Document

| Notification | Trigger | Channel | Urgency |
|---|---|---|---|
| Welcome email | Signup completed | Email | Immediate |
| Email verification | Signup | Email | Immediate |
| Password reset | User request | Email | Immediate |
| Usage warning (50%) | Token usage threshold | Email + in-app | Low |
| Usage warning (80%) | Token usage threshold | Email + in-app | Medium |
| Usage warning (100%) | Token usage hit limit | Email + in-app + push | High |
| Top-up receipt | Purchase completed | Email | Medium |
| Plan change confirmation | Upgrade/downgrade | Email | Medium |
| Payment failed | Stripe invoice fails | Email | High |
| Payment method expiring | Card expires in 30 days | Email | Medium |
| Invoice receipt | Monthly billing | Email | Low |
| Account deleted | User deletes account | Email | Confirm |
| Data export ready | Export completes | Email | Medium |
| New feature announcement | Product launch | Email | Low |
| Weekly digest | Every Monday | Email (opt-in) | Low |
| Carina follow-up | Async analysis completes | Email + in-app | Medium |
| Provider outage | AI provider circuit opens | Admin email only | High |
| Security alert | Suspicious login detected | Email + SMS | High |

### Recommended Stack

| Tool | Cost | Why |
|---|---|---|
| **Laravel Mail + Postmark** | Free tier (100 emails/mo) → £7.50/mo (50K) | Transactional. Reliable. UK. |
| **Laravel Notifications** | Built-in | Database + mail + Slack channels. |
| **WebPush (PWA)** | Free | Browser push notifications for PWA users. |
| **Twilio (SMS)** | Pay-per-use (~£0.05/SMS) | Only for security alerts (MFA, login from new device). |

---

## Gap 3: Error Handling & User-Facing Errors 

**Not documented.** What does the user see when something goes wrong?

### Must Document

| Error Scenario | User Sees | HTTP Status |
|---|---|---|
| AI provider unavailable | "I'm having trouble connecting. I've queued your question and will respond when services recover." | 200 (reply accepted) |
| Data API unavailable | "Live data temporarily unavailable. Showing data from [date]." | 200 (degraded) |
| Token limit reached | "You've used all 50,000 tokens this month. Upgrade or buy a top-up to continue." | 402 (Payment Required) |
| Rate limited | "Too many requests. Please wait [X seconds]." | 429 |
| Invalid API key | "Invalid API key. Check your Authorization header." | 401 |
| Expired API key | "This API key has expired. Generate a new one in Settings." | 401 |
| File too large | "File exceeds the [50MB] limit. Compress and try again." | 413 |
| Unsupported file type | "Unsupported file type. Supported: PDF, DOCX, TXT, MD." | 422 |
| Account suspended | "Your account has been suspended. Contact support for details." | 403 |
| Internal server error | "Something went wrong. We've been notified. Try again." | 500 |

### Global Error Response Format

```json
{
    "error": {
        "code": "TOKEN_LIMIT_EXCEEDED",
        "message": "You've used all 50,000 tokens this month.",
        "details": {
            "plan": "pro",
            "tokens_used": 50000,
            "tokens_allowed": 50000,
            "reset_date": "2026-06-01"
        },
        "docs_url": "https://carina.verlox.uk/docs/errors/token-limit"
    }
}
```

---

## Gap 4: Testing Strategy 

**Partially documented** (coding standards mention test patterns). No testing strategy document exists.

### Must Document

| Layer | Tool | What to Test | Coverage Target |
|---|---|---|---|
| **Unit (PHP)** | Pest | Services, DTOs, value objects, enums, tool logic, calculators | 90%+ |
| **Feature (PHP)** | Pest | API endpoints (happy + sad paths), auth, rate limiting, token metering | 80%+ |
| **Integration (PHP)** | Pest | Database queries, RAG pipeline, provider routing | 70%+ |
| **Unit (Python)** | pytest | ML models (inference output shape, error handling), FastAPI routes | 90%+ |
| **Browser (PHP)** | Laravel Dusk | Critical user flows: signup, chat, settings, billing | Core flows only |
| **API contract** | PHPUnit + OpenAPI | All endpoints return correct shape + status codes | 100% |

### CI/CD Pipeline

```
Push ──► PHPStan (level 6) ──► Pest tests ──► Python tests ──► Build Docker image ──► Deploy staging
          └── Static analysis        └── Code coverage     └── Security scan (Trivy)
          └── No dead code            └── Coverage gate                               └── Deploy prod
                                   (90% unit, 80% feature)
```

---

## Gap 5: API Versioning & Lifecycle 

**Not documented.** How do we handle breaking changes?

### Must Document

| Policy | Decision |
|---|---|
| **Version strategy** | URL-based (`/v1/`, `/v2/`). Not header-based. |
| **Deprecation window** | 6 months from announcement. |
| **Deprecation header** | `Warning: 299 - "v1 will be deprecated on 2026-12-01. Use /v2/ instead."` |
| **Changelog** | Documented at `https://carina.verlox.uk/docs/changelog` |
| **Sunset policy** | Endpoint removed after deprecation window. Returns 410 Gone. |

---

## Gap 6: Webhook System 

**Not documented.** Third parties need to subscribe to events.

### Must Document

| Event | Payload | Trigger |
|---|---|---|
| `analysis.completed` | Deal analysis result + property ID | Async analysis finishes |
| `knowledge.ingested` | Document ID + chunk count | Document upload finishes processing |
| `billing.usage_threshold` | Current usage % + plan allowance | User hits 80%, 90%, 100% |
| `billing.top_up` | Bundle purchased + tokens added | Top-up completes |
| `provider.degraded` | Provider name + fallback activated | Circuit breaker opens |

### Implementation

```http
POST https://customer-app.com/webhooks/carina
Content-Type: application/json
X-Carina-Signature: sha256=...  # HMAC with shared secret
X-Carina-Event: analysis.completed

{
    "event": "analysis.completed",
    "created_at": "2026-05-08T10:00:00Z",
    "data": {
        "analysis_id": 42,
        "status": "completed",
        "result_url": "https://carina.verlox.uk/api/v1/analysis/42"
    }
}
```

---

## Gap 7: Logging & Observability Strategy 

**Partially documented** (monitoring tools listed in INFRASTRUCTURE). No strategy.

### Must Document

| Log Type | Where | Retention | What's Logged |
|---|---|---|---|
| Application logs | `storage/logs/laravel.log` | Rotate daily, 7 days | All errors, warnings, info. Structured JSON. |
| Request logs | Loki | 30 days | Method, path, status, duration, user, tenant. |
| AI provider logs | `ai_provider.log` | 30 days | Provider, model, tokens, latency, errors. |
| Data API logs | `data_api.log` | 30 days | Endpoint, response status, latency, cache hit/miss. |
| Audit logs | `audit_log` DB table | 365 days (Enterprise: 7 years) | Security events. Tamper-evident. |
| Billing logs | Stripe dashboard + `billing.log` | 7 years | Payments, refunds, invoice events. |

---

## Gap 8: Dependency Management 

**Not documented.** How do we keep packages up to date without breaking things?

### Should Document

| Action | Frequency | Process |
|---|---|---|
| `composer update` | Weekly | Run tests. If green, merge. |
| `npm update` | Weekly | Run build. If green, merge. |
| Dependabot alerts | Real-time | Security patches auto-PR'd. Merge if tests pass. |
| Major version upgrades | Quarterly | Manual review. Test thoroughly. Document breaking changes. |
| Python deps (`pip`) | Monthly | `pip audit`. Review CVEs. |

---

## Gap 9: Feature Flags 

**Not documented.** How do we roll out features gradually?

### Should Document

```php
// Simple feature flag system (no external dependency)
if (FeatureFlag::enabledFor('image_generation', $user)) {
    // Show image generation UI
}

// Admin can toggle per tenant:
// - Global off: feature hidden entirely
// - Global on: feature available to all
// - Beta: feature available to specific tenant IDs
// - Internal: feature available to admin accounts only
```

---

## Gap 10: Public Documentation Site 

**Not documented.** Where do users go to learn how to use Carina?

### Should Document

| Page | Content |
|---|---|
| `docs.verlox.uk/carina` | Home, getting started |
| `/docs/api` | Full API reference (auto-generated from OpenAPI spec) |
| `/docs/api/authentication` | API keys, rate limits, scopes |
| `/docs/guides/area-reports` | How to generate and interpret area reports |
| `/docs/guides/deal-analysis` | How to use the deal analyser |
| `/docs/guides/training` | How to upload documents and train Carina |
| `/docs/billing` | Plans, tokens, top-ups, BYOK |
| `/docs/changelog` | Release notes |
| `/docs/security` | Security overview (public version of SECURITY doc) |
| `/docs/status` | System status page |

**Implementation:** Markdown → processed by static site generator (MkDocs, Docusaurus, or just Blade routes reading local MD files).

---

## Gap 11: API Playground 

**Not documented.** Developers need to test API calls before writing code.

### Should Document

Swagger/OpenAPI UI at `/api/docs`:
- Interactive endpoint testing
- Auto-generated client code (Python, JavaScript, PHP, curl)
- API key input field (so developers can test with their own key)
- Rate limit indicators

**Implementation:** `spatie/laravel-openapi` or `darkaonline/l5-swagger`.

---

## Gap 12: Desktop App 

**Not documented.** Some users want Carina in their taskbar.

### Should Document (Future)

| Platform | Approach | When |
|---|---|---|
| **macOS** | SwiftUI menu bar app. Quick access to chat + screenshot-to-analysis. | Phase 3 |
| **Windows** | Electron / Tauri system tray app. Same functionality. | Phase 3 |
| **Linux** | Tauri app (already cross-platform). | Phase 3 |

---

## Gap 13: Accessibility & Compliance 

**Not documented.**

### Should Document

| Standard | Requirement | Effort |
|---|---|---|
| **WCAG 2.1 AA** | Colour contrast, keyboard navigation, screen reader support, focus indicators | Ongoing |
| **UK Equality Act 2010** | Reasonable adjustments for disabled users | Compliance check |
| **Cookie consent** | UK PECR compliance. Cookie banner. Manage preferences. | Small |

---

## Summary: Build Order

| Priority | Gap | Why |
|---|---|---|
|  | User onboarding & activation | Users can't sign up without it |
|  | Email & notifications | Users can't reset passwords, get invoices, or receive alerts |
|  | Error handling | Users see raw exceptions without it |
|  | Testing strategy | Can't ship with confidence |
|  | API versioning | Will break integrators without it |
|  | Webhook system | Enterprise/API users need it |
|  | Logging & observability | Can't debug production issues |
|  | Feature flags | Deploy with confidence, roll back safely |
|  | Public docs | Users can't self-serve |
|  | API playground | Developers adopt faster |
|  | Desktop app | Phase 2 |
|  | Accessibility | Legal requirement, but can iterate |

---

## What We Have Done Well (No Gaps)

These areas are fully documented and ready to build from:

| Document | Status |
|---|---|
| System architecture (Laravel + Python split) | Done:  Complete |
| Multi-provider AI rotation + circuit breaker | Done:  Complete |
| Token-based billing (Cursor-style) | Done:  Complete |
| Plan differentiation (9 dimensions) | Done:  Complete |
| RAG pipeline + auto-ingestion from data APIs | Done:  Complete |
| Python ML engine (FastAPI + Celery + models) | Done:  Complete |
| Performance & scaling (8 strategies) | Done:  Complete |
| Infrastructure (MVP through enterprise) | Done:  Complete |
| Resilience & failure modes (8 layers) | Done:  Complete |
| Security, cyber & forensics (10 domains) | Done:  Complete |
| Privacy, GDPR, continuous learning opt-in | Done:  Complete |
| Coding standards (7 principles) | Done:  Complete |
| Image generation | Done:  Complete |
| 100 revenue opportunities | Done:  Complete |
| Investment proposal | Done:  Complete |
