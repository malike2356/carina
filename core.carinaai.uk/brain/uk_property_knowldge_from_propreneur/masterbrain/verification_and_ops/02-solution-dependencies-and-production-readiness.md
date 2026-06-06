# Solution dependencies and production readiness

**Purpose:** One checklist for operators and release engineers: external services, data stores, and verification steps needed before the platform and Carina RAG behave as designed.

**Related:** `CLAUDE.md` (local setup, test DB rules), `63-config-php-inventory.md` (env keys), `08-carina.md` (Carina and RAG), `36-backup-disaster-recovery.md` (backups), `01-architecture.md` (stack), `.github/workflows/test.yml` (CI parity).

---

## How to read this doc

- **Blocker:** core HTTP, tenancy, or auth cannot run without it.
- **Launch:** expected for a normal production cut (including Carina chat and RAG as shipped).
- **Optional:** feature-specific; the app boots and serves core modules without it, or you accept a reduced mode.

**Achieving** a dependency means: install or provision it, wire `.env`, run the listed migrations or commands, then run the **verification** step. Treat unchecked verification as not done.

---

## 1. Runtime and data stores

| Dependency | Tier | Notes | Achieve (summary) | Verify |
|-------------|------|--------|-------------------|--------|
| PHP | Blocker | 8.2+ (`composer.json`); CI uses 8.2, production often 8.3 | Install PHP-FPM or CLI with extensions below | `php -v` |
| PHP extensions | Blocker | Match production to `composer.json` and CI (`dom`, `curl`, `libxml`, `mbstring`, `zip`, `pcntl`, `pgsql`, `pdo_pgsql`, `bcmath`, `intl`, `fileinfo` as a baseline) | Enable in `php.ini` / packages | `php -m` |
| Composer vendor tree | Blocker | | `composer install --no-dev --optimize-autoloader` (deploy) | App boots, `php artisan about` |
| Node + npm | Launch | Vite build for `public/build` | Install Node LTS, `npm ci`, `npm run build` | Assets load, no missing manifest errors |
| PostgreSQL | Blocker | 16 recommended; database-per-tenant | Server reachable; role with `CREATEDB` (tenant DB creation) | Connect with app credentials |
| Central application database | Blocker | One catalog for `tenants`, `domains`, platform tables | Create DB, owner = app user, UTF-8 | `php artisan migrate --force` on production |
| Tenant databases | Blocker | Created per workspace; prefix `propreneur_t_{slug}` | Signup pipeline or `stancl` jobs; repair with tenancy docs | New tenant can log in at subdomain |
| **pgvector** (`vector` extension) | Launch for RAG | Embeddings on `rag_chunks.embedding`; migration runs `CREATE EXTENSION IF NOT EXISTS vector` | Install OS package (e.g. `postgresql-16-pgvector` on Debian/Ubuntu). Ensure DB owner or role may create extension. For Docker/CI use an image that ships pgvector (e.g. `pgvector/pgvector:pg16`). | Per tenant (after migrate): extension present; `php artisan carina:verify` (see section 4). If extension creation fails in logs, run `rag:ensure-embedding-schema` after fixing OS package. |
| Redis | Launch | Default `.env.example` uses `QUEUE_CONNECTION=redis`, `CACHE_STORE=redis` | Run Redis; set `REDIS_*` | `redis-cli ping`, queue workers process jobs |
| Meilisearch | Launch if Scout enabled | `SCOUT_DRIVER=meilisearch` in template | Run Meilisearch; set `MEILISEARCH_HOST` (and key if locked down) | Global search and indexed models behave |
| Mail / SMTP | Launch | Outbound mail for invites, billing, etc. | Configure `MAIL_*` | Send a test mail from staging |
| Object storage (optional) | Optional | If `FILESYSTEM_DISK=s3` or similar | Configure disk in `config/filesystems.php` + env | Upload/download path |

---

## 2. Application bootstrap (every environment)

| Step | Command or action | Verify |
|------|-------------------|--------|
| Env file | Copy `.env.example` to `.env`; set `APP_KEY`, URLs, all DB and Redis keys | No missing secrets at boot |
| Central schema | `php artisan migrate --force` (production) or `php artisan migrate` (dev) | Tables exist; app serves platform routes |
| Tenant template / existing tenants | After code deploy: `php artisan tenants:migrate` (or equivalent ops runbook for fleet) | New migrations applied; no tenant boot errors |
| Schedules and queues | `php artisan schedule:run` via cron; `php artisan horizon` or `queue:work` | Jobs drain; scheduled commands in `routes/console.php` run |

