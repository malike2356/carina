# Carina API Surface and Routes

## Core Backend API (core.carinaai.uk)

The core backend is an Express application. Routes are organized into modules under `src/api/`.
The main server entry point is `src/server.ts`.

### Public and Partner Routes

**Gateway routes (`gateway-routes.ts`):** The primary agent interaction endpoint. Handles incoming
messages from all channel adapters, routes to the agent orchestrator, and streams responses back.

**Partner API gateway (`api.carinaai.uk`):** External API for certified platform partners.
Auth: `x-api-key` header validated by `partner-gateway-auth.ts` middleware.

**Carina Ops routes (`carina-ops-routes.ts`):** Internal operations API protected by
`requireOpsAuth` (bearer token: `CARINA_OPS_TOKEN`). This is the route module used by
`app.carinaai.uk` for cross-system calls using the ops-token + `x-core-org-id` pattern.

Key ops route groups:
- `GET/POST /api/carina-ops/partner/api-keys` - partner self-service key management
- `DELETE /api/carina-ops/partner/api-keys/:keyId` - key revocation
- `GET /api/carina-ops/partner/usage` - usage analytics with date range and groupBy
- `GET /api/carina-ops/partner/usage/export` - CSV export
- `GET /api/carina-ops/internal/marketplace/submissions` - marketplace queue
- `PATCH /api/carina-ops/internal/marketplace/submissions/:id` - review (approve/reject)
- `POST /api/carina-ops/internal/marketplace/submissions/:id/publish` - publish to hub
- `GET /api/carina-ops/internal/partners` - partner list with metrics
- `GET /api/carina-ops/internal/partners/:id/detail` - partner detail snapshot
- `PATCH /api/carina-ops/internal/partners/:id/status` - suspend/reactivate
- `DELETE /api/carina-ops/internal/partners/:id/keys/:keyId` - admin key revoke
- `POST /api/carina-ops/rag/upload/file` - ingest a file (binary body, x-filename header)
- `POST /api/carina-ops/rag/upload/text` - ingest pasted text (JSON: text, title, pack)
- `POST /api/carina-ops/rag/upload/url` - fetch and ingest a URL (JSON: url, pack)
- `GET /api/carina-ops/rag/sources` - paginated list of ingested sources with chunk counts
- `DELETE /api/carina-ops/rag/sources` - delete all chunks for a source
- `GET /api/carina-ops/rag/search` - semantic search preview (q, limit params)
- `GET /api/carina-ops/rag/status` - embedding provider status and total chunk count

### Hosted SaaS Routes

**Hosted auth (`hosted-auth.ts`):** Session login/logout for the hosted web app.

**Hosted web (`hosted-web.ts`):** Web UI serving for the hosted deployment.

**Hosted billing (`hosted-billing.ts`):** Stripe subscription management and webhook handling.
Receives `POST /webhooks/stripe` events, updates subscription state, provisions/deprovisions
workspaces.

**Hosted push (`hosted-push.ts`):** Web push notification subscriptions for the hosted app.

**Hosted Scout (`hosted-scout.ts`):** Bridge between the hosted SaaS layer and Scout console.
Proxies tenant agent activity to Scout for fleet monitoring.

### Agent and Session Routes

**Memory API (`memory-api.ts`):** CRUD for persistent memories. `GET/POST/DELETE /api/memory`.

**Process API (`process-api.ts`):** Manage background processes started by the `process` tool.
`GET /api/processes`, `DELETE /api/processes/:id`.

**Packs API (`packs-api.ts`):** Skill pack management. List, get, enable, disable packs.

**Curator API (`curator-api.ts`):** Skill curation interface. Create, update, delete skills.

**Cookbook API (`cookbook-api.ts`):** Cookbook (saved prompts/workflows) management.

**Scheduled API (`scheduled-api.ts`):** Manage scheduled tasks created by the `cronjob` tool.

**Webhook API (`webhook-api.ts`):** Manage outbound webhooks registered by the `webhook` tool.

**Terminal WS (`terminal-ws.ts`):** WebSocket endpoint for PTY terminal sessions (browser
terminal feature).

**Learning API (`learning-api.ts`):** Reinforcement learning signals and feedback recording.

### Integration Routes

**Aiva API (`aiva-api.ts`):** Aiva worker management: create, configure, list, delete workers,
knowledge base CRUD, channel binding.

**Aiva Email API (`aiva-email-api.ts`):** IMAP connection management for Aiva email ingestion.

**Aiva Propreneur Webhook (`aiva-propreneur-webhook-api.ts`):** Propreneur event receiver.

**Calendar API (`calendar-api.ts`):** Google Calendar integration routes.

**Trello API (`trello-api.ts`):** Trello board management.

**Kanban API (`kanban-api.ts`):** Internal Kanban board operations.

