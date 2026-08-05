# Scout Pilot Readiness -- Prompt 03 of 05: Production Hosting on console.labyrinthscout.com
**Status: COMPLETED 2026-07-27**

**What was built:** docker-compose.prod.yml; Dockerfiles; nginx snippet; .env.production.example; deploy/README.md

# Build Phase: Deployability
# Depends on: Prompt 01 (engine must be kill-switch aware before public exposure)
# Blocks: Prompt 04 (URLs), Prompt 05 (e2e against host)
# Estimated time: 5-7 hours

## Context

Local SaaS runs on `:3005` / `:4444`. Production Scout today is the **Labyrinth console** compose under Propreneur (`console.labyrinthscout.com` → container on proxy network). Decision: host the **new** customer dashboard at `console.labyrinthscout.com` for the SaaS pilot path, without claiming it has replaced the full Govern console feature set.

**Important coexistence rule:** Do not blindly overwrite the live Labyrinth console deploy. Deliver a **parallel** compose/docs package under `/opt/lampp/htdocs/verlox/scout/` that can be deployed to staging or a clearly named release path. If cutting over DNS, require an explicit operator step in the README (not silent).

## Target topology (preferred)

```
https://console.labyrinthscout.com          -> scout-dashboard (Next)
https://console.labyrinthscout.com/v1/*     -> scout-engine public API   (path proxy)
https://console.labyrinthscout.com/api/*    -> scout-engine dashboard/billing
https://console.labyrinthscout.com/webhooks/stripe -> scout-engine webhook
```

Alternative (also acceptable if documented):

```
https://console.labyrinthscout.com  -> dashboard
https://api.labyrinthscout.com      -> engine
```

Pick **one** and make SDK default + dashboard `NEXT_PUBLIC_SCOUT_API_URL` match.

## Task

### 1. Dockerfiles

**`scout/scout-engine/Dockerfile`**
- Multi-stage: install deps, `pnpm build` / `tsc`, production node image
- Run `node dist/server.js` (or documented entry)
- Include migrations strategy: entrypoint script `migrate && server` **or** separate migrate service
- EXPOSE 4444
- Non-root user if straightforward

**`scout/scout-dashboard/Dockerfile`**
- Multi-stage Next 15 build
- Prefer `output: 'standalone'` in `next.config.mjs` if compatible
- `next start -p 3005` or node standalone server
- Build-arg / env for `NEXT_PUBLIC_SCOUT_API_URL`

### 2. Compose

Create `/opt/lampp/htdocs/verlox/scout/docker-compose.prod.yml`:

Services: `scout-engine`, `scout-dashboard`, `scout-postgres`, `scout-redis`

- Join external Docker network `proxy` (same as existing Carina/Scout prod pattern)
- Healthchecks on engine `/health` and dashboard HTTP
- Env from `.env` / `.env.production.example`
- Do not embed Stripe secrets in the compose file

Reference patterns: `propreneur/propreneur-v2/02-backends/console.labyrinthscout.com/docker-compose.prod.yml`

### 3. Env examples

Create `scout/.env.production.example` (labels only, no live secrets):

```
SCOUT_PORT=4444
DATABASE_URL=
REDIS_URL=
SCOUT_JWT_SECRET=
SCOUT_API_KEY=
NEXT_PUBLIC_SCOUT_API_URL=https://console.labyrinthscout.com
DASHBOARD_ORIGIN=https://console.labyrinthscout.com
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_MONITOR_PRICE_ID=price_1TqyO52WMXleLh8eOoMSRO5a
STRIPE_GOVERN_PRICE_ID=price_1TqyQ02WMXleLh8eAVQHwiRo
STRIPE_TEAM_PRICE_ID=price_1TqyQn2WMXleLh8eUqmCs1Oq
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
```

### 4. Proxy / nginx snippet

Add `scout/deploy/nginx-console-labyrinthscout.conf.snippet` (or markdown with exact location blocks) showing how Carina edge nginx should route console host to dashboard vs `/v1`/`/api`/`/webhooks` to engine.

CORS on engine: allow `DASHBOARD_ORIGIN`.

### 5. Deploy README

`scout/deploy/README.md`:

- Prerequisites (proxy network, DNS, TLS already on edge)
- `docker compose -f docker-compose.prod.yml up -d --build`
- Migrate
- Smoke: `/health`, `/v1/health`, `/login`
- Rollback note: this stack is SaaS pilot; legacy Labyrinth console remains the Carina-integrated product until migrated
- **Do not** run destructive cutover without owner approval

### 6. Engine CORS / trust proxy

Confirm `server.ts` / `index.ts` allow dashboard origin and `trust proxy` for rate limits behind nginx.

## Acceptance Criteria

- `docker compose -f docker-compose.prod.yml config` validates locally
- Engine and dashboard images build successfully on a clean machine (or CI-like local build)
- Documented smoke commands listed and tested at least against local compose with published ports
- Stripe price IDs match SoT only
- No secrets committed
- No em dashes / en dashes / emojis

## Guidance

- Prefer path-based same-host API to avoid CORS pain for pilots.
- Do not delete or rewrite Propreneur console compose in place; add scout/ package beside it.
- If ports conflict with existing `scout-engine:4455` on the VPS, use distinct container names (`scout-saas-engine`, `scout-saas-dashboard`) and document.

## Post-build (MANDATORY)

Follow POST-BUILD-CHECKLIST. Archive folder only after 01-05 complete.
