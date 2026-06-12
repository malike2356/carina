# Carina CLI

Install Carina globally from npm or from a local checkout.

Package: [carina-agent](https://www.npmjs.com/package/carina-agent) (Node.js 22+).

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
