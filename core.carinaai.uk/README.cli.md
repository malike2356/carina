# Carina CLI

Install the Carina kernel globally from npm or from a local checkout.

**Current public package:** [carina-agent](https://www.npmjs.com/package/carina-agent)  
**Reserved package name:** `@carina/core` is the planned scoped package name, but it is not the live public npm install path yet.

Node.js 22+ required.

```sh
npm install -g carina-agent
carina --version
```

One-shot without a global install:

```sh
npx carina-agent --version
```

For local development:

```sh
pnpm build
npm link
carina --version
```

## First run

`carina` and `carina tui` detect a missing `~/.carina/.env`, print a short identity banner, and offer setup.

```sh
carina setup
```

Options:

- **Set up an API provider now** - provider, model, API key, optional connection test
- **Configure later** - writes local-mode config; add `DEEPSEEK_API_KEY` (or other provider key) when ready

The wizard writes `~/.carina/config.yaml` and `~/.carina/.env` (mode `0600`).

```sh
carina doctor    # install health check
```

## Chat

Start the interactive REPL:

```sh
carina
carina chat
```

Useful REPL commands:

```text
/help
/model deepseek
/provider openai
/clear
/exit
```

## Serve

Run the local HTTP and web gateway on localhost:

```sh
carina serve
```

The local server listens on `http://localhost:3000` and exposes `/`, `/api/health`, `/api/config`, `/api/chat/send`, `/api/chat`, and `/api/chat/stream`.

## Config

Read and update `~/.carina/config.yaml`:

```sh
carina config list
carina config get providers
carina config set providers.deepseek.api_key "YOUR_KEY_HERE"
carina config set provider deepseek
```

Do not commit real config files or API keys. Use `templates/config.default.yaml` and `templates/.env.example` as references only.

## Domain packs (Skills Hub)

Search, install, and publish domain packs from the CLI:

```sh
carina pack search property
carina pack list
carina pack install property-uk
carina pack publish ./my-healthcare-pack
```

Environment:

- `HUB_URL` or `SKILLS_HUB_URL` - hub base URL (default: `https://hub.carinaai.uk`)
- `CARINA_HUB_TOKEN` - publish API key for remote hub uploads

Local hub during development:

```sh
pnpm hub
HUB_URL=http://localhost:3001 carina pack search property
```

## Web UI

The current public package includes the CLI and local gateway entry points:

```sh
npm install -g carina-agent
carina serve
```

Future scoped packages may split web assets separately, but do not document `@carina/core` or `@carina/web` as the current public install path until those packages are published.

Legacy aliases `carina packs install` and `carina hub publish` remain available.
