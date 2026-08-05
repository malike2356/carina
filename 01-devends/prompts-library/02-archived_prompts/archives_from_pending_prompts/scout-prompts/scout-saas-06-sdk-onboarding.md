# Scout SaaS -- Prompt 6 of 6: SDK + Developer Onboarding
**Status: COMPLETED 2026-07-27**

**What was built:** @scout-security/client TS SDK + Python client; dashboard onboarding/docs

# Build Phase: Developer Experience
# Depends on: Prompt 3 (public API), Prompt 4 (dashboard)
# Blocks: Customer acquisition
# Estimated time: 5-6 hours

## Context

Ship a public client that talks to `/v1` on the standalone engine. Reference implementations (do not depend on them at runtime):

- `carina/03-frontends/sdks/labyrinth-scout-sdk/` (dist-only; design reference)
- `propreneur/.../console.labyrinthscout.com/sdk/node/` and `sdk/python/`
- `@verlox/carina-scout` (Carina-specific; keep separate)

## Task

### Step 1: TypeScript package

Create `/opt/lampp/htdocs/verlox/scout/scout-sdk/`:

```
scout-sdk/
  package.json          # name: @scout-security/client
  tsconfig.json
  src/index.ts
  src/client.ts
  src/middleware.ts
  src/types.ts
  README.md
  examples/basic.ts
  python/scout_client.py
```

`Scout` class methods:

- `registerAgent` -> `POST /v1/agents/register`
- `filter` -> `POST /v1/prompts/filter`
- `trackEvent` -> `POST /v1/events`
- `getStatus` -> `GET /v1/agents/:id/status`

Default `baseUrl`: `process.env.SCOUT_API_URL` or `https://api.scout.security` (local docs use `http://localhost:4444`). Auth: `Authorization: Bearer <apiKey>`.

### Step 2: Python helper

Minimal `requests`-based client mirroring the same four calls under `scout-sdk/python/`.

### Step 3: Dashboard onboarding

`/onboarding` (or `/docs/getting-started`):

1. Show org API key (once)
2. Language choice (Node / Python)
3. Prefill snippet calling register + filter
4. Link to agents list when first agent appears

### Step 4: Docs page

`/docs` markdown or simple pages: Getting Started, API Reference (`/v1/...`), SDK, Security concepts (PromptGuard layers, kill switch), Plans (Free / Monitor £99 / Govern £199 / Team £399), FAQ.

## Acceptance Criteria

- Package builds (`pnpm build` / `tsc`)
- Examples hit public `/v1` contract
- Python client mirrors core methods
- Onboarding + docs reachable from dashboard
- No em dashes/en dashes; no emojis

## Files to Reference

- Public API (Prompt 3): this folder `scout-saas-03-public-api-gateway.md`
- Dashboard: `scout/scout-dashboard/`
- Console SDK reference: `propreneur/.../console.labyrinthscout.com/sdk/`

## Post-build (MANDATORY)

Follow POST-BUILD-CHECKLIST. After this prompt and siblings 1-5 are done:

1. Mark each prompt `**Status: COMPLETED 2026-07-27**` with a short What was built list
2. Move entire `scout-prompts/` to `02-archived_prompts/archives_from_pending_prompts/scout-prompts/`
3. Remove the empty pending `scout-prompts/` directory
4. Update `01-pending_prompts/README.md` archived table
