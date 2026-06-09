# Carina - Project Prompt

Carina is a **general-purpose autonomous AI agent platform** built by VERLOX Ltd. The model is a horizontal core runtime with optional vertical skill packs installed on top. No domain pack is enabled by default; property-uk is one optional pack among several.

**Runtime:** Node.js 22 LTS + TypeScript 5
**Repo root:** `/opt/lampp/htdocs/VERLOX/Carina-ai/`
**Domain:** `carinaai.uk` (live on Cloudflare, Contabo VPS 80.190.81.208)
**Package manager:** pnpm

## Architecture

```
CARINA
├── src/                   Core agent runtime (all 5 phases built)
├── ops.carinaai.uk/        VERLOX operator admin panel (to build)
├── public_website/        Marketing site at carinaai.uk (to build)
├── docs/                  VitePress documentation (built, needs deploy)
├── archive/               Old property-SaaS spec; property pack RAG source
└── docker-compose.yml     Dev stack; docker-compose.prod.yml for VPS
```

## Core Runtime - ALL PHASES COMPLETE

The `src/` directory is fully implemented and TypeScript-clean:

| Layer | Status |
|---|---|
| CLI + Web + Telegram + WhatsApp gateways | Complete |
| LLMRouter (DeepSeek/Claude/OpenAI, hot-swap) | Complete |
| Memory: episodic PostgreSQL + pgvector RAG + Redis session | Complete |
| 6 tools: web-search, file, shell, http, email, code-exec | Complete |
| Docker sandbox for shell and code execution | Complete |
| CarinaOrchestrator + 4 sub-agents | Complete |
| Skill auto-generation with Jaccard deduplication | Complete |
| Optional skill packs (property-uk, engineering, etc.; none active by default) | Complete |
| Hosted mode with Stripe (hosted-auth, migrations) | Complete |
| Skills Hub server | Complete |
| bin/carina.ts + setup wizard + install-pack | Complete |
| 62 passing tests (Vitest) | Complete |

## What Still Needs Building

| Item | Prompt | Priority |
|---|---|---|
| Platform admin backend | `prompts/platform-admin.md` | High |
| Public marketing website | `prompts/public-website.md` | High |
| Deploy to VPS (docker-compose.prod.yml + Nginx) | `prompts/phase-5-release.md` | Medium |
| GitHub repo + CI + npm publish | `prompts/phase-5-release.md` | Medium |

## Key Architecture Decisions (Do Not Change)

- Runtime: Node.js + TypeScript. Not PHP, not Python for the core.
- DeepSeek is default provider (cost). Claude is hot-swap for complex work.
- Tool registry schemas are MCP-compatible.
- Memory: working (Redis) + episodic (PostgreSQL) + semantic (pgvector) + skill docs.
- Skill packs: RAG + skill docs + pre-configured tools. No model training.
- Distribution: `npm install -g carina-agent`. Local-first, hosted cloud later.
- Open source: MIT.

## Environment

Root `.env` file. See `.env.example` for all variables. Resend email fully configured for `carinaai.uk` (DKIM, SPF, DMARC live).

## Commands

```bash
pnpm cli           # run Carina in CLI mode
pnpm dev           # tsx watch (auto-restart on save)
pnpm ingest        # ingest property-uk RAG from archive/
pnpm hub           # run Skills Hub server
pnpm docs:dev      # VitePress dev server
pnpm build         # compile TypeScript to dist/
pnpm test          # Vitest (62 tests)
pnpm admin         # platform admin (once ops.carinaai.uk/ is built)
```

## Prompt Files

| File | What it covers |
|---|---|
| `prompts/project-prompt.md` | This file - master context |
| `prompts/phase-1-memory-skills.md` | Status doc (complete) |
| `prompts/phase-2-tools-execution.md` | Status doc (complete) |
| `prompts/phase-3-gateways.md` | Status doc (complete) |
| `prompts/phase-4-multi-agent.md` | Status doc (complete, 1 gap: session GC - fixed) |
| `prompts/phase-5-release.md` | Remaining: tests done; docs, deploy, GitHub outstanding |
| `prompts/platform-admin.md` | Full spec for the VERLOX admin panel |
| `prompts/public-website.md` | Full spec for carinaai.uk marketing site |
