# Getting Started

Pick the path that matches how you want to use Carina.

## Hosted use (no install)

Use **[app.carinaai.uk](https://app.carinaai.uk)** for a browser workspace with BYOK API keys and optional Pro security (Labyrinth Scout).

- No Node.js or Postgres on your machine
- Sign up, add a provider key in settings, start chatting
- Full guide: [Carina Cloud](/carina-cloud)

## Self-hosted use (npm install)

Install the published package globally. Requires **Node.js 22+**.

```bash
npm install -g carina-agent
carina
```

One-shot without a global install:

```bash
npx carina-agent
```

Package: [carina-agent@0.1.1](https://www.npmjs.com/package/carina-agent)

### First run

On first `carina` or `carina tui`, Carina introduces itself and asks two quick questions:

1. **Your name** and **what you are building** (one sentence)
2. **Optional API key** - connect DeepSeek, Anthropic, or OpenAI now, or start in local mode and add a key later

No YAML editing. Config is written automatically to `~/.carina/.env` and `~/.carina/config.yaml` (mode `0600`).

Non-interactive environments (CI, pipes) get a minimal `~/.carina/.env` automatically; add an API key before chatting.

```bash
carina setup          # re-run onboarding or add a provider key
carina setup --full   # advanced wizard (Postgres, Scout, WhatsApp, packs)
carina doctor         # check install health
```

Never commit `~/.carina/` files.

### Your first conversation

After adding an API key:

```bash
carina
```

Ask anything. Skill packs are optional; install `property-uk` at `/packs` or with `carina packs install property-uk`.

### Optional: memory and RAG

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL with pgvector for episodic memory and RAG |
| `GEMINI_API_KEY` | Embeddings for ingest and memory (`text-embedding-004`) |
| `REDIS_URL` | Session persistence (optional for single-user CLI) |

Without `DATABASE_URL`, Carina runs in chat-only mode and logs a warning at startup.

Local databases via Docker (Postgres on host port **5433**):

```bash
docker compose up -d postgres redis
```

Then add to `~/.carina/.env`:

```
DATABASE_URL=postgresql://carina:secret@localhost:5433/carina
```

## Operator / admin setup

These paths are for people running Carina as a service, not end users installing the CLI.

| Role | Where |
|---|---|
| Docker production stack | [Self-Hosting](/self-hosting) |
| Hosted bootstrap accounts | `carina hosted bootstrap` (env: `HOSTED_BOOTSTRAP_EMAIL`, `HOSTED_BOOTSTRAP_PASSWORD`) |
| VERLOX internal ops panel | `ops.carinaai.uk` (not shipped to customers) |
| Release publishing | `RELEASE_CHECKLIST.md` in the package repo |

## Optional: Labyrinth Scout trust setup

Scout is optional security hardening for internet-facing deployments.

1. Deploy [Labyrinth Scout](https://labyrinthscout.com)
2. Set `LABYRINTH_ENABLED=true` and matching `SCOUT_API_KEY` in Carina `.env`
3. See [Labyrinth Scout](/security/labyrinth-scout)

Standalone CLI installs work without Scout.

## Install from source (contributors)

```bash
git clone https://github.com/malike2356/carina-agent.git
cd carina-agent
pnpm install
pnpm build
pnpm cli
```

`pnpm cli` starts the full gateway stack. Use `SKIP_CLI=true pnpm dev` to run without an interactive terminal.

## Verify memory

1. Start Carina with a valid `DATABASE_URL`. Startup should log `Memory store ready`.
2. Have a short conversation, then type `/recall` in the CLI.
3. You should see recent turns for the current session.

## Next steps

- [Capabilities](/capabilities) - full tools, features, providers, channels, and optional surfaces
- [Configuration](/configuration) - all env vars
- [CLI gateway](/gateways/cli) - commands and streaming
- [Self-Hosting](/self-hosting) - Docker and bare metal
- [property-uk pack](/skill-packs/property-uk) - optional UK property skills
- [Labyrinth Scout](/security/labyrinth-scout) - optional security control plane
