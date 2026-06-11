# Carina platform knowledge (runtime)

Updated: 2026-06-11. Injected into every agent turn so Carina knows the VERLOX Carina monorepo and product boundaries.

## Monorepo root

Git root: `carina/` (GitHub: `malike2356/carina-ai`). Workspace path on VERLOX dev: `/opt/lampp/htdocs/verlox/carina`.

| Directory | Product | Shipped? | Role |
|---|---|---|---|
| `core.carinaai.uk/` | Carina agent | Yes (npm `carina-agent`, Docker) | Node/TS agent: CLI, web UI, 18 gateways, 71+ tools, 16 skill packs |
| `console.labyrinthscout.com/` | Labyrinth Scout server | Yes (Docker `verlox/scout`) | Security console: events, heartbeat, kill switch via Redis |
| `ops.carinaai.uk/` | VERLOX ops panel | No | Port 4000; proxies Carina + Scout for VERLOX staff |
| `carinaMobile/` | Carina mobile app | Companion | Expo Router app; general-purpose default |
| `docs.carinaai.uk/` | Public docs | Yes | Docusaurus site published at `carinaai.uk/docs` |
| `carinaai.uk/` | Marketing | Yes | Static landing + docs mirror |
| `labyrinthscout.com/` | Scout marketing | Yes | Static landing |
| `extensions/carina-ide/` | IDE extension | Yes | VS Code, Cursor, Zed via `carina ide install` |
| `extensions/carina-jetbrains/` | JetBrains plugin | Yes | IntelliJ-family IDEs |
| `scripts/` | Deploy tooling | Internal | `deploy-carina.sh`, `deploy-marketing.sh`, security checks |

Legacy VitePress docs under `core.carinaai.uk/docs/` are deprecated; canonical docs are `docs.carinaai.uk/`.

## Default agent mode

Carina is **general-purpose by default**. No skill pack is active until the operator enables one.

Enable packs (operator host, no `.env` edit):

- Web UI: `/packs` then **Enable** on a pack card
- CLI: `carina packs install <name>` or `ACTIVE_SKILL_PACKS=finance,legal-uk` in `.env`
- Persisted operator store: `~/.carina/operator-packs.json` or DB `installed_packs` for tenant `__operator__`

16 built-in packs (property-uk, legal-uk, finance, devops, healthcare, etc.). Skills Hub at `skills.carinaai.uk` for community packs.

## Web search

Live search uses the **`web-search` tool** with **Tavily** by default (`TAVILY_API_KEY`, free tier at tavily.com). Brave Search is an optional paid fallback (`SEARCH_PROVIDER=brave`, `BRAVE_SEARCH_API_KEY`). Do not mention Brave unless configured.

## Memory and data

- Episodic memory + pgvector RAG in PostgreSQL (default) or pluggable backends: SQLite, Honcho, Mem0
- Persistent facts and promotion via REM when enabled
- Operator workspace files under `~/.carina/workspaces/{agentId}/`: AGENTS.md, SOUL.md, USER.md, MEMORY.md (operator notes, not repo files)

## Gateways and surfaces

- **Web**: `core.carinaai.uk` operator host or `app.carinaai.uk` hosted SaaS
- **CLI**: `carina` / `carina chat`; 49+ subcommands (`carina help`)
- **Channels**: Telegram, Discord, Slack, WhatsApp, Signal, Matrix, email, webhooks (config-dependent)
- **Hosted SaaS**: `HOSTED_MODE=true`, Stripe billing, JWT sessions, tenant isolation

## Labyrinth Scout pairing

Carina reports sanitized events to Scout (`LABYRINTH_ENABLED`, `LABYRINTH_URL`, `LABYRINTH_API_KEY`). Scout can suspend/throttle via Redis channel `labyrinth:control`. Carina never blocks on Scout failures.

## Production hosts (VERLOX)

| Host | Path on VPS |
|---|---|
| core.carinaai.uk | `/home/malike/apps/core.carinaai.uk` (`.env` here; not `/opt/carina` unless `npm install` run there) |
| ops.carinaai.uk | `/home/malike/apps/ops.carinaai.uk` (backend 4001, nginx bridge 4002) |
| Scout | `/home/malike/apps/console.labyrinthscout.com` |

Deploy: `bash scripts/deploy-carina.sh` from repo root; docs: `bash scripts/deploy-marketing.sh carina`.

## What Carina should not claim

- Do not describe Propreneur/Laravel `App\Services\Carina` paths as current runtime (legacy `brain/` corpus only applies to property-uk RAG)
- Do not say property-uk ships by default
- Do not say Brave is the search provider unless `SEARCH_PROVIDER=brave`
- Do not expose ops.carinaai.uk or `ops/` routes to end customers (VERLOX internal)

## Documentation map

- Users: `carinaai.uk/docs` (Docusaurus)
- Architecture deep dive: repo `ARCHITECTURE.md`
- Contributor guide: repo `AGENTS.md`, `core.carinaai.uk/CONTRIBUTING.md`
- Public npm export: `core.carinaai.uk/` only (`PUBLIC_REPOSITORY.md`)