**Never** on production central DB: `migrate:fresh`, `db:wipe`, `migrate:reset` (blocked by `DatabaseWipeGuard` when targeting `propreneur_central`). Use forward-only `migrate`.

---

## 3. Carina AI and RAG (embedding path)

| Dependency | Tier | Achieve | Verify |
|------------|------|---------|--------|
| OS / Postgres: pgvector | Launch for RAG | Install `postgresql-*-pgvector` or use pgvector-capable image | `SELECT extname FROM pg_extension WHERE extname = 'vector';` in tenant DB |
| Tenant migrations | Launch | Includes `database/migrations/tenant/2026_05_01_120000_carina_v2_rag_prompts_rate_limits.php` (extension + `rag_chunks` embedding column where applicable) | Migration success in logs |
| Embedding provider API key | Launch for indexing | At least one provider in `AI_EMBEDDING_PROVIDER_PRIORITY` with a valid key (`63-config-php-inventory.md`) | Ingest a small doc; rows in `rag_chunks` with non-null `embedding` |
| Queue workers | Launch | `ProcessDocumentJob` / embedding jobs must run | Upload RAG doc; job completes |
| Optional: brain corpus in RAG | Optional | `php artisan rag:ingest-brain-knowledge` (see `00-README.md` Carina section) | Search returns chunks |

If embeddings fail silently, check application logs for pgvector warnings (`RAGService`, `Carina` migration warnings) and run `php artisan rag:ensure-embedding-schema --tenant=<slug>` where documented in `00-README.md` and `scripts/` helpers.

---

## 4. Verification commands (copy-paste checklist)

Run in staging before production promotion; adjust host and tenant slug.

```bash
php artisan about
php artisan migrate --force
php artisan tenants:migrate
php artisan carina:verify
```

Optional health depth: exercise one tenant login, one Carina message, one RAG upload if RAG is in scope.

---

## 5. CI and automated tests (parity with production)

| Dependency | Why | Achieve |
|------------|-----|---------|
| PostgreSQL with pgvector | Tenant migrations and RAG tests need `vector` | Use `pgvector/pgvector:pg16` (see `.github/workflows/test.yml`) or native Postgres with extension |
| Single testing catalog | `phpunit.xml` forces `propreneur_testing` for default and central | Match env vars to workflow |
| Migrate before test | Central tables (`domains`, `tenants`) must exist | Workflow step: `php artisan migrate --force` then `php artisan test` |
| No parallel jobs on one DB | Custom `tests/Concerns/RefreshDatabase.php` uses a file lock when default and central share one Postgres catalog | One CI job per DB; avoid two local `pest` runs against the same `propreneur_testing` without expecting lock wait |

**Achieving** green CI: mirror `.github/workflows/test.yml` service and env block on self-hosted runners.

---

## 6. Billing, integrations, and optional product modules

| Area | Tier | Pointer |
|------|------|---------|
| Stripe billing | Optional until you sell subscriptions | `17-billing-api.md`, `.env.example` Stripe keys |
| Tavily web search | Optional | `18-carina-tavily-web-search.md` |
| Platform backups | Launch for operations maturity | `36-backup-disaster-recovery.md` |
| External calendars (viCal later phases) | Optional / deferred | `31-vcal-booking-module.md`, `instructions.md` |

---

## 7. Quick “definition of done” for launch

1. PostgreSQL 16+ with app user and central DB migrated.
2. Redis (and workers) if `.env` matches the shipped default of Redis for cache and queue.
3. pgvector available to every tenant catalog that should use RAG; `php artisan carina:verify` passes for a representative tenant.
4. At least one LLM provider and embedding-capable configuration for Carina (per `config/ai.php` and `63-config-php-inventory.md`).
5. Built front-end assets (`npm run build`) deployed with the release.
6. CI pipeline on `main`/`staging` uses Postgres + pgvector and runs `migrate` before tests.

If any row in section 1 is “Launch” for your contract, do not mark the release complete until its **Verify** column is satisfied on staging.
