# SOP 003: Internal Architecture
**Classification:** Internal VERLOX only. Do not share externally.
**Source:** Migrated from planning/docs/ARCHITECTURE.md
**Last reviewed:** 2026-06-25

---

# Carina / Labyrinth Scout: Internal Architecture Guide

Internal reference for VERLOX. Explains what each piece in this monorepo is, who it is for, and exactly how they talk to each other. Read this before changing any cross-project wiring (env vars, API routes, Redis channels).

## Product map (2026-06)

| Host | Product | Audience | Container | Port |
|---|---|---|---|---|
| app.carinaai.uk | Aiva workspace (managed AI employee) | Paying and trial tenants | carina-cloud | 4100 |
| admin.carinaai.uk | Aiva business ops | VERLOX internal only | carina-admin | 4200 |
| core.carinaai.uk | Carina backend API | All services + self-hosters | carina-web | 3000 |
| ops.carinaai.uk | VERLOX engineering panel | VERLOX internal only | carina-ops | 4001 (prod) / 4000 (dev) |
| hub.carinaai.uk | Skills Hub | Carina operators | carina-hub | 3001 |
| console.labyrinthscout.com | Labyrinth Scout server | Carina self-hosters (optional) | labyrinth-scout | 4444 |
| carinaai.uk / labyrinthscout.com | Marketing | Public | nginx static | 80/443 |

**Products summary:**
- **Carina:** open-source AI agent engine, MIT license, self-hosted or Docker
- **Aiva:** managed AI employee product built on Carina, sold via app.carinaai.uk
- **Scout:** separate governance product at console.labyrinthscout.com / labyrinthscout.com

Full tenant documentation: `docs.carinaai.uk/docs/user/` (published at carinaai.uk/docs).

## The main pieces

| Piece | Directory | Port (local) | Audience | Shipped to customers? |
|---|---|---|---|---|
| Carina API | `core.carinaai.uk/` | 3333 (dev) / 3000 (prod container) | End users, operators, Aiva | Yes - npm package + Docker image |
| Aiva workspace (Next.js 15) | `external/client-apps/app.carinaai.uk/` | 4100 | Paying tenants | Yes - Docker image |
| Aiva admin (Next.js 15) | `external/client-apps/admin.carinaai.uk/` | 4200 | VERLOX only | No - internal |
| Ops panel (Express/EJS) | `internal/admin/ops.carinaai.uk/` | 4000 (dev) / 4001 (prod) | VERLOX only | No - never shipped |
| Skills Hub | `internal/servers/hub.carinaai.uk/` | 3001 | Operators | Yes |
| Carina marketing site | `carinaai.uk/` | static | Prospects | Yes - static files to carinaai.uk |
| Labyrinth Scout console | `console.labyrinthscout.com/` | 4444 | Carina operators who buy security monitoring | Yes - Docker image |
| Scout marketing site | `labyrinthscout.com/` | static | Prospects | Yes - static files to labyrinthscout.com |
| Carina IDE extensions | `extensions/carina-ide/`, `extensions/carina-jetbrains/` | n/a | VS Code, Cursor, Zed, JetBrains users | Yes - VSIX/ZIP |

**Two product lines live in this repo:**
- **Carina** - the AI agent itself. MIT licensed, always free.
- **Labyrinth Scout** - the optional security add-on that watches Carina instances for misbehaviour (prompt injection, runaway tool use, secret leakage, etc).

`ops.carinaai.uk` is the VERLOX engineering control room: it talks to the Carina core API over HTTP and to Scout over its admin API. `admin.carinaai.uk` is the VERLOX business operations panel: it manages customer workspaces, subscriptions, fleet, and revenue.

## How they connect

### 1. Carina -> Scout: security event reporting

```
Carina agent  ->  src/security/scout-client.ts  ->  POST {SCOUT_URL}/api/events
                                                  ->  POST {SCOUT_URL}/api/heartbeat
```

- `scout-client.ts` batches `ScoutEvent` records (severity, source, event_type, description, metadata, session_id, instance_id) and POSTs them to the paired Scout console.
- Auth is a shared secret: every request carries `X-Scout-Key: {SCOUT_API_KEY}`. Scout validates this against the API keys it issued.
- `sanitiseParams()` redacts anything that looks like a secret (API key patterns, bearer/basic auth headers, 64-char hex blobs) before it ever leaves the Carina process. Scout never sees raw credentials.
- Reporting is fire-and-forget with a 2-second timeout. **Scout never blocks Carina.** If Scout is unreachable, Carina logs a warning once and keeps running normally.
- Controlled entirely by env vars; `LABYRINTH_ENABLED=false` means zero integration, Carina behaves identically.

### 2. Scout -> Carina: the kill switch (control channel)

