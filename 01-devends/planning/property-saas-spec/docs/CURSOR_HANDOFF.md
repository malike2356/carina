# Carina AI - Cursor Handoff Prompt

**Copy everything below this line and paste it as your first message to Cursor.**

---

## Project Context

You are building **Carina AI** - a standalone property intelligence platform by VERLOX Ltd. It is a multi-tenant SaaS where each subscriber gets their own PostgreSQL database (database-per-tenant via stancl/tenancy v3). Users talk to an AI assistant trained on UK property law, HMO licensing, deal analysis, and compliance.

Full specification is in `/architecture/` (27 documents). The authoritative build order is in `BUILD_SEQUENCE.md` (61 steps, 14 phases). You must follow `CODING_STANDARDS.md` at all times.

**Repository root:** `Carina-ai/`
**Working directory for Laravel:** `Carina-ai/laravel/`
**Working directory for Python:** `Carina-ai/python/`

---

## Stack

| Layer | Technology |
|---|---|
| Laravel | 12, PHP 8.3 |
| Python | 3.12, FastAPI + Celery |
| Database | PostgreSQL 16 + pgvector (one DB per tenant) |
| Cache/Queue | Redis 7 |
| Search | Meilisearch |
| Frontend | Blade + Alpine.js + Tailwind v4 CDN (no build step in dev) |
| Multi-tenancy | stancl/tenancy v3 (database-per-tenant) |
| Auth | Laravel Sanctum (API) + standard web session auth |
| Dev environment | Docker Compose - `docker compose up` boots all 7 services |

---

## What Has Been Built (Phase 0 - Complete)

Phase 0 of BUILD_SEQUENCE.md is done. Here is the exact state:

### Files created
```
Carina-ai/
├── docker-compose.yml              # All 7 services: nginx, laravel, python-api, celery, postgres, redis, meilisearch
├── docker/
│   ├── Dockerfile.laravel          # PHP 8.3-FPM-Alpine with all extensions
│   ├── laravel/entrypoint.sh       # Waits for PG, runs migrations, starts FPM
│   ├── nginx/default.conf          # Reverse proxy: PHP→laravel:9000, /py/→python-api:8001
│   └── postgres/init.sql           # Enables pgvector + uuid-ossp on startup
├── laravel/
│   ├── .env                        # Configured for Docker (pgsql, redis, meilisearch)
│   ├── .env.example
│   ├── config/database.php         # Default changed to pgsql
│   ├── config/tenancy.php          # Tenant model = App\Models\Tenant, central_domains set
│   ├── bootstrap/providers.php     # TenancyServiceProvider registered
│   ├── app/Models/Tenant.php       # Extends BaseTenant, implements TenantWithDatabase
│   ├── app/Http/Controllers/Auth/
│   │   ├── LoginController.php     # show, store, destroy
│   │   └── RegisterController.php  # Validates, creates User + Tenant + Domain
│   ├── routes/web.php              # /, /login, /register, /dashboard, /logout
│   ├── routes/tenant.php           # Tenant domain routes (stancl stub)
│   ├── resources/views/
│   │   ├── layouts/app.blade.php   # Tailwind CDN layout
│   │   ├── auth/login.blade.php
│   │   ├── auth/register.blade.php
│   │   └── dashboard.blade.php     # Post-login page showing plan/token info
│   └── database/migrations/
│       ├── (standard Laravel + stancl migrations)
│       ├── 2026_05_08_100000_add_plan_to_tenants_table.php
│       └── tenant/                 # Empty - tenant-specific migrations go here
└── python/
    ├── Dockerfile                  # Python 3.12-slim
    ├── app.py                      # FastAPI: GET /health, GET /
    ├── tasks.py                    # Celery app skeleton
    └── requirements.txt            # fastapi, uvicorn, celery, psycopg2, sqlalchemy
```

