# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Map

```
Carina-ai/
│
├── src/                    CARINA AGENT - Node.js/TypeScript autonomous AI agent
│   ├── agents/             CarinaAgent, CarinaOrchestrator, sub-agents
│   ├── brain/              LLMRouter (DeepSeek, Claude, OpenAI), message formatters
│   ├── config/             Central config, env loading, path constants
│   ├── gateway/            CLI, Web (SSE), Telegram, WhatsApp gateways
│   ├── memory/             PostgreSQL pool, migrations, episodic store, pgvector RAG
│   ├── security/           Scout client (Labyrinth integration), kill switch listener
│   ├── skills/             Skill store, auto-writer, ingestion, property pack
│   ├── tools/              6 tools: web-search, file, shell, http, email, code-exec
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
├── console.labyrinthscout.com/         LABYRINTH SCOUT SERVER - to be built by Cursor
│   ├── src/                (built by Cursor using prompts below)
│   ├── public/             dashboard.html goes here
│   └── prompts/            12 Cursor build prompts (01-dashboard.md ... 12-sdk.md)
│                           + LABYRINTH SCOUT .md (full spec)
│                           + PLAN_ADDENDUM.md (corrections)
│
├── labyrinthscout.com/     SCOUT MARKETING SITE
│   └── index.html          labyrinthscout.com landing page (+ style.css, app.js)
│
├── carinaai.uk/            CARINA MARKETING SITE - carinaai.uk landing page
│   └── index.html, style.css, app.js
│
├── docs/                   VITEPRESS DOCS - docs.carinaai.uk
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
| Labyrinth Scout | `console.labyrinthscout.com/` | 4444 | Scaffold - build with ../console.labyrinthscout.com/prompts/ |

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
| LLM primary | DeepSeek (cost) with Claude + OpenAI fallback |
| Embeddings | Gemini text-embedding-004 (768 dims) with OpenAI fallback |
| Memory DB | PostgreSQL 16 + pgvector |
| Cache / sessions | Redis 7 |
| Package manager | pnpm |
| Testing | Vitest (62 tests passing) |
| Email outbound | Resend (hello@carinaai.uk verified) |
| Domain | carinaai.uk on Cloudflare, wildcard DNS to Contabo VPS 80.190.81.208 |

## Common Commands

```bash
# Carina agent
pnpm cli              # Run CLI (port 3333 - other projects own 3000)
pnpm dev              # tsx watch
pnpm test             # Vitest (62 tests)
pnpm build            # Compile to dist/
pnpm ingest           # Ingest property-uk RAG from archive/property-saas-spec/
pnpm hub              # Skills Hub server

# Admin panel
pnpm admin            # ops.carinaai.uk on http://localhost:4000

# Scout (once built)
cd labyrinthscout && pnpm dev    # Scout on http://localhost:4444

# Docs
pnpm docs:dev         # VitePress dev server

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

## Building Labyrinth Scout

Prompts are at `labyrinthscout.com/prompts/`. Start with `01-dashboard.md`, paste into Cursor, return code for review, then proceed to `02-scout-server.md`. Build in order - each prompt builds on the previous.
