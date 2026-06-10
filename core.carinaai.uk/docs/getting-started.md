# Getting Started

## Carina Cloud (no install)

Use the hosted app at **[app.carinaai.uk](https://app.carinaai.uk)** if you prefer a browser workspace with BYOK keys and optional Pro security (Labyrinth Scout). Full guide: [Carina Cloud](/carina-cloud).

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

The global package is prepared as `carina-agent`. Use this path after the npm package has been published.

```bash
npm install -g carina-agent
carina
```

On first run, Carina creates `~/.carina/` and runs the setup wizard if no env file exists.

## Install from source

```bash
git clone <public-repo-url-after-source-release>
cd carina/core.carinaai.uk
pnpm install
pnpm cli
```

`pnpm cli` starts the full gateway stack (CLI + web + Telegram when configured). Use `SKIP_CLI=true pnpm dev` to run without an interactive terminal.

## First run wizard

When `~/.carina/.env` does not exist, `carina` prompts for:

1. **Provider** - DeepSeek (recommended), Anthropic, OpenAI, or configure later
2. **API key** - For the provider you chose
3. **UK Property pack** - Optional; sets `ACTIVE_SKILL_PACK=property-uk` and runs pack install

The wizard writes `~/.carina/.env` with mode `0600` and default database URLs for local Postgres and Redis.

## Your first conversation

After setup, ask a property question if you installed the UK pack:

```
You: A flat in Portsmouth costs £185,000 and rents for £950 pcm. What is the gross yield?

Carina: [using yield-calculator...]
Gross yield = (950 × 12) / 185,000 × 100 = 6.16%
```

Carina selects relevant skills and RAG chunks automatically from keywords in your message.

## Environment variables

See [Configuration](/configuration) for the full reference. Minimum to chat without memory:

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

Run migrations on first connect (handled automatically at startup). Ingest property knowledge:

```bash
pnpm ingest
```

Requires `GEMINI_API_KEY` (or configure OpenAI embeddings in your deployment).

## Verify memory is working

1. Start Carina with a valid `DATABASE_URL`. Startup should log `Memory store ready`.
2. Have a short conversation, then type `/recall` in the CLI.
3. You should see recent user and assistant turns for the current session.

If memory is unavailable, Carina continues in chat-only mode and logs a warning at startup.

## Next steps

- [Configuration](/configuration) - all env vars
- [CLI gateway](/gateways/cli) - commands and streaming
- [property-uk pack](/skill-packs/property-uk) - built-in UK property skills
- [Labyrinth Scout](/security/labyrinth-scout) - optional security control plane
