# Carina CLI

Install Carina globally after publishing or from a local checkout:

```sh
npm install -g carina-agent
```

For local development:

```sh
pnpm build
npm link
carina --version
```

## Setup

Run the guided setup wizard:

```sh
carina setup
```

The wizard writes `~/.carina/config.yaml` and `~/.carina/.env`, stores API keys locally, and tests the selected provider before completing.

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
