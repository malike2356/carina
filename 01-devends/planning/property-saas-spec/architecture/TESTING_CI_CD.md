# Carina AI - Testing, CI/CD & Release Strategy

---

## Test Pyramid

```
         ╱─────╲
        ╱  E2E  ╲          Laravel Dusk: 5-10 critical flows
       ╱─────────╲
      ╱ Feature / ╲        Pest: 80%+ coverage on all endpoints
     ╱ Integration ╲
    ╱───────────────╲
   ╱    Unit Tests   ╲      Pest / pytest: 90%+ on services, DTOs, calculators
  ╱───────────────────╲
```

## Test Types

### Unit Tests (Pest / pytest)

| What | Framework | Target Coverage |
|---|---|---|
| DTOs, value objects, enums | Pest (PHP) | 100% |
| Calculator logic | Pest (PHP) | 100% |
| Tool execution | Pest (PHP) | 100% |
| Token counting & metering | Pest (PHP) | 100% |
| Provider routing logic | Pest (PHP) | 100% |
| ML model inference shape | pytest | 100% |

### Feature Tests (Pest)

| What | Tests | Target |
|---|---|---|
| All API endpoints | Happy + every sad path | 80%+ |
| Authentication | Login, register, verify, reset, MFA | 100% |
| Billing | Subscribe, upgrade, downgrade, cancel, top-up | 100% |
| Rate limiting | Every tier's limit enforced | 100% |
| Token metering | Deduction, limit, rollover | 100% |

### Integration Tests

| What | Tests |
|---|---|
| RAG pipeline | Upload → chunk → embed → search → retrieve |
| Provider routing | Each provider, circuit breaker, failover, fallback |
| Data ingestion | API call → analyse → store in RAG → cache |
| Webhook delivery | Send → retry → signature verification |

### E2E / Browser Tests (Dusk)

```
tests/Browser/
├── SignupTest.php              # Full signup flow
├── ChatTest.php                # Send message, see response
├── BillingTest.php             # Upgrade, see token count increase
├── KnowledgeTest.php           # Upload doc, see it in RAG
└── SettingsTest.php            # API key gen, profile edit
```

## CI/CD Pipeline

```yaml
# .github/workflows/test.yml
name: Test & Deploy

on: [push, pull_request]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: composer install
      - run: ./vendor/bin/phpstan analyse --level=6
      - run: ./vendor/bin/pint --test

  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: pgvector/pgvector:0.8.0-pg16
        env: { POSTGRES_PASSWORD: secret, POSTGRES_DB: carina_test }
      redis:
        image: redis:7-alpine

    steps:
      - uses: actions/checkout@v4
      - run: composer install
      - run: cp .env.example .env
      - run: php artisan key:generate
      - run: php artisan migrate --env=testing
      - run: php artisan test --coverage --min=80

  python-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pip install -r requirements.txt
      - run: pytest --cov=./ --cov-fail-under=90

  deploy:
    needs: [lint, test, python-test]
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to production
        run: |
          ssh deploy@carina.verlox.uk "
            cd /opt/carina &&
            git pull &&
            docker compose up -d --build
          "
```

## Release Process

| Step | Who | What |
|---|---|---|
| 1. Feature branch | Developer | Code + tests + passes CI |
| 2. PR review | Another developer | Code review + test review |
| 3. Merge to main | Developer | Auto-deploys to staging |
| 4. Staging verification | Developer | Smoke test critical flows |
| 5. Tag release | Lead | `git tag v1.2.3` |
| 6. Deploy to production | Automated | Docker deploy from tag |
| 7. Post-deploy monitor | Automated | Sentry + uptime check 30 min |

## Versioning

Semantic versioning: `MAJOR.MINOR.PATCH`
- MAJOR: Breaking API changes (new `/v2/`)
- MINOR: New features, backward compatible
- PATCH: Bug fixes, performance, security

## Code Coverage Gates

| Branch | Gate |
|---|---|
| Feature branch | Must pass CI |
| PR to main | Coverage must not decrease |
| Main | Min 80% feature, 90% unit |
| Release tag | Min 85% feature, 95% unit |

## Files

```
.github/workflows/
├── test.yml             # CI pipeline
└── deploy.yml           # CD pipeline

phpunit.xml               # PHP test config
phpstan.neon              # Static analysis config
.pint.json                # Laravel Pint code style
```
