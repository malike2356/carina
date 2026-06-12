# Getting Started

:::tip Canonical inventory
See [Capability inventory](/docs/capabilities) for the full list of tools, providers, channels, and optional surfaces.
:::

## Carina Cloud (no install)

Use the hosted app at **[app.carinaai.uk](https://app.carinaai.uk)** if you prefer a browser workspace with BYOK keys and optional Pro security (Labyrinth Scout). Full guide: [Carina Cloud](/docs/user/carina-cloud).

## Prerequisites (self-hosted)

| Requirement | Version | Notes |
|---|---|---|
| Node.js | 22+ | Required for runtime and CLI |
| pnpm | 9+ | Used for development from source |
| PostgreSQL | 16 | With [pgvector](https://github.com/pgvector/pgvector) extension for episodic memory and RAG |
| Redis | 7+ | Session persistence and Scout kill-switch channel |
| Docker | Latest (optional) | Required for `shell-exec` and full `code-exec` sandboxing |

:::warning
Never commit `.env` or `~/.carina/.env`. API keys in git are a common breach vector.
:::

## Install (global)

```bash
npm install -g carina-agent
carina setup
```

Package: [`carina-agent` v0.1.1](https://www.npmjs.com/package/carina-agent) on npm (Node.js 22+). On first run, Carina creates `~/.carina/` and runs the setup wizard if no env file exists.

## Install from source

```bash
git clone https://github.com/malike2356/carina-agent.git
cd carina-agent
pnpm install
pnpm build
pnpm cli
```

Source lives in the public `carina-agent` repo (core only). The private `carina-ai` monorepo is VERLOX internal and is not cloned by customers.

`pnpm cli` starts the full gateway stack (CLI + web + Telegram when configured). Use `SKIP_CLI=true pnpm dev` to run without an interactive terminal.

## First run wizard

When `~/.carina/.env` does not exist, `carina` prompts for:

1. **Provider** - DeepSeek (recommended), Anthropic, OpenAI, or configure later
2. **API key** - For the provider you chose
3. **Skill packs** - Optional; choose domain packs to install (e.g. `core-engineering`, `finance`, `property-uk`)

The wizard writes `~/.carina/.env` with mode `0600` and default database URLs for local Postgres and Redis.

Optional fourth step: **Labyrinth Scout**. If you already have a Scout subscription, paste the console URL and API key from your provisioning email. See [Labyrinth Scout](/docs/user/security/labyrinth-scout).

## Your first conversation

After setup, ask a task in your domain. If you installed packs, Carina matches curated skills and RAG chunks from keywords in your message:

```
You: Summarise our sprint blockers and draft a standup update for Slack.

Carina: [using devops pack skills...]
Done. Standup draft saved; three blockers flagged for follow-up.
```

See [skill packs overview](/docs/user/skill-packs/overview) and [carinaai.uk/skill-packs](https://carinaai.uk/skill-packs/) for all 16 packs.

## Environment variables

See [Configuration](/docs/user/configuration) for the full reference. Minimum to chat without memory:

| Variable | Required | Purpose |
|---|---|---|
| `DEEPSEEK_API_KEY` (or other provider key) | Yes | LLM inference |
| `DATABASE_URL` | For memory/RAG | PostgreSQL with pgvector |
| `GEMINI_API_KEY` | For embeddings | `text-embedding-004` (768 dims) for ingest and memory |

## Database setup

Start Postgres and Redis with the included compose file (maps Postgres to host port **5433**):

```bash
cd core.carinaai.uk
docker compose up -d postgres redis
```

Then point Carina at the database:

```bash
DATABASE_URL=postgresql://carina:secret@localhost:5433/carina
```

Run migrations on first connect (handled automatically at startup). To ingest RAG corpus for a pack (e.g. property-uk):

```bash
pnpm ingest
```

Requires `GEMINI_API_KEY` (or configure OpenAI embeddings in your deployment). Not required for packs without a knowledge corpus.

## Verify memory is working

1. Start Carina with a valid `DATABASE_URL`. Startup should log `Memory store ready`.
2. Have a short conversation, then type `/recall` in the CLI.
3. You should see recent user and assistant turns for the current session.

If memory is unavailable, Carina continues in chat-only mode and logs a warning at startup.

## Next steps

- [Configuration](/docs/user/configuration) - all env vars
- [CLI gateway](/docs/user/gateways/cli) - commands and streaming
- [Skill packs overview](/docs/user/skill-packs/overview) - all 16 domain packs
- [property-uk pack](/docs/user/skill-packs/property-uk) - optional UK property vertical
- [Labyrinth Scout](/docs/user/security/labyrinth-scout) - optional security control plane
