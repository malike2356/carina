# Carina Agent

[![npm version](https://img.shields.io/npm/v/carina-agent.svg)](https://www.npmjs.com/package/carina-agent)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![docs](https://img.shields.io/badge/docs-carinaai.uk-0a0a0f)](https://carinaai.uk/docs/)

Autonomous AI agent platform with vertical skill packs. Built by [VERLOX Ltd](https://carinaai.uk).

**MIT licensed.** Fork it, extend it, ship skill packs. [Contributing](CONTRIBUTING.md) | [Discussions](https://github.com/malike2356/carina-agent/discussions) | [Report a bug](https://github.com/malike2356/carina-agent/issues/new/choose)

Carina is a general-purpose local-first agent. Skill packs are optional: enable them at `/packs` on the web UI, with `carina packs install <name>`, or via `ACTIVE_SKILL_PACKS` in `.env`.

## Install

**npm (recommended):**

```bash
npm install -g carina-agent
carina
```

First run shows a short guide and runs `carina setup` if `~/.carina/.env` is missing. Choose **configure now** (API key) or **configure later** (local mode).

**One-shot:**

```bash
npx carina-agent
```

Package: [carina-agent@0.1.1](https://www.npmjs.com/package/carina-agent) on npm. Requires **Node.js 22+**.

**curl (when install host is live):**

```bash
curl -fsSL https://install.carinaai.uk | sh
carina
```

**Hosted (no install):** [app.carinaai.uk](https://app.carinaai.uk)

## Quick start

```bash
git clone https://github.com/malike2356/carina-agent.git
cd carina-agent
pnpm install
pnpm build
pnpm dev
```

Full documentation: [carinaai.uk/docs](https://carinaai.uk/docs/).

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
| `DEFAULT_PROVIDER` | Any of 23 registered providers (see `carina providers list`) |
| `DEEPSEEK_API_KEY` | DeepSeek API key (example) |
| `ANTHROPIC_API_KEY` | Anthropic API key (example) |
| `CARINA_MEMORY_BACKEND` | `builtin`, `postgres`, `sqlite`, or `mem0` |
| `DATABASE_URL` | PostgreSQL with pgvector (when using postgres backend) |
| `REDIS_URL` | Redis for sessions |
| `ACTIVE_SKILL_PACKS` | Comma-separated skill packs (empty = general-purpose) |
| `ACTIVE_SKILL_PACK` | Legacy single-pack alias |

## Features

- **Skill packs** with domain knowledge (property-uk: 95+ UK property docs)
- **Memory transparency**: `/memories` and `/memories delete <id>`
- **Provider hot-swap**: `/provider deepseek` in CLI, Telegram, and Web
- **MCP-compatible** tool schemas for community extensions
- **Multi-gateway**: 18 channel adapters (CLI, Web, Telegram, Discord, Slack, WhatsApp, SMS, Signal, Matrix, Email, and more); each needs credentials or env flags where applicable
- **Scale**: 71 tools, 23 LLM providers, 16 skill packs, 5,369 Vitest tests (as of 2026-06-10)
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
```

Documentation source: [carinaai.uk/docs](https://carinaai.uk/docs/) (built from the private VERLOX docs repo).

## Contributing

Carina grows through **skill packs**, tools, gateways, and docs. The fastest path for new contributors is a [skill pack](https://carinaai.uk/docs/user/skill-packs/creating-packs).

1. Read [CONTRIBUTING.md](CONTRIBUTING.md) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
2. Pick a [`good first issue`](https://github.com/malike2356/carina-agent/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22) or propose a pack via the issue template
3. Open a PR or start a [Discussion](https://github.com/malike2356/carina-agent/discussions)

Community hub: [carinaai.uk/community](https://carinaai.uk/community)

## License

MIT - see [LICENSE](LICENSE).
