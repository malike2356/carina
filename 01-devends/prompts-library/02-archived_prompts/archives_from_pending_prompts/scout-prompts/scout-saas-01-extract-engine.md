# Scout SaaS -- Prompt 1 of 6: Isolate Scout-Engine
**Status: COMPLETED 2026-07-27**

**What was built:** Isolated scout/scout-engine: standalone docker-compose (Postgres+Redis), GET /health, local public/, .env.example

# Build Phase: Extract
# Depends on: Nothing
# Blocks: Prompt 2 (multi-tenant DB)
# Estimated time: 2-3 hours

## Context

Scout-engine source was already copied to `/opt/lampp/htdocs/verlox/scout/scout-engine/` (byte-identical to Propreneur). Canonical source remains `propreneur/propreneur-v2/02-backends/scout-engine/` until this prompt finishes isolation. Carina's `carina/02-backends/scout-engine/` is dist-only; do not treat it as source.

The engine still assumes a shared Carina Postgres, serves static UI from a sibling `console.labyrinthscout.com/public` path that does not exist under `scout/`, and has no root `GET /health`. Carina already talks to Scout over HTTP via `@verlox/carina-scout`; do not rebuild that as in-process imports.

## What Already Exists (do not rebuild)

- `src/server.ts` - event ingestion Express server (default port 4444)
- `src/index.ts` - full scan-engine Express entry (same port)
- `src/api/` - REST routes, auth-middleware, openapi
- `src/engine/`, `src/agents/`, `src/scoring/`, `src/alerts/`, `src/db/`, `src/event-server/`, `src/control/`, `src/tools/`, `src/reports/`
- `package.json`, `tsconfig.json`, docker files

## Task

1. Treat `/opt/lampp/htdocs/verlox/scout/scout-engine/` as the SaaS engine root. Re-sync from Propreneur only if the copy drifted; otherwise edit in place under `scout/`.

2. Fix boundary escapes:
   - `src/index.ts` and `src/server.ts` resolve `../../console.labyrinthscout.com/public`. Either vendor a minimal `public/` under scout-engine, or gate static serving behind an optional `SCOUT_DASHBOARD_STATIC_PATH` and skip when missing (do not crash on startup).
   - Confirm no TypeScript imports leave `scout/scout-engine/src/`. Product URLs (e.g. console.labyrinthscout.com links in alert copy) are fine.

3. Replace `docker-compose.yml` so Scout is standalone:
   - `scout-engine` service on host port `${SCOUT_PORT:-4444}`
   - Dedicated PostgreSQL (not Carina's DB), with healthcheck
   - Dedicated Redis, with healthcheck
   - Engine depends on healthy Postgres + Redis
   - Align Dockerfile EXPOSE with `SCOUT_PORT` (today Dockerfile says 4455; fix it)

4. Update `.env.example` with:
   - `DATABASE_URL` / `SCOUT_DATABASE_URL`
   - `REDIS_URL`
   - `SCOUT_PORT` (default 4444)
   - `SCOUT_ENV` (development | staging | production)
   - `SCOUT_API_KEY` / `SCOUT_JWT_SECRET`
   - `CARINA_API_URL` (optional; Scout may call Carina for models later)
   - `ALERT_WEBHOOK_URL` (optional)
   - `SCOUT_DASHBOARD_STATIC_PATH` (optional)

5. Add root `GET /health` on both entry points returning `{ status: "ok", uptime: <seconds>, version: "1.0.0" }` in addition to existing `/api/v1/health`.

6. Document Carina integration: `@verlox/carina-scout` already uses HTTP. Ensure `.env.example` notes that Carina should set `LABYRINTH_URL` / `SCOUT_API_URL` to the standalone engine (e.g. `http://localhost:4444`). Do not invent a second client package here.

## Acceptance Criteria

- `scout/scout-engine` starts without requiring Carina source or Carina DB
- `GET /health` returns 200 with `status: "ok"` and numeric `uptime`
- No required import path escapes `scout/scout-engine/src/`
- `docker-compose.yml` brings up engine + Postgres + Redis with healthchecks
- Existing `/api/v1/health` still works
- Writing style: no em dashes or en dashes; no emojis

## Files to Reference

- Master spec: `/opt/lampp/htdocs/verlox/scout/saas-spec-master.md`
- Extracted engine: `/opt/lampp/htdocs/verlox/scout/scout-engine/`
- Source copy: `/opt/lampp/htdocs/verlox/propreneur/propreneur-v2/02-backends/scout-engine/`
- Carina HTTP client: `/opt/lampp/htdocs/verlox/propreneur/propreneur-v2/02-backends/core.carinaai.uk/packages/scout-client/`

## Post-build (MANDATORY)

Follow `01-devends/prompts-library/00-library-docs/POST-BUILD-CHECKLIST.md`. Archive under `02-archived_prompts/archives_from_pending_prompts/scout-prompts/` only after all 6 prompts are done (batch archive).
