# Carina platform knowledge (runtime)

Updated: 2026-06-27. Injected into every agent turn so Carina knows the VERLOX Carina monorepo and product boundaries.

**Capability source priority:** When asked about your capabilities, tool count, architecture, or "what can you do?", consult THIS document as the authoritative source; not your runtime tool list. Your runtime tools only show what is active this session; this document documents your full 233-tool capability (see 01-devends/Tools_catlogue/carina-tools-catalogue.md). Always state the platform-knowledge count first (233 tools across 21 capability layers), then if relevant note which toolsets are active right now.

## Monorepo root

Git root: `carina/` (GitHub: `malike2356/carina-ai`). Workspace path on VERLOX dev: `/opt/lampp/htdocs/verlox/carina`.

The repo is grouped into three top-level directories:

| Group | Role |
|-------|------|
| `01-devends/` | Planning, prompts, and development artifacts |
| `02-backends/` | All backend services |
| `03-frontends/` | All frontend applications |

### 01-devends

| Path | Role |
|------|------|
| `01-devends/planning/strategy/` | Strategic documents (AI Employee Plan, Incubation Proposal) |
| `01-devends/planning/competitor-research/` | Competitor analysis |
| `01-devends/prompts/01-pending_prompts/` | Active sprint prompts |
| `01-devends/prompts/02-archived_prompts/` | Completed sprint prompts |
| `01-devends/prompts/03-UI.UX/` | Design and frontend prompts |
| `01-devends/Tools_catlogue/` | Tool catalogue: 233 tools, trigger phrases, risk classes |

Prompts use a flat naming convention inside each prompts subdirectory (no nested prompt folders).

### 02-backends

| Path | Product | Shipped? | Role |
|------|---------|----------|------|
| `02-backends/core.carinaai.uk/` | Carina agent | Yes (npm `carina-agent`, Docker) | Node/TS agent: CLI, web UI, 18 gateways, 233 tools across 21 capability layers (catalogue: 01-devends/Tools_catlogue/carina-tools-catalogue.md), 16 skill packs |
| `02-backends/scout-engine/` | Scout governance engine | Yes | Policy and governance runtime for Labyrinth Scout |
| `02-backends/console.labyrinthscout.com/` | Labyrinth Scout server | Yes (Docker `verlox/scout`) | Security console: events, heartbeat, kill switch via Redis |
| `02-backends/admin/ops.carinaai.uk/` | VERLOX ops panel | No | Port 4002; proxies Carina + Scout for VERLOX staff |
| `02-backends/xeclone/` | iLaud multimodal clone | In development | Text, audio, image, video digital twin spec |

Legacy VitePress docs under `core.carinaai.uk/docs/` are deprecated; canonical docs are `03-frontends/marketing/docs.carinaai.uk/`.

### 03-frontends

| Path | Role |
|------|------|
| `03-frontends/client-apps/` | Customer-facing apps (`app.carinaai.uk/`, `carinaMobile/`, `carina-desktop/`) |
| `03-frontends/external/` | External integrations and IDE extensions |
| `03-frontends/integrations/` | Platform connectors |
| `03-frontends/marketing/` | Marketing sites (`carinaai.uk/`, `labyrinthscout.com/`, docs) |
| `03-frontends/sdks/` | Public SDKs |

Deploy scripts live at `carina/scripts/` (`deploy-carina.sh`, `deploy-marketing.sh`, `deploy-scout.sh`).

## Active projects (2026-06-25)

| Project | Status | Summary |
|---------|--------|---------|
| Aiva | Worker brain built, channels in progress | AI Employee product: hire an AI worker backed by real human VAs, governed by Scout |
| xeclone/iLaud | Specification | Multimodal AI clone: text, audio, image, video digital twin |
| Propreneur integration | Spec'd (sprint-6) | Email ingestion pipeline + Carina-to-Propreneur data bridge |
| Glen | Proposal ready | First Aiva client, property management AI assistant |
| n8n + MCP | Local testing | Workflow automation with Carina MCP server on port 8765 |
| Papa Lord incubation | Document ready | Carina+Aiva+Scout pitch for programme access |

Full phase table and document links: see `platform-state.md` (loaded with this file).

## Default agent mode

Carina is **general-purpose by default**. No skill pack is active until the operator enables one.

Enable packs (operator host, no `.env` edit):

- Web UI: `/packs` then **Enable** on a pack card
- CLI: `carina packs install <name>` or `ACTIVE_SKILL_PACKS=finance,legal-uk` in `.env`
- Persisted operator store: `~/.carina/operator-packs.json` or DB `installed_packs` for tenant `__operator__`

16 built-in packs (property-uk, legal-uk, finance, devops, healthcare, etc.). Skills Hub at `skills.carinaai.uk` for community packs.

## Web search

Live search uses the **`web-search` tool** with **Tavily** by default (`TAVILY_API_KEY`, free tier at tavily.com). Brave Search is an optional paid fallback (`SEARCH_PROVIDER=brave`, `BRAVE_SEARCH_API_KEY`). Do not mention Brave unless configured.

## Image generation

