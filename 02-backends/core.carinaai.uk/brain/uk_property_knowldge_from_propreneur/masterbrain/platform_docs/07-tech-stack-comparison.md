# Propreneur v1.0 vs v2.0 Tech Stack Comparison

**Live repo note (2026):** Several rows describe **long-term targets**. This codebase already ships **Laravel 12**, **stancl/tenancy v3**, **PostgreSQL**, **Pest**, and a **Blade + Alpine + Tailwind v4 + token/runtime** UI (see **`brain/knowledge/12-ui-components.md`** and **`instructions.md`**). **Inertia + React** remains optional future work, not the default stack today.

## Side-by-Side Comparison

| Component | v1.0 (Production) | v2.0 (Planned) |
| :---- | :---- | :---- |
| Framework | Laravel 10 | Laravel 11+ (this repo: Laravel 12) |
| PHP Version | PHP 8.1 | PHP 8.3+ (this repo: 8.2+) |
| Database | MySQL 8.4 (single shared DB) | PostgreSQL 16 (database-per-tenant) |
| Multi-tenancy | spatie/laravel-multitenancy v3 (shared DB) | stancl/tenancy (this repo: v3; separate DB per tenant) |
| Frontend | Blade \+ jQuery \+ Vite | **Shipped:** Blade \+ Alpine \+ Tailwind v4 \+ design tokens; **Optional later:** Inertia.js \+ React |
| Testing | PHPUnit (3% coverage, MySQL-based) | Pest (target \>70% coverage, SQLite in-memory) |
| Queue | Redis \+ database driver | Laravel Horizon \+ Redis |
| Search | Basic MySQL full-text | Laravel Scout \+ Meilisearch |
| AI Integration | Direct API calls in services | BYOK system with multi-provider routing |
| API Architecture | REST (mixed versions) | REST \+ versioned (v1, v2) |
| Authentication | Laravel Sanctum | Laravel Sanctum \+ 2FA \+ API tokens |
| Background Jobs | Custom jobs \+ scheduler | Horizon \+ job batching \+ failed job dashboard |
| File Storage | Local \+ S3 | S3 with CDN \+ signed URLs |
| Caching | Redis (basic) | Redis \+ cache tagging \+ eager loading |
| Containerization | Docker (Sail for dev only) | Docker \+ production container orchestration |
| CI/CD | Manual deploy scripts | GitHub Actions (test, staging, production) |
| Monitoring | None | Sentry \+ OhDear \+ Health checks |
| Documentation | Minimal README | brain/knowledge/ \+ API docs generator |
| Mobile | Separate codebase (mobile\_apps/) | API-first with mobile SDK generation |

---

## Pros and Cons Analysis

### Laravel Version (10 vs 11\)

| Aspect | v1.0 (Laravel 10\) | v2.0 (Laravel 11\) |
| :---- | :---- | :---- |
| Pros | Stable, well-documented | Better performance, simplified bootstrap, new features |
| Cons | Support ended August 2025 | Newer, less community packages migrated |
| Verdict | v2.0 wins (active support) |  |

### Database (MySQL vs PostgreSQL)

| Aspect | v1.0 (MySQL) | v2.0 (PostgreSQL) |
| :---- | :---- | :---- |
| Pros | Simple, widely used, easy hosting | JSONB support, better concurrency, full-text search, array types |
| Cons | Poor JSON support, locking issues at scale | Slightly steeper learning curve |
| Verdict | v2.0 wins for multi-tenant SaaS |  |

### Multi-tenancy (spatie vs stancl)

| Aspect | v1.0 (spatie) | v2.0 (stancl) |
| :---- | :---- | :---- |
| Pros | Simple setup, shared DB (cost-effective) | True isolation, separate DB per tenant, no cross-tenant leaks |
| Cons | Data isolation depends on code, one bug exposes all tenants | Higher operational cost, more complex backups |
| Verdict | v2.0 wins for security (critical for property financial data) |  |

### Frontend (Blade stack vs SPA hybrid)

| Aspect | v1.0 (Blade + jQuery) | v2.0 (this repo / roadmap) |
| :---- | :---- | :---- |
| Pros | Simple, server-rendered | Alpine-enhanced Blade, tokens, fast shells; optional SPA slice later |
| Cons | Mixed logic, dated UX patterns | Heaviest SPA workflows would still want API discipline |
| Verdict | v2.0 improves cohesion via tokens + components first | Inertia+React only where justified |

### Testing (PHPUnit vs Pest)