```
Scout  ->  Redis pub: "labyrinth:control"  ->  src/security/kill-switch-listener.ts
```

- This is the reverse direction: Scout can reach back into a running Carina instance and constrain it, without Carina polling anything.
- `kill-switch-listener.ts` subscribes to the Redis channel `labyrinth:control` and applies payloads addressed to its own `instance_id` (others are ignored):
  - `suspend` / `resume` - halts/resumes the whole agent
  - block a specific session
  - quarantine a specific tool for this instance (in-memory, lost on restart)
  - operator-blocked egress domains (in-memory, lost on restart)
  - per-session rate-limit overrides
- All suspension events are appended to `data/logs/labyrinth-suspend.log` for audit.
- This is a one-way trust relationship: Scout can throttle or stop Carina, Carina cannot reach into Scout's policy engine.

### 3. Pairing: how a Carina instance connects to a Scout account

Five env vars on the Carina side drive the whole integration:

```
LABYRINTH_ENABLED=true
LABYRINTH_URL=<tenant Scout console URL from provisioning email>
LABYRINTH_API_KEY=lscout_...
LABYRINTH_INSTANCE_ID=carina-{hostname}
LABYRINTH_INSTANCE_NAME=Carina ({hostname})
```

Two ways to populate them:

1. **First-run setup wizard** (`core.carinaai.uk/src/setup/wizard.ts`): after choosing an LLM provider, the wizard asks "Connect to Labyrinth Scout?" If yes, it prompts for the console URL and API key, derives instance identifiers from `os.hostname()`, and writes all five vars into the new `.env`.
2. **Ops settings panel** (`ops.carinaai.uk/routes/settings.ts`, route `POST /settings/scout-pairing`): lets VERLOX paste a Scout API key into a running ops instance after the fact.

**Customer onboarding:** Customers subscribe via Stripe checkout or Aiva plan. VERLOX provisions the Scout account and emails the private console URL and API key. Self-serve `/account/register` on the console host remains for operators who already know the URL.

### 4. The Scout account system

`console.labyrinthscout.com` has per-operator accounts:

- `accounts` / `account_api_keys` tables (see `src/migrations.ts`, runs automatically on startup via `initDb()` -> `runMigrations()`)
- `src/api/account.ts` mounted at `/account` - registration/login/key management pages
- Every event/status/heartbeat API route requires `requireApiKey` middleware, validated against `account_api_keys`

### 5. ops.carinaai.uk: VERLOX engineering panel

`ops.carinaai.uk` (port 4001 prod / 4000 dev, password-gated, VERLOX only) is a thin Express/EJS panel that proxies into both products:

```
ops.carinaai.uk  --[fetch http://carina-web:3000/api/...]-->  Carina API (CARINA_API_URL)
ops.carinaai.uk  --[scoutGet() -> http://scout-console:4444/api/...]-->  Scout console (SCOUT_URL, requires X-Scout-Key)
```

Ops panel features: Chat with Carina agent, Memories, RAG, Skills, Security (Scout proxy), Control Centre, Tenants, Subscriptions, AI Platform, Channels, Terminal (TUI/PTY), MCP, Projects, Incident Blog, Packs, Agent Tools, Settings, Operator panel.

### 6. admin.carinaai.uk: VERLOX business ops panel

`admin.carinaai.uk` (port 4200, TOTP 2FA, VERLOX only) is a Next.js 15 application for Aiva business operations:

- `/` Dashboard
- `/customers` - all workspaces
- `/customers/[id]` - workspace detail
- `/fleet` - all Aiva workers
- `/fleet/attestation` - cryptographic audit log
- `/revenue` - Stripe revenue view
- `/va-queue` - human VA handoff queue
- `/audit-log` - platform audit log

Auth: TOTP 2FA. Not accessible to customers.

### 7. Aiva built-in governance (no Scout subscription required)

Aiva plans include built-in governance monitoring in the Carina runtime:

- Volume spike detection
- Escalation rate tracking
- Unauthorized tool detection
- Operator kill switch
- Cryptographic audit log: SHA-256 content hash per action, stored in a tamper-evident PostgreSQL audit log. No customer data leaves VERLOX infrastructure.

Scout is a separate product for Carina self-hosters who want external cross-agent governance. Scout connects to Carina via `SCOUT_KEY` env var. Setting `LABYRINTH_ENABLED=false` means zero Scout integration; Carina runs identically without it.

### 8. Carina IDE extensions (VS Code, Cursor, Zed, JetBrains)

```
IDE client  ->  extensions/carina-ide | carina-jetbrains  ->  POST {CARINA_URL}/acp/ide/chat
                                                         ->  GET  {CARINA_URL}/acp/ide/capabilities
                                                         ->  GET  {CARINA_URL}/acp/tools
```

