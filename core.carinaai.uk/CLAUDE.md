# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Map

```
Carina-ai/
│
├── src/                    CARINA AGENT - Node.js/TypeScript autonomous AI agent
│   ├── agents/             CarinaAgent, CarinaOrchestrator, sub-agents
│   ├── brain/              LLMRouter (23 providers), credential pools, task classifier
│   ├── config/             Central config, env loading, path constants
│   ├── gateway/            18 channel adapters, web UI, router, ACP/IDE hooks
│   ├── memory/             Pluggable backends, episodic store, REM, pgvector RAG
│   ├── security/           Scout client, prompt guard, kill switch listener
│   ├── skills/             16 packs, hub, auto-writer, curator
│   ├── tools/              71 tools across toolsets (registry + browser, MCP, etc.)
│   ├── commitments/        Inferred follow-up memories (opt-in)
│   ├── workspaces/         Named agent workspaces and routing
│   ├── ops/                Sandbox, DNS, proxy, backup, secrets, audit
│   ├── infrastructure/     Host service, device pairing, control auth
│   ├── api/                Hosted mode auth, email webhook, subscribe, Skills Hub
│   ├── setup/              First-run wizard, pack installer
│   └── types/              Shared TypeScript interfaces
│
├── bin/carina.ts           Global CLI entry point (npm install -g carina-agent)
├── brain/                  Property knowledge docs - source for property-uk RAG corpus
│
├──  ../ops.carinaai.uk/         VERLOX PRIVATE - never shipped to customers
│   ├── server.ts           Entry point (port 4000)
│   ├── routes/             Chat, Security (Scout proxy), Memories, Skills, RAG, Projects
│   ├── views/              EJS templates
│   ├── middleware/auth.ts  Single-admin password session
│   ├── lib/                DB helpers, Scout proxy helper, project store
│   └── prompts/            01-security-tab.md, 02-chat-tab-fix.md
│
├── console.labyrinthscout.com/         LABYRINTH SCOUT SERVER - built and shipped
│   ├── src/                    Server code, trust API, account system
│   ├── public/                 Dashboard HTML
│   └── prompts/                Build prompts (01-dashboard.md through 12-sdk.md)
│
├── labyrinthscout.com/     SCOUT MARKETING SITE
│   └── index.html          labyrinthscout.com landing page (+ style.css, app.js)
│
├── carinaai.uk/            CARINA MARKETING SITE - carinaai.uk landing page
│   └── index.html, style.css, app.js
│
├── docs/                   LEGACY VITEPRESS (see docs.carinaai.uk/)
├── prompts/                CARINA BUILD PROMPTS ONLY
│   ├── project-prompt.md   Master context for Carina
│   └── phase-*.md          Build phase specs (all 5 phases complete)
│
├── docker/                 Docker configs (Carina only - no Laravel files)
│   ├── Dockerfile.carina
│   ├── nginx/              carina-prod.conf (SSL, all subdomains)
│   └── postgres/init.sql
│
├── archive/                DEAD CODE + OLD SPECS (gitignored)
│   ├── property-saas-spec/ Old Laravel/PHP SaaS spec (docs/ + architecture/)
│   ├── python-fastapi-stub/ Old Python ML engine stubs
│   └── Carina_Agent_Decided_3.6.2026.md
│
├── data/                   RUNTIME DATA (gitignored)
│   ├── logs/               Shell execution logs
│   ├── memories/           (reserved)
│   └── skills/             (reserved)
│
├── docker-compose.yml      Dev stack (PostgreSQL + Redis)
├── docker-compose.prod.yml Full prod stack (Carina + Scout + Hub + Nginx + Certbot)
├── deploy.sh               VPS deployment script (Contabo 80.190.81.208)
└── install.sh              curl install script (served at install.carinaai.uk)
```

## Three Products in This Repo

