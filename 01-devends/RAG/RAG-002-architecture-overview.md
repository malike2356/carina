# Carina Architecture Overview

## System Architecture Layers

Carina is organized into six layers from bottom to top. Each layer is independently testable and
replaceable.

```
Layer 6: Userspace (tenants, partner workspaces, Aiva workers)
Layer 5: Platform Services (marketplace, partner API, billing, admin)
Layer 4: Scout Security (kill switch, audit, injection shield, egress)
Layer 3: Memory and Knowledge (pgvector RAG, episodic store, REM)
Layer 2: Agent Kernel (orchestrator, tool runtime, provider pool, cron)
Layer 1: Gateway Layer (channel adapters, message router, webhook handlers)
```

## Repository Structure

```
carina/
  01-devends/         Planning, prompts, RAG training data, SOPs
    RAG/              Knowledge documents ingested into pgvector
    SOP/              Operational procedures
    planning/         Historical strategy and build planning
    prompts/          Implementation prompts (pending and archived)

  02-backends/        All backend services
    core.carinaai.uk/           Main Carina agent (Node.js / TypeScript)
    console.labyrinthscout.com/ Scout governance console
    scout-engine/               Scout policy and governance runtime
    admin/ops.carinaai.uk/      VERLOX internal ops panel (port 4002)
    xeclone/                    iLaud multimodal digital twin (in development)

  03-frontends/       All frontend applications
    client-apps/
      app.carinaai.uk/    Workspace web app (Next.js, better-auth)
      admin.carinaai.uk/  Platform admin (Next.js)
      carinaMobile/       Mobile app (React Native / Expo, 583 screens)
      carina-desktop/     Desktop app (Tauri + TypeScript)
    marketing/
      carinaai.uk/        Marketing site
      labyrinthscout.com/ Scout marketing site
      docs.carinaai.uk/   Documentation site
    sdks/               Public SDK packages
```

## Core Backend (core.carinaai.uk)

The main backend is a Node.js / TypeScript Express application. Key top-level source directories:

| Directory | Role |
|---|---|
| `src/api/` | ~70 route modules: gateway, ops, hosted SaaS, Aiva, billing, websocket |
| `src/brain/` | LLM provider registry, model selection, cost tracking |
| `src/channels/` | Channel adapter registry, message router, credential store |
| `src/memory/` | Memory backends (builtin, Postgres, SQLite, Mem0, Honcho), embeddings, RAG, REM |
| `src/tools/` | 136+ tool files covering all agent capabilities |
| `src/skills/` | 23 skill packs + skill curator, brain-knowledge, ingestion pipeline |
| `src/hosted/` | Multi-tenant SaaS: partner service, billing, cloud provisioner, onboarding |
| `src/billing/` | Stripe integration, platform event emitter, usage records |
| `src/infrastructure/` | Database migrations (SQL), Docker, deployment |
| `src/platform/` | Platform knowledge injection (`platform-knowledge.md`, `platform-state.md`) |
| `src/workers/` | Background workers: knowledge-base, aiva-subscription-store |
| `src/ingestion/` | Email ingestion pipeline (IMAP connector, email parser, poller) |
| `src/agents/` | Ambient agents, channel ingestion agent |
| `src/security/` | Security utilities, sandbox |
| `src/tui/` | Terminal UI for operator control |

## Authentication Architecture

Two separate auth systems exist and must not be conflated:

**app.carinaai.uk (better-auth):** The workspace web app uses better-auth (Next.js). Sessions are
cookie-based and scoped to the app domain. This system knows about workspaces, workspace members,
and Stripe subscriptions.

**core.carinaai.uk (express-session):** The core backend uses express-session. Routes protected by
`requireHostedSession` verify the session cookie from the core domain.

**Cross-system calls from app to core** use the ops-token pattern: `CARINA_OPS_TOKEN` in the
Authorization header plus `x-core-org-id` in a custom header. The `requireOpsAuth` middleware on
core verifies the token. The `coreOrgId` (stored in `workspaces.coreOrgId` in the app's SQLite DB)
identifies which organization in core's PostgreSQL the request is acting for.

**Partner API (api.carinaai.uk):** External partner requests use `x-api-key` header. The
`partnerGatewayAuth` middleware validates the key hash against `partner_api_keys` table and
attaches `req.partner` and `req.partnerApiKey` to the request.

**Scout (console.labyrinthscout.com):** Scout uses its own session system. The `authorizeOps`
function checks `x-api-key` against `SCOUT_API_KEY` env var. Redis-based kill-switch state is
checked on every authenticated request.

## Database Architecture

**PostgreSQL (core):** Main operational database. Holds conversations, memory, organizations,
partners, partner API keys, platform events, Aiva workers, Aiva knowledge base, hosted billing
tables, and the `rag_chunks` table (with pgvector extension for vector similarity search).

**SQLite (app.carinaai.uk):** Lightweight database for the Next.js workspace app. Managed by
Drizzle ORM. Holds workspaces, workspace members, sessions, byok keys, usage events, and audit
logs.

**Redis:** Used by core for session storage, channel message routing, background job queues
(BullMQ), and kill-switch state (shared with Scout).

**pgvector:** PostgreSQL extension enabling vector similarity search on the `rag_chunks` table.
Embeddings are generated by Gemini (`text-embedding-004`), Voyage AI, or OpenAI
(`text-embedding-3-small`) depending on which provider keys are configured.

## Deployment

Production runs on Contabo VPS (`aman`) using Docker Compose. Services:
- `verlox/carina` (core backend, port 3000)
- `verlox/scout` (Scout console, port 4444)
- PostgreSQL 16 with pgvector extension
- Redis 7
- Nginx reverse proxy with Let's Encrypt TLS

Deploy scripts: `carina/scripts/deploy-carina.sh`, `deploy-scout.sh`, `deploy-marketing.sh`.

All production changes are made locally and deployed via script or `git pull` on the VPS. Direct
VPS file edits are prohibited.