- VS Code / Cursor / Zed: `extensions/carina-ide/` (TypeScript, VSIX packages).
- JetBrains (IDEA, WebStorm, PyCharm, etc.): `extensions/carina-jetbrains/` (Java, Gradle plugin ZIP).
- All connect to a running Carina gateway (`carina web` or `carina serve`, default port 3000).
- Build: `carina ide build` or `carina ide install [vscode|cursor|zed|jetbrains|all]`.

### 9. The marketing sites

Both `carinaai.uk/` and `labyrinthscout.com/` are static HTML/CSS/vanilla-JS sites with no backend of their own.

- They share a single subscribe endpoint: `POST https://carinaai.uk/api/subscribe` (handled by `core.carinaai.uk`'s `subscribeRouter`) for waitlist signups.
- `labyrinthscout.com` funnels to Stripe checkout and docs; the hosted console URL is emailed at provisioning (not linked publicly).
- Deployed independently: plain `rsync` of static files to `/www/wwwroot/{domain}/` on the Contabo VPS. No build step; nginx serves the files directly.
- Deploy command: `bash scripts/deploy-marketing.sh carina`

## Aiva tenant data model

The `carina_cloud` database holds Aiva tenant data:

| Table | Purpose |
|---|---|
| `hosted_users` | Account, tier, message quota, `api_key`, `schema_name` |
| `subscriptions` | Stripe plan, status, trial_ends_at |
| `usage_records` | Monthly messages/cost per tenant |
| `tenant_provider_keys` | Encrypted BYOK credentials |
| `invoices`, `stripe_events` | Billing audit |

Each user gets an isolated Postgres schema for memories/skills.

### Aiva plan tiers

| Plan | Price | Messages | Workers | Notes |
|------|-------|----------|---------|-------|
| trial | Free | 200 | 1 | 15 days; no card required |
| starter | GBP 49/mo | 2,000 | 1 | |
| team | GBP 99/mo | 10,000 | 5 | |
| business | GBP 299/mo | Unlimited | Unlimited | Aiva training, custom governance rules |

Trial warning emails fire at days 12, 13, 14 (08:00 UTC). Suspension via `suspendSubscription()` on day 15.

Stripe Checkout triggered after trial ends via `POST /api/aiva/billing/checkout` -> `createAivaCheckoutSession()`.

Stripe webhook endpoint: `POST https://core.carinaai.uk/webhooks/stripe`

Note: Stripe credentials are not yet set on the VPS (`STRIPE_SECRET_KEY` etc. still blank as of 2026-06-25).

### Tenant-facing routes (app.carinaai.uk)

| Route | Purpose |
|---|---|
| `/register`, `/onboarding` | Self-sign-up and setup wizard |
| `/aiva` | Manage Aiva worker(s) |
| `/settings` | BYOK provider keys |
| `/billing` | Stripe Checkout / Portal |
| `/governance` | Built-in governance monitoring |

## Deployment summary

| Piece | Container | VPS location | Port |
|---|---|---|---|
| `core.carinaai.uk` | carina-web | `~/apps/core.carinaai.uk/` | 3000 |
| `app.carinaai.uk` | carina-cloud | same compose stack | 4100 |
| `admin.carinaai.uk` | carina-admin | same compose stack | 4200 |
| `ops.carinaai.uk` | carina-ops | same compose stack | 4001 |
| `hub.carinaai.uk` | carina-hub | same compose stack | 3001 |
| `console.labyrinthscout.com` | labyrinth-scout | `~/apps/console.labyrinthscout.com/` | 4444 |
| `carinaai.uk` / `labyrinthscout.com` | nginx static | `/www/wwwroot/{domain}/` | 80/443 |

VPS: Contabo 80.190.81.208, SSH alias: `aman`, user: `malike`.

Full deploy: `bash scripts/deploy-carina.sh` from repo root.

## DB migrations

Migrations run inline via `src/memory/migrations.ts` through `runMigrations()` at startup. The SQL files in `src/infrastructure/migrations/` are documentation only and are not run directly.

## Trust model, in one paragraph

Carina is the product; Scout is the optional supervisor. Carina pushes sanitised telemetry to Scout and never blocks on the response. Scout can push back through a single Redis channel to suspend, throttle, or quarantine a specific Carina instance, and every such action is logged for audit. Neither side can read the other's secrets: Carina redacts before sending, and pairing is via scoped per-account API keys rather than a shared master secret. `ops.carinaai.uk` is a human-facing proxy over both engineering concerns, kept intentionally thin so it never becomes a third source of truth. `admin.carinaai.uk` is the business-facing panel for VERLOX operators managing the Aiva product.