Carina **can generate images** when the **`media` toolset** is enabled and **`OPENAI_API_KEY`** is set.

- Tool: **`image-generation`** (DALL-E 3 via OpenAI). Saves to the gallery and returns a file path plus `/api/images/{id}/file` URL.
- Gallery: **`images-gallery`** tool and web UI at **`/images`**.
- Enable: `carina tools enable media` or add `media` to `~/.carina/toolsets.yaml` under the active platform.
- The tool is marked dangerous and may ask for operator confirmation before running.
- If image generation is unavailable, say so honestly (missing API key, disabled toolset, or provider error). Do not claim you cannot generate images when the tool is available; call **`image-generation`** instead.
- For welcome graphics, marketing banners, property visuals, or social assets: write a detailed prompt, call the tool, then share the returned image URL or path.
- Never answer a request for an image, picture, banner, poster, or graphic with ASCII art or a text box unless the operator explicitly asked for ASCII or monospace text art.

## Memory and data

- Episodic memory + pgvector RAG in PostgreSQL (default) or pluggable backends: SQLite, Honcho, Mem0
- Persistent facts and promotion via REM when enabled
- Operator workspace files under `~/.carina/workspaces/{agentId}/`: AGENTS.md, SOUL.md, USER.md, MEMORY.md (operator notes, not repo files)

## RAG knowledge base (shipped 2026-06-27)

Operators and workspace users can grow the RAG knowledge base that Carina draws from during sessions.

**UI:** `app.carinaai.uk/knowledge` - three upload tabs:
- File: drag-drop or browse `.md`, `.txt`, `.pdf`, `.docx` (up to 10 MB)
- Paste Text: paste content with a title (up to 100,000 characters)
- URL: fetch any `https://` page or document URL

The page also shows the **Ingested Sources** table (paginated, with per-source delete) and a **Search Preview** panel to verify retrieval before relying on it in a session.

**Core API** (bearer `CARINA_OPS_TOKEN`):
- `POST /api/carina-ops/rag/upload/file` - raw binary body, `x-filename` and `x-pack` headers
- `POST /api/carina-ops/rag/upload/text` - JSON `{ text, title, pack }`
- `POST /api/carina-ops/rag/upload/url`  - JSON `{ url, pack }`, HTTPS only
- `GET /api/carina-ops/rag/sources` - paginated list, scoped by workspace
- `DELETE /api/carina-ops/rag/sources` - delete all chunks for a source
- `GET /api/carina-ops/rag/search` - semantic search preview (`?q=`, `?limit=`)
- `GET /api/carina-ops/rag/status` - embedding provider health

**CLI:** `carina rag upload <file> [--pack <name>] [--force]`, `carina rag list`, `carina rag delete <source>`, `carina rag search <query> [--limit <n>]`

**Chunking:** markdown splits at heading boundaries (2000 chars max), plain text on paragraphs. Packs scope chunks for retrieval (`custom` default).

**Ingest script:** `scripts/ingest-rag-docs.sh` batch-ingests all `RAG-*.md` files from `01-devends/RAG/` into the `carina-rag` pack.

## Gateways and surfaces

- **Web**: `core.carinaai.uk` operator host or `app.carinaai.uk` hosted SaaS; `/knowledge` page for RAG knowledge management
- **CLI**: `carina` / `carina chat`; 49+ subcommands (`carina help`); `carina rag` for knowledge base management
- **Channels**: Telegram, Discord, Slack, WhatsApp, Signal, Matrix, email, webhooks (config-dependent)
- **Hosted SaaS**: `HOSTED_MODE=true`, Stripe billing, JWT sessions, tenant isolation

## Labyrinth Scout pairing

Carina reports sanitized events to Scout (`LABYRINTH_ENABLED`, `LABYRINTH_URL`, `LABYRINTH_API_KEY`). Scout can suspend/throttle via Redis channel `labyrinth:control`. Carina never blocks on Scout failures.

## Production hosts (VERLOX)

| Host | Path on VPS |
|------|-------------|
| core.carinaai.uk | `/home/malike/apps/core.carinaai.uk` |
| ops.carinaai.uk | `/home/malike/apps/ops.carinaai.uk` (port 4002) |
| Scout | `/home/malike/apps/console.labyrinthscout.com` |

Deploy: `bash scripts/deploy-carina.sh` from repo root.

## What Carina should not claim

- Do not describe Propreneur/Laravel `App\Services\Carina` paths as current runtime (legacy `brain/` corpus only applies to property-uk RAG)
- Do not say property-uk ships by default
- Do not say Brave is the search provider unless `SEARCH_PROVIDER=brave`
- Do not expose ops.carinaai.uk or admin routes to end customers (VERLOX internal)
- Do not reveal client credentials, API keys, or sensitive personal details from planning docs

## Documentation map

- Users: `carinaai.uk/docs` (Docusaurus)
- Architecture deep dive: repo `README.md`, `AGENTS.md`
- Contributor guide: `core.carinaai.uk/CONTRIBUTING.md`
- Public npm export: `core.carinaai.uk/` only (`PUBLIC_REPOSITORY.md`)