### How to run
```bash
cd Carina-ai
docker compose up --build       # First time (builds images, ~3-5 min)
docker compose up               # Subsequent starts (~30s)
```

Open: http://localhost - you get the login page.
Register at http://localhost/register - creates a user + tenant database automatically.

### Key architecture notes
- Central domain is `localhost` (dev) / `carina.verlox.uk` (prod). Set via `CENTRAL_DOMAIN` env var.
- On registration, `RegisterController` creates: User (central DB) + Tenant (central DB) + Domain (`{slug}.localhost`).
- When a tenant domain is accessed (e.g. `john-abc12.localhost`), tenancy initialises and switches DB context.
- Tenant databases are named `tenant{uuid}` - auto-created by stancl on `Tenant::create()`.
- Python API is accessible at http://localhost/py/ (nginx proxies to python-api:8001).

---

## What To Build Next (Phase 1 - Your Sprint)

**Reference documents to read first:**
1. `BUILD_SEQUENCE.md` - steps 7-12
2. `architecture/PROVIDER_ROTATION.md` - the AI router design
3. `architecture/API_SPEC.md` - full API endpoint specs

### Step 7: AiRouterService (core of Phase 1)

File: `laravel/app/Services/AiRouterService.php`

This is the most important class in Carina. It:
- Takes a message + context
- Resolves which AI provider to use (DeepSeek → OpenAI → Anthropic, cost-priority)
- Calls the provider API
- Returns a normalised response + token usage
- Has circuit breaker: if a provider fails 3x in 5 min, skip it

```php
// Interface to implement:
interface AiRouterInterface
{
    public function chat(string $message, array $context = [], ?string $tenantId = null): AiResponseData;
    public function stream(string $message, array $context = [], ?string $tenantId = null): Generator;
    public function resolveProvider(?string $tenantId = null): string;
}
```

The provider priority order (from `architecture/PROVIDER_ROTATION.md`):
1. DeepSeek V4 Flash (1.0x cost multiplier) - default
2. OpenAI GPT-4o-mini (2.0x) - fallback
3. Anthropic Claude (3.5x) - fallback

Use DTOs for inputs/outputs. See `CODING_STANDARDS.md` - DTOs over raw arrays.

### Step 8: Chat API endpoint

File: `laravel/routes/api.php`
Controller: `laravel/app/Http/Controllers/Api/ChatController.php`

```
POST /api/v1/chat         - sends message, returns full reply
POST /api/v1/chat/stream  - SSE streaming (use Server-Sent Events)
```

Protect with `auth:sanctum` middleware. Tenant context from authenticated user's tenant.

### Step 9: RAG Engine (port from Propreneur)

Files:
- `laravel/app/Services/Rag/RagService.php` - main service
- `laravel/app/Services/Rag/ChunkingService.php` - splits docs into chunks
- `laravel/app/Services/Rag/EmbeddingService.php` - calls Gemini/OpenAI for embeddings

Tenant migration needed: `database/migrations/tenant/create_rag_chunks_table.php`

```sql
rag_chunks:
  id uuid pk
  tenant_id string (for cross-query safety)
  document_id uuid
  content text
  embedding vector(1536)  -- pgvector column
  metadata jsonb
  created_at, updated_at
```

Each RAG query: embed the user question → cosine similarity search on rag_chunks → inject top-5 results into LLM system prompt.

### Step 10: Basic web chat UI

File: `laravel/resources/views/chat/index.blade.php`

Simple chat interface:
- Left sidebar: conversation list
- Main area: message thread
- Bottom: message input + send button
- Stream responses using EventSource (SSE) connected to POST /api/v1/chat/stream

Route: `GET /chat` → `ChatController@index` (tenant-aware, auth required)

### Step 11: Python ML health endpoint

File: `python/app.py` - add proper health check with DB + Redis connectivity
File: `python/models/` - create stub model files: `valuation.py`, `area_scoring.py`, `risk.py`