| Product | Directory | Port | Status |
|---|---|---|---|
| Carina agent | `src/` | 3333 (local), 3000 (prod) | Built - all 5 phases complete |
| Platform admin | `ops.carinaai.uk/` | 4000 | VERLOX private - needs Security + Chat tabs |
| Labyrinth Scout | `console.labyrinthscout.com/` | 4444 | Built - trust API, dashboard, accounts |

## How Carina and Scout Communicate

```
Carina  →  src/security/scout-client.ts  →  POST localhost:4444/api/events
Scout   →  Redis pub: labyrinth:control   →  src/security/kill-switch-listener.ts
```

Scout is optional. `LABYRINTH_ENABLED=false` means zero Scout integration - Carina runs identically.

## Stack

| Layer | Technology |
|---|---|
| Carina runtime | Node.js 22 LTS + TypeScript 5 |
| LLM | 23 providers; DeepSeek default with fallback chain; Ollama/LM Studio optional |
| Embeddings | Gemini text-embedding-004 (768 dims) with OpenAI fallback |
| Memory DB | PostgreSQL 16 + pgvector |
| Cache / sessions | Redis 7 |
| Package manager | pnpm |
| Testing | Vitest (5,369 tests, 125 files) |
| Email outbound | Resend (hello@carinaai.uk verified) |
| Domain | carinaai.uk on Cloudflare, wildcard DNS to Contabo VPS 80.190.81.208 |

## Common Commands

```bash
# Carina agent
pnpm cli              # Run CLI (port 3333 - other projects own 3000)
pnpm dev              # tsx watch
pnpm test             # Vitest (5,369 tests)
pnpm build            # Compile to dist/
pnpm ingest           # Ingest property-uk RAG from archive/property-saas-spec/
pnpm hub              # Skills Hub server

# Admin panel
pnpm admin            # ops.carinaai.uk on http://localhost:4000

# Scout (console.labyrinthscout.com)
cd ../console.labyrinthscout.com && pnpm dev    # Scout on http://localhost:4444

# Docs (canonical)
cd ../docs.carinaai.uk && pnpm start       # Docusaurus at docs.carinaai.uk

# Deployment
bash deploy.sh        # Deploy to VPS
```

## Key Architecture Decisions

- **Carina is MIT / always free.** Labyrinth Scout is the paid security add-on.
- **DeepSeek first** for all LLM calls. Claude and OpenAI as fallbacks.
- **Gemini first** for embeddings (768 dims). OpenAI as fallback.
- **Scout never blocks Carina.** If Scout is down, Carina continues normally.
- **No PHP anywhere.** ops.carinaai.uk is Node.js/Express/EJS.
- **One language: TypeScript.** Python stubs are in archive/.

## Coding Rules

- Functions under 20 lines. Classes under 200 lines.
- DTOs over raw objects for cross-layer data.
- Simplest correct solution. No speculative abstractions.
- Tests document behaviour, not implementation.
- No em dashes. No emojis in code or docs.

## Env Files

- `.env` - Local dev keys (DeepSeek + OpenAI keys set, GEMINI_API_KEY needed)
- `.env.production.example` - Full production template with all vars documented
- `ops.carinaai.uk/.env` - Admin panel config (password: changeme, port 4000)

## CRITICAL: Local-first workflow

**Never edit files directly on the VPS.** All changes must be made locally, committed to git, and deployed via `bash deploy.sh` (Contabo VPS, 80.190.81.208). Direct VPS edits diverge from git history and cause merge conflicts on the next deploy. The VPS is a deployment target, not a development environment.

## Verified product metrics (2026-06-10)

Run from `core.carinaai.uk`: `pnpm test` (5,369), `provider-registry.ts` (23 providers), `completion-metadata.ts` CHANNEL_NAMES (18 adapters), `TOOLSET_MAP` (71 tools), 16 packs / 96 curated skills in `src/skills/packs/`, 49 CLI commands.

See `instructions/build-plan/COMPARISON.md` and `CONFIGURATION_READINESS.md` for marketing accuracy rules.