**Cyber Tools API (`cyber-tools-api.ts`):** Security tools endpoint (requires cyber auth).

**MCP API (`mcp-api.ts`):** Model Context Protocol server management.

**LSP API (`lsp-api.ts`):** Language Server Protocol integration.

**TTS API (`tts-api.ts`):** Text-to-speech generation endpoint.

**Research API (`research-api.ts`):** Research tool session management (R, PSPP, Jamovi).

**Theme API (`theme-api.ts`):** UI theme CRUD.

**Locale API (`locale-api.ts`):** Internationalisation locale management.

**Workspace Presets API (`workspace-presets-api.ts`):** Saved workspace configurations.

**Desktop API (`desktop-api.ts`):** Desktop app specific endpoints.

**Marketplace API (`marketplace-api.ts`):** Hub marketplace proxy (Carina-to-hub).

**Compare API (`compare-api.ts`):** Model comparison and benchmarking.

**Control Routes (`control-routes.ts`):** Operator control panel (agent start/stop, config).

**Ops Routes (`ops-routes.ts`):** VERLOX internal ops panel routes.

**Observability Routes (`observability-routes.ts`):** Metrics, health, telemetry.

**Email Webhook (`email-webhook.ts`):** Inbound email webhook for email-to-agent routing.

**Pairing Routes (`pairing-routes.ts`):** Agent-to-agent pairing for cross-agent collaboration.

**OpenAI Compatible API (`openai-compatible/`):** OpenAI-compatible chat completions, embeddings,
and responses endpoint for drop-in compatibility with OpenAI SDK clients.

**Public Pricing (`public-pricing.ts`):** Unauthenticated pricing tier information endpoint.

**Subscribe (`subscribe.ts`):** Email newsletter or update subscription.

**Tenant Keys (`tenant-keys.ts`):** Tenant-level API key management for hosted deployments.

**Web Auth API (`web-auth-api.ts`):** Web authentication helpers.

### Internal APIs

**Internal Calendar API (`internal-calendar-api.ts`):** Internal calendar operations.

**Internal Research API (`internal-research-api.ts`):** Internal research session management.

**Internal Transactional API (`internal-transactional-api.ts`):** Internal transactional emails
and notifications.

**Incident Blog (`incident-blog.ts`):** Incident post publishing (status page integration).

**Billing Routes (`billing-routes.ts`):** Stripe webhook receiver and billing state management.

## app.carinaai.uk API Routes (Next.js)

The Next.js workspace app exposes API routes under `/api/`. These proxy to core via
`proxyToCoreApi()` (for ops-token calls) or handle app-layer logic directly.

Key route groups:
- `/api/developer/keys` - partner API key self-service (proxies to ops routes)
- `/api/developer/usage` - usage analytics (proxies to ops routes)
- `/api/developer/usage/export` - CSV export
- `/api/workspace/` - workspace management
- `/api/auth/` - better-auth session management
- `/api/billing/` - Stripe billing (app layer)

## admin.carinaai.uk API Routes (Next.js)

Admin app routes proxy to core via `proxyAdminRequest()` which calls `coreAdminFetchRaw()`
internally. Auth is handled automatically via the `requireAdminSession` middleware on core.

Key route groups:
- `/api/admin/partners/` - partner management
- `/api/admin/marketplace/submissions/` - marketplace review queue
- `/api/admin/customers/` - customer organization management
- `/api/admin/billing/` - billing overview

## Scout Console API (console.labyrinthscout.com)

Scout exposes 57 API modules. Auth: `x-api-key` header checked by `authorizeOps()` against
`SCOUT_API_KEY` env var. Redis kill-switch state is checked on every authenticated request.

Key endpoints:
- `POST /api/kill` - kill switch (halt all agents)
- `POST /api/resume` - resume after kill
- `GET /api/dashboard` - main dashboard data
- `GET /api/audit-search` - search immutable audit log
- `GET /api/compliance` - generate compliance evidence package
- `GET /api/export` - export audit log (JSON or CSV)
- `POST /api/events` - ingest agent security event
- `GET /api/heartbeat` - agent heartbeat check
- `GET /api/public-trust` - unauthenticated trust score API
- `PATCH /api/instances/:id` - manage agent instance registration
- `POST /api/honeypots` - deploy honeypot credentials
- `PATCH /api/egress-control` - update egress blocklist

## Skills Hub API (carina-hub, port 3001)

The skills hub is a separate service managing the marketplace. Auth: `Authorization: Bearer
<SKILLS_HUB_PUBLISH_KEY>` on operator routes.

Key endpoints:
- `GET /api/submissions` - list pack submissions (paginated, filterable by status)
- `GET /api/submissions/:id` - single submission detail
- `PATCH /api/submissions/:id` - update status (approve/reject with reviewer notes)
- `POST /api/submissions/:id/publish` - publish approved submission to registry