The Python service currently has just a health endpoint. For Phase 1, it only needs to respond to Laravel's health checks. Real ML models come in Phase 5.

### Step 12: Tests

Framework: Pest (already in composer.json as dev dependency - run `composer require --dev pestphp/pest pestphp/pest-plugin-laravel --no-interaction` if not installed).

Write tests in `laravel/tests/Feature/`:
- `AiRouterTest.php` - mock providers, test fallback chain
- `ChatApiTest.php` - POST /api/v1/chat returns 200 with message
- `RegistrationTest.php` - registration creates user + tenant + domain

Coverage gate: 80% feature tests.

---

## Coding Standards (Non-Negotiable)

From `CODING_STANDARDS.md`:
1. Functions under 20 lines, classes under 200 lines
2. DTOs over raw arrays - use `readonly class FooData { public function __construct(...) {} }`
3. No unused imports, no dead code, no speculative abstractions
4. Linear flow - max 3-4 injected dependencies per service
5. Simplest correct solution - no repository layer unless 2 implementations exist
6. Names make comments unnecessary
7. If a junior can't read it in 30 seconds, simplify it

**Naming:**
- PHP Classes: PascalCase (`AiRouterService`)
- PHP Methods: camelCase (`calculateYield`)
- DB tables: snake_case plural (`rag_chunks`, `usage_log`)
- API routes: kebab-case (`/v1/chat/stream`)
- DTOs: PascalCase + Data suffix (`AiResponseData`)

**Security:**
- All DB queries via Eloquent or prepared statements - never string concatenation
- Tenant data scoped by `tenant_id` on every pgvector query
- Prompt injection guard on every LLM input
- API keys in `.env` only, never hardcoded

---

## Environment Variables (add to .env when ready)

```bash
# AI Providers - add your live keys
DEEPSEEK_API_KEY=sk-...
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=AIza...

# For Stripe billing (Phase 3)
STRIPE_KEY=pk_test_...
STRIPE_SECRET=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

---

## Useful Docker Commands

```bash
# Run artisan
docker compose exec laravel php artisan migrate
docker compose exec laravel php artisan tinker

# Run tests
docker compose exec laravel ./vendor/bin/pest

# Tail logs
docker compose logs -f laravel
docker compose logs -f python-api

# Rebuild after composer changes
docker compose build laravel
docker compose up laravel --no-deps

# Connect to postgres
docker compose exec postgres psql -U carina -d carina_central

# Shell into laravel container
docker compose exec laravel bash
```

---

## Phase Build Sequence Reference

For the full 61-step sequence, read `BUILD_SEQUENCE.md`. Summary of remaining phases:

| Phase | Steps | Goal |
|---|---|---|
| **P1: Chat + AI** (current) | 7-12 | AiRouterService, Chat API, RAG, streaming |
| **P2: Web + PWA** | 13-18 | Full chat UI, PWA service worker, file uploads |
| **P3: Billing** | 19-24 | Token metering, Stripe, usage dashboard |
| **P4: Knowledge** | 25-30 | Document upload, URL training, content generation |
| **P5: ML Engine** | 31-36 | FastAPI models: valuation, area scoring, risk |
| **P6: Data APIs** | 37-40 | PropertyData.co.uk, Tavily, EPC integration |
| **P7+** | 41-61 | Community, gamification, mobile apps, SDKs |

**First paying users: Phase 3 complete (approx week 10).**

---

## Related Projects

- **Propreneur v2** at `/opt/lampp/htdocs/VERLOX/propreneur/propreneur-v2/` - the CRM/MIS product. Has working implementations of AiRouterService and RAG that can be ported directly. Check `app/Services/Carina/` in that repo.
- **Contabo VPS** - production server where both products will live. Deploy via Docker Compose + SSH.

---

*Phase 0 built by Claude Code (claude-sonnet-4-6) on 2026-05-08. Continue from Phase 1 Step 7.*