| Aspect | v1.0 (PHPUnit) | v2.0 (Pest) |
| :---- | :---- | :---- |
| Pros | Standard, widely known | More expressive syntax, faster to write |
| Cons | Verbose, slower to write | Newer, less community examples |
| Verdict | v2.0 wins (developer productivity) |  |

### Queue (Custom vs Horizon)

| Aspect | v1.0 (Custom) | v2.0 (Horizon) |
| :---- | :---- | :---- |
| Pros | Simple, works | Dashboard, retry management, job batching, metrics |
| Cons | No visibility into failed jobs | More resource intensive |
| Verdict | v2.0 wins (critical for production) |  |

### Search (MySQL vs Meilisearch)

| Aspect | v1.0 (MySQL) | v2.0 (Meilisearch) |
| :---- | :---- | :---- |
| Pros | No extra service | Typo tolerance, faceted search, instant results |
| Cons | Basic full-text only | Separate service to maintain |
| Verdict | v2.0 wins for user experience |  |

### AI Integration (Direct vs BYOK)

| Aspect | v1.0 (Direct) | v2.0 (BYOK) |
| :---- | :---- | :---- |
| Pros | Simple | Tenant choice, cost control, provider flexibility |
| Cons | Single provider, no tenant control | Complex configuration |
| Verdict | v2.0 wins for flexibility |  |

### CI/CD (Manual vs GitHub Actions)

| Aspect | v1.0 (Manual) | v2.0 (GitHub Actions) |
| :---- | :---- | :---- |
| Pros | Simple | Automated testing, consistent deployments |
| Cons | Error-prone, no quality gates | Setup complexity |
| Verdict | v2.0 wins for reliability |  |

### Monitoring (None vs Sentry+OhDear)

| Aspect | v1.0 (None) | v2.0 (Sentry+OhDear) |
| :---- | :---- | :---- |
| Pros | Nothing to configure | Proactive error tracking, uptime monitoring |
| Cons | Blind to production issues | Additional cost |
| Verdict | v2.0 wins (critical for customer trust) |  |

---

## Summary Table

| Category | v1.0 | v2.0 | Winner |
| :---- | :---- | :---- | :---- |
| Laravel | 10 (EOL) | 11 (active) | v2.0 |
| Database | MySQL | PostgreSQL | v2.0 |
| Multi-tenancy | Shared DB | Separate DB | v2.0 |
| Frontend | Blade + jQuery | Blade + Alpine + tokens (SPA optional) | v2.0 |
| Testing | PHPUnit (3%) | Pest (70% target) | v2.0 |
| Queue | Custom | Horizon | v2.0 |
| Search | MySQL | Meilisearch | v2.0 |
| AI | Direct | BYOK | v2.0 |
| CI/CD | Manual | GitHub Actions | v2.0 |
| Monitoring | None | Sentry+OhDear | v2.0 |
| Mobile | Separate codebase | API-first | v2.0 |
| Documentation | Minimal | Knowledge base | v2.0 |

Overall Winner: v2.0 in all categories  
---

## Migration Effort from v1.0 to v2.0

| Component | Effort | Reason |
| :---- | :---- | :---- |
| Database schema | High | MySQL to PostgreSQL, new tenancy model |
| Models | Medium | New relationships, tenant isolation |
| Controllers | Medium | Split into services, DTOs |
| Views | Medium-to-high | New screens use Blade components + Alpine; React/Inertia only if adopted |
| Tests | High | PHPUnit to Pest, new coverage requirements |
| Queue jobs | Low | Similar logic, new Horizon config |
| AI services | Medium | New BYOK abstraction |
| API endpoints | Medium | Versioning, new response formats |

Estimated total effort: 3-4 months for full rebuild (as planned)  
---

## Risk Assessment

| Risk | v1.0 | v2.0 |
| :---- | :---- | :---- |
| Security breach (data leak) | High (shared DB) | Low (separate DBs) |
| Technical debt accumulation | Extreme (252KB web.php) | Managed (strict rules) |
| Developer onboarding time | Weeks | Days (docs \+ structure) |
| Deployment failure rate | High (manual) | Low (automated) |
| Bug detection | Late (no tests) | Early (CI \+ tests) |
| Customer data isolation | Weak | Strong |

---

## Final Recommendation

Build v2.0 as planned. Do not attempt to retrofit v1.0 features into the new stack. The architecture improvements justify the rebuild effort. The separate database tenancy alone is worth the migration cost for financial/property data security.  
