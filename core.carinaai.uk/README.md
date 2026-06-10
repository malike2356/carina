# Carina Agent

Autonomous AI agent platform with vertical skill packs. Built by [VERLOX Ltd](https://carinaai.uk).

Carina is a general-purpose local-first agent. The **property-uk** skill pack ships by default for UK property entrepreneurs.

## Install

**npm (after package publish):**

```bash
npm install -g carina-agent
carina setup
carina
```

The package metadata is ready for the `carina-agent` npm name. Publish the package before presenting this as a live public install path.

**curl (after install host is configured):**

```bash
curl -fsSL https://install.carinaai.uk | sh
carina setup
carina
```

Requires **Node.js 22+**.

## Quick start

```bash
git clone <public-repo-url-after-source-release>
cd carina/core.carinaai.uk
pnpm install
pnpm build
pnpm dev
```

Open `http://localhost:3000` for the web UI.

## Commands

| Command | Description |
|---------|-------------|
| `carina` | Interactive CLI (runs setup wizard on first use) |
| `carina setup` | Configure API keys and skill packs |
| `carina install-pack property-uk` | Install a pack from Skills Hub |
| `carina list-packs` | List installed packs |
| `carina web` | Web UI only |
| `carina version` | Print version |

## Configuration

Config lives in `~/.carina/.env` for global installs, or `.env` in the project directory.

| Variable | Description |
|----------|-------------|
| `DEFAULT_PROVIDER` | `deepseek`, `anthropic`, or `openai` |
| `DEEPSEEK_API_KEY` | DeepSeek API key |
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `DATABASE_URL` | PostgreSQL with pgvector |
| `REDIS_URL` | Redis for sessions |
| `ACTIVE_SKILL_PACK` | Default skill pack (e.g. `property-uk`) |

## Features

- **Skill packs** with domain knowledge (property-uk: 95+ UK property docs)
- **Memory transparency**: `/memories` and `/memories delete <id>`
- **Provider hot-swap**: `/provider deepseek` in CLI, Telegram, and Web
- **MCP-compatible** tool schemas for community extensions
- **Multi-gateway**: CLI and Web by default; Telegram and WhatsApp when their channel credentials are configured
- **Hosted option**: [app.carinaai.uk](https://app.carinaai.uk) for non-technical users

## Documentation

- [docs.carinaai.uk](https://docs.carinaai.uk) - full documentation
- [skills.carinaai.uk](https://skills.carinaai.uk) - Skills Hub

## Development

```bash
pnpm install
pnpm build
pnpm test
pnpm hub          # Skills Hub on :3001
pnpm docs:dev     # Documentation site
```

## License

MIT - see [LICENSE](LICENSE).
